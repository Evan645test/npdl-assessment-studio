import { MODEL_OPTIONS, type ModelProvider } from "@/data/constants";
import { inferCompletedSections, inferGenerationSection } from "@/lib/assessment-document";
import { ProviderApiError, type ProviderName } from "@/lib/ai/provider-error";
import { parseSseStream, SseStreamError } from "@/lib/ai/sse";
import type { GenerationPhase, GenerationProgress } from "@/types";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const PUTER_MODEL_PREFIX = "puter:";

export interface GenerationPromptParts {
  stable: string;
  dynamic: string;
}

export interface GenerationOptions {
  onProgress?: (progress: GenerationProgress) => void;
  structured?: { name: string; schema: Record<string, unknown> };
  cacheKey?: string;
  progressPhase?: GenerationPhase;
}

interface ResponsesApiPayload {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; output_text?: string }> }>;
  error?: { message?: string };
}

interface ResponsesStreamPayload {
  type?: string;
  delta?: string;
  error?: { message?: string };
  response?: { error?: { message?: string } };
}

interface GeminiPayload {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

function promptText(prompt: string | GenerationPromptParts): string {
  return typeof prompt === "string" ? prompt : `${prompt.stable}\n\n${prompt.dynamic}`;
}

function createProgressReporter(options: GenerationOptions) {
  let lastUpdate = 0;
  let firstDeltaMs: number | null = null;
  const startedAt = performance.now();

  const report = (raw: string, force = false) => {
    if (!options.onProgress) return;
    const now = performance.now();
    if (!force && now - lastUpdate < 100) return;
    if (raw && firstDeltaMs === null) firstDeltaMs = now - startedAt;
    lastUpdate = now;
    const section = inferGenerationSection(raw);
    options.onProgress({
      phase: options.progressPhase ?? section,
      receivedChars: raw.length,
      completedSections: inferCompletedSections(raw),
    });
  };

  return {
    report,
    metrics: () => ({ firstDeltaMs, totalMs: performance.now() - startedAt }),
  };
}

async function throwProviderError(response: Response, providerName: ProviderName): Promise<never> {
  const rawBody = await response.text().catch(() => "");
  let detail = rawBody;
  let code: string | undefined;
  let type: string | undefined;

  try {
    const data = JSON.parse(rawBody) as {
      error?: { message?: unknown; code?: unknown; type?: unknown; status?: unknown } | string;
      message?: unknown;
    };
    detail =
      typeof data.error === "string"
        ? data.error
        : typeof data.error?.message === "string"
          ? data.error.message
          : typeof data.message === "string"
            ? data.message
            : rawBody;
    if (typeof data.error === "object" && data.error) {
      if (typeof data.error.code === "string" || typeof data.error.code === "number") {
        code = String(data.error.code);
      }
      if (typeof data.error.type === "string") type = data.error.type;
      if (!type && typeof data.error.status === "string") type = data.error.status;
    }
  } catch {
    // 非 JSON 回應仍保留純文字錯誤內容，避免吞掉供應商提供的診斷資訊。
  }

  throw new ProviderApiError({
    provider: providerName,
    status: response.status,
    detail,
    code,
    type,
    requestId: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? undefined,
  });
}

export function getModelProvider(model: string): ModelProvider {
  return MODEL_OPTIONS.find((option) => option.value === model)?.group ?? "gemini";
}

function extractResponsesText(data: ResponsesApiPayload): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];
  for (const item of data.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.text) parts.push(content.text);
      if (content.output_text) parts.push(content.output_text);
    }
  }
  const text = parts.join("\n").trim();
  if (!text) throw new Error("AI 未回傳內容");
  return text;
}

function responsesInput(
  prompt: string | GenerationPromptParts,
  providerName: "OpenAI" | "Grok",
  model: string,
): unknown {
  if (
    providerName === "OpenAI" &&
    model.startsWith("gpt-5.6") &&
    typeof prompt !== "string"
  ) {
    return [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt.stable,
            prompt_cache_breakpoint: { mode: "explicit" },
          },
          { type: "input_text", text: prompt.dynamic },
        ],
      },
    ];
  }
  return promptText(prompt);
}

