import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateWithFreeModel,
  generateWithGemini,
  generateWithOpenAI,
  generateWithXAI,
} from "@/lib/ai/client";
import { ProviderApiError } from "@/lib/ai/provider-error";

const puterChat = vi.fn();

vi.mock("@heyputer/puter.js", () => ({
  puter: { ai: { chat: puterChat } },
}));

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const event of events) controller.enqueue(encoder.encode(`data: ${event}\n\n`));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream; charset=utf-8" } },
  );
}

describe("AI provider requests", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    puterChat.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses Responses structured output, streaming and GPT-5.6 cache breakpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        JSON.stringify({ type: "response.output_text.delta", delta: '{"ok":' }),
        JSON.stringify({ type: "response.output_text.delta", delta: "true}" }),
        "[DONE]",
      ]),
    );
    const progress = vi.fn();
    const result = await generateWithOpenAI(
      { stable: "fixed rules", dynamic: "course data" },
      "gpt-5.6-sol",
      "secret",
      {
        onProgress: progress,
        cacheKey: "assessment-v3",
        structured: { name: "assessment", schema: { type: "object" } },
      },
    );

    expect(result).toBe('{"ok":true}');
    const [, request] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: "gpt-5.6-sol",
      stream: true,
      store: false,
      prompt_cache_key: "assessment-v3",
      text: { format: { type: "json_schema", name: "assessment", strict: true } },
    });
    expect(body.input[0].content[0]).toEqual({
      type: "input_text",
      text: "fixed rules",
      prompt_cache_breakpoint: { mode: "explicit" },
    });
    expect(progress).toHaveBeenCalled();
  });

  it("uses xAI Responses structured output without an OpenAI cache breakpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ output_text: '{"provider":"xai"}' }), {
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      generateWithXAI("prompt", "grok-4.5", "secret", {
        structured: { name: "assessment", schema: { type: "object" } },
      }),
    ).resolves.toBe('{"provider":"xai"}');
    const [, request] = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.text.format.type).toBe("json_schema");
    expect(body).not.toHaveProperty("prompt_cache_key");
  });

  it("parses a buffered SSE response with an incorrect content type without retrying", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        `data: ${JSON.stringify({ type: "response.output_text.delta", delta: "same request" })}\n\ndata: [DONE]\n\n`,
        { headers: { "content-type": "text/plain" } },
      ),
    );
    await expect(
      generateWithOpenAI("prompt", "gpt-4.1", "secret", { onProgress: vi.fn() }),
    ).resolves.toBe("same request");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("uses Gemini streamGenerateContent with responseJsonSchema", async () => {
    vi.mocked(fetch).mockResolvedValue(
      sseResponse([
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"中"' }] } }] }),
        JSON.stringify({ candidates: [{ content: { parts: [{ text: ':"文"}' }] } }] }),
      ]),
    );
    const result = await generateWithGemini("prompt", "gemini-2.5-flash", "secret", {
      onProgress: vi.fn(),
      structured: { name: "assessment", schema: { type: "object" } },
    });

    expect(result).toBe('{"中":"文"}');
    const [url, request] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain(":streamGenerateContent?");
    expect(String(url)).toContain("alt=sse");
    expect(String(url)).not.toContain("secret");
    expect(new Headers(request?.headers).get("x-goog-api-key")).toBe("secret");
    const body = JSON.parse(String(request?.body));
    expect(body.generationConfig).toEqual({
      temperature: 0.7,
      maxOutputTokens: 32768,
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object" },
    });
  });

  it("retries Gemini structured output in JSON mode when the schema is rejected", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: "Request contains an invalid argument.",
              status: "INVALID_ARGUMENT",
            },
          }),
          {
            status: 400,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              { content: { parts: [{ text: '{"recovered":true}' }] } },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
      );

    await expect(
      generateWithGemini("prompt", "gemini-2.5-flash", "secret", {
        structured: {
          name: "deep_schema",
          schema: {
            type: "object",
            properties: { recovered: { type: "boolean" } },
            required: ["recovered"],
          },
        },
      }),
    ).resolves.toBe('{"recovered":true}');

    expect(fetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[0][1]?.body),
    );
    const secondBody = JSON.parse(
      String(vi.mocked(fetch).mock.calls[1][1]?.body),
    );
    expect(firstBody.generationConfig.responseJsonSchema).toBeDefined();
    expect(secondBody.generationConfig).toEqual({
      temperature: 0.7,
      maxOutputTokens: 32768,
      responseMimeType: "application/json",
    });
  });

  it("consumes Puter async iterable streaming chunks", async () => {
    puterChat.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        yield { text: "第一段" };
        yield { text: "第二段" };
      },
    });
    const progress = vi.fn();
    await expect(
      generateWithFreeModel("prompt", "puter:test-model", { onProgress: progress }),
    ).resolves.toBe("第一段第二段");
    expect(puterChat).toHaveBeenCalledWith("prompt", {
      model: "test-model",
      temperature: 0.7,
      stream: true,
    });
    expect(progress).toHaveBeenCalled();
  });

  it.each([401, 429])("preserves provider HTTP %s details", async (status) => {
    vi.mocked(fetch).mockImplementation(async () =>
      new Response(JSON.stringify({ error: { message: "quota or key error", code: "provider_code" } }), {
        status,
        headers: { "content-type": "application/json", "x-request-id": "req_123" },
      }),
    );
    const promise = generateWithOpenAI("prompt", "gpt-4.1", "secret");
    await expect(promise).rejects.toBeInstanceOf(ProviderApiError);
    await expect(generateWithOpenAI("prompt", "gpt-4.1", "secret")).rejects.toMatchObject({
      status,
      code: "provider_code",
      requestId: "req_123",
    });
  });
});