async function readResponsesStream(response: Response, options: GenerationOptions): Promise<string> {
  const progress = createProgressReporter(options);
  let output = "";
  for await (const message of parseSseStream(response.body)) {
    if (message.data === "[DONE]") break;
    let event: ResponsesStreamPayload;
    try {
      event = JSON.parse(message.data) as ResponsesStreamPayload;
    } catch (error) {
      throw new SseStreamError(
        `Responses 串流事件不是有效 JSON：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const eventType = event.type ?? message.event;
    if (eventType === "response.output_text.delta" && typeof event.delta === "string") {
      output += event.delta;
      progress.report(output);
    }
    if (eventType === "error" || eventType === "response.failed") {
      throw new SseStreamError(
        event.error?.message ?? event.response?.error?.message ?? "AI 串流生成失敗",
      );
    }
  }
  progress.report(output, true);
  if (!output.trim()) throw new Error("AI 未回傳內容");
  return output.trim();
}

function bufferedSseResponse(raw: string): Response {
  return new Response(raw, { headers: { "content-type": "text/event-stream" } });
}

async function generateWithResponsesApi(
  prompt: string | GenerationPromptParts,
  model: string,
  apiKey: string,
  endpoint: string,
  providerName: "OpenAI" | "Grok",
  options: GenerationOptions = {},
): Promise<string> {
  if (!apiKey.trim()) throw new Error(`請前往系統設定填寫 ${providerName} API Key。`);

  const body: Record<string, unknown> = {
    model,
    input: responsesInput(prompt, providerName, model),
    store: false,
    stream: Boolean(options.onProgress),
  };
  if (options.structured) {
    body.text = {
      format: {
        type: "json_schema",
        name: options.structured.name,
        strict: true,
        schema: options.structured.schema,
      },
    };
  }
  if (providerName === "OpenAI" && options.cacheKey) body.prompt_cache_key = options.cacheKey;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) await throwProviderError(response, providerName);

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (options.onProgress && contentType.includes("text/event-stream")) {
    return readResponsesStream(response, options);
  }

  const rawBody = await response.text();
  let payload: ResponsesApiPayload;
  try {
    payload = JSON.parse(rawBody) as ResponsesApiPayload;
  } catch (error) {
    if (options.onProgress && /^\s*(?:event:|data:|:)/.test(rawBody)) {
      return readResponsesStream(bufferedSseResponse(rawBody), options);
    }
    throw new Error(
      `Responses API 回應格式異常：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = extractResponsesText(payload);
  createProgressReporter(options).report(text, true);
  return text;
}

function extractGeminiText(data: GeminiPayload): string {
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("AI 未回傳內容");
  return text;
}

async function readGeminiStream(response: Response, options: GenerationOptions): Promise<string> {
  const progress = createProgressReporter(options);
  let output = "";
  for await (const message of parseSseStream(response.body)) {
    if (message.data === "[DONE]") break;
    let event: GeminiPayload;
    try {
      event = JSON.parse(message.data) as GeminiPayload;
    } catch (error) {
      throw new SseStreamError(
        `Gemini 串流事件不是有效 JSON：${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (event.error?.message) throw new SseStreamError(event.error.message);
    const delta = event.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (delta) {
      output += delta;
      progress.report(output);
    }
  }
  progress.report(output, true);
  if (!output.trim()) throw new Error("AI 未回傳內容");
  return output.trim();
}

export async function generateWithGemini(
  prompt: string | GenerationPromptParts,
  model: string,
  apiKey: string,
  options: GenerationOptions = {},
): Promise<string> {
  if (!apiKey.trim()) throw new Error("請前往系統設定填寫 Gemini API Key。");
  const method = options.onProgress ? "streamGenerateContent" : "generateContent";
  const streamQuery = options.onProgress ? "&alt=sse" : "";
  const generationConfig: Record<string, unknown> = { temperature: 0.7 };
  if (options.structured) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseJsonSchema = options.structured.schema;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${method}?key=${encodeURIComponent(apiKey.trim())}${streamQuery}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: promptText(prompt) }] }],
        generationConfig,
      }),
    },
  );

  if (!response.ok) await throwProviderError(response, "Gemini");

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (options.onProgress && contentType.includes("text/event-stream")) {
    return readGeminiStream(response, options);
  }
  const rawBody = await response.text();
  let payload: GeminiPayload;
  try {
    payload = JSON.parse(rawBody) as GeminiPayload;
  } catch (error) {
    if (options.onProgress && /^\s*(?:event:|data:|:)/.test(rawBody)) {
      return readGeminiStream(bufferedSseResponse(rawBody), options);
    }
    throw new Error(
      `Gemini API 回應格式異常：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const text = extractGeminiText(payload);
  createProgressReporter(options).report(text, true);
  return text.trim();
}

export async function generateWithOpenAI(
  prompt: string | GenerationPromptParts,
  model: string,
  apiKey: string,
  options: GenerationOptions = {},
): Promise<string> {
  return generateWithResponsesApi(prompt, model, apiKey, OPENAI_RESPONSES_URL, "OpenAI", options);
}

export async function generateWithXAI(
  prompt: string | GenerationPromptParts,
  model: string,
  apiKey: string,
  options: GenerationOptions = {},
): Promise<string> {
  return generateWithResponsesApi(prompt, model, apiKey, XAI_RESPONSES_URL, "Grok", options);
}

function extractPuterText(response: unknown): string {
  if (typeof response === "string" && response.trim()) return response.trim();
  if (!response || typeof response !== "object") throw new Error("免費模型未回傳內容");

  const message = (response as { message?: { content?: unknown } }).message;
  const content = message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const value = (part as { text?: unknown }).text;
          return typeof value === "string" ? value : "";
        }
        return "";
      })
      .join("\n")
      .trim();
    if (text) return text;
  }

  throw new Error("免費模型未回傳內容");
}

function extractPuterDelta(chunk: unknown): string {
  if (typeof chunk === "string") return chunk;
  if (!chunk || typeof chunk !== "object") return "";
  const text = (chunk as { text?: unknown }).text;
  if (typeof text === "string") return text;
  try {
    return extractPuterText(chunk);
  } catch {
    return "";
  }
}

export async function generateWithFreeModel(
  prompt: string | GenerationPromptParts,
  model: string,
  options: GenerationOptions = {},
): Promise<string> {
  const puterModel = model.startsWith(PUTER_MODEL_PREFIX)
    ? model.slice(PUTER_MODEL_PREFIX.length)
    : model;
  const { puter } = await import("@heyputer/puter.js");
  const response = await puter.ai.chat(promptText(prompt), {
    model: puterModel,
    temperature: 0.7,
    stream: Boolean(options.onProgress),
  });

  if (options.onProgress && response && typeof response === "object" && Symbol.asyncIterator in response) {
    const progress = createProgressReporter(options);
    let output = "";
    for await (const chunk of response as AsyncIterable<unknown>) {
      const delta = extractPuterDelta(chunk);
      if (delta) {
        output += delta;
        progress.report(output);
      }
    }
    progress.report(output, true);
    if (!output.trim()) throw new Error("免費模型未回傳內容");
    return output.trim();
  }

  const text = extractPuterText(response);
  createProgressReporter(options).report(text, true);
  return text;
}

export async function generateContent(
  prompt: string | GenerationPromptParts,
  model: string,
  geminiKey: string,
  openaiKey: string,
  xaiKey: string,
  options: GenerationOptions = {},
): Promise<string> {
  switch (getModelProvider(model)) {
    case "openai":
      return generateWithOpenAI(prompt, model, openaiKey, options);
    case "xai":
      return generateWithXAI(prompt, model, xaiKey, options);
    case "free":
      return generateWithFreeModel(prompt, model, options);
    case "gemini":
      return generateWithGemini(prompt, model, geminiKey, options);
  }
}

export async function generateIdeationJson(
  prompt: string,
  model: string,
  geminiKey: string,
  openaiKey: string,
  xaiKey: string,
): Promise<{ lifeKeywords: string[]; tools: string[] }> {
  if (getModelProvider(model) !== "gemini") {
    const text = await generateContent(prompt, model, geminiKey, openaiKey, xaiKey);
    return JSON.parse(text) as { lifeKeywords: string[]; tools: string[] };
  }

  if (!geminiKey.trim()) throw new Error("請前往系統設定填寫 Gemini API Key。");
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey.trim())}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json",
        },
      }),
    },
  );
  if (!response.ok) await throwProviderError(response, "Gemini");
  const text = extractGeminiText((await response.json()) as GeminiPayload);
  return JSON.parse(text) as { lifeKeywords: string[]; tools: string[] };
}
