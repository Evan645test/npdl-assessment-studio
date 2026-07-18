import { parseAssessmentModule, parseGuidedQ4Text } from "@/lib/parse-assessment";
import { hasStructuredQ4Scaffold } from "@/lib/q4-guidance";
import type { CourseForm } from "@/types";

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const FORMS_SCOPE = "https://www.googleapis.com/auth/forms.body";
const GOOGLE_AUTH_TIMEOUT_MS = 120_000;

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: unknown) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
          hasGrantedAllScopes?: (response: GoogleTokenResponse, ...scopes: string[]) => boolean;
        };
      };
    };
  }
}

interface GoogleTokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export type GoogleFormModule = "pre" | "post";
export type GoogleFormExportStatus = "complete" | "partial" | "error";
export type GoogleFormExportStage = "created" | "content_applied" | "published";

export interface GoogleFormExportEntry {
  type: GoogleFormModule;
  status: GoogleFormExportStatus;
  stage?: GoogleFormExportStage;
  formId?: string;
  editUrl?: string;
  responderUri?: string;
  error?: string;
}

export interface GoogleFormsExportRecord {
  fingerprint: string;
  preFingerprint?: string;
  postFingerprint?: string;
  pre?: GoogleFormExportEntry;
  post?: GoogleFormExportEntry;
  updatedAt: number;
}

export function isGoogleFormExportEntryComplete(
  entry: GoogleFormExportEntry | undefined,
): boolean {
  return entry?.status === "complete" && entry.stage === "published";
}

function waitForGoogleIdentity(timeoutMs = 10_000): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        window.clearInterval(timer);
        reject(new Error("Google Identity Services 載入逾時，請檢查網路或瀏覽器內容阻擋設定。"));
      }
    }, 50);
  });
}

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
    if (existing) {
      waitForGoogleIdentity().then(resolve, reject);
      existing.addEventListener("error", () => reject(new Error("無法載入 Google Identity Services。")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => waitForGoogleIdentity().then(resolve, reject);
    script.onerror = () => reject(new Error("無法載入 Google Identity Services。"));
    document.head.appendChild(script);
  });
}

function requestGoogleAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finishResolve = (value: string) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(value);
    };
    const finishReject = (message: string) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      reject(new Error(message));
    };
    const timeout = globalThis.setTimeout(
      () => finishReject("Google 授權逾時。請重新按下建立問卷並完成帳號授權。"),
      GOOGLE_AUTH_TIMEOUT_MS,
    );
    const tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: FORMS_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          finishReject(response.error_description || response.error || "Google 授權未完成。");
          return;
        }
        const scopeChecker = window.google?.accounts?.oauth2?.hasGrantedAllScopes;
        if (scopeChecker && !scopeChecker(response, FORMS_SCOPE)) {
          finishReject("Google Forms 權限未完整授予，請重新授權並勾選 Forms 權限。");
          return;
        }
        finishResolve(response.access_token);
      },
      error_callback: () => finishReject("Google 授權視窗已關閉或被瀏覽器阻擋。請允許彈出式視窗後重試。"),
    });
    if (!tokenClient) {
      finishReject("Google Identity Services 尚未就緒。");
      return;
    }
    try {
      tokenClient.requestAccessToken({ prompt: "" });
    } catch {
      finishReject("無法開啟 Google 授權視窗。請確認瀏覽器允許彈出式視窗。");
    }
  });
}

export function normalizeGoogleOAuthClientId(value: string): string {
  const clientId = value.trim();
  if (!clientId) {
    throw new Error("尚未設定 Google OAuth Web Client ID。請先在設定中完成 Google Forms 設定。");
  }
  if (
    clientId.length > 255
    || !/^[a-z0-9._-]+\.apps\.googleusercontent\.com$/i.test(clientId)
  ) {
    throw new Error("Google OAuth Client ID 格式不正確，應以 .apps.googleusercontent.com 結尾。");
  }
  return clientId;
}

export function getGoogleOAuthClientIdIssue(value: string): string | null {
  try {
    normalizeGoogleOAuthClientId(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Google OAuth Client ID 設定不正確。";
  }
}

function stripMarkdown(value: string): string {
  return value.replace(/^>\s?/gm, "").replace(/\*\*/g, "").replace(/\s+\n/g, "\n").trim();
}

function displayed(value: string, fallback = "未命名項目"): string {
  const cleaned = stripMarkdown(value).replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function stripOption(value: string): string {
  return displayed(value).replace(/^\(([A-D])\)\s*/, "$1. ");
}

function questionTitle(rawTitle: string, text: string): string {
  const title = displayed(rawTitle).replace(/^Q(\d+)\.\s*/, "Q$1. ");
  const body = displayed(text, "");
  return body ? `${title} ${body}` : title;
}

function textItem(title: string, description?: string) {
  return { title: displayed(title), description: description?.trim() || undefined, textItem: {} };
}

function choiceItem(title: string, options: string[]) {
  return {
    title: displayed(title),
    questionItem: {
      question: {
        required: true,
        choiceQuestion: {
          type: "RADIO",
          options: options.map((value, index) => ({ value: displayed(value, `選項 ${index + 1}`) })),
          shuffle: false,
        },
      },
    },
  };
}

function paragraphItem(title: string, required: boolean, description?: string) {
  return {
    title: displayed(title),
    description: description?.trim() || undefined,
    questionItem: { question: { required, textQuestion: { paragraph: true } } },
  };
}

type GoogleFormItem = ReturnType<typeof textItem> | ReturnType<typeof choiceItem> | ReturnType<typeof paragraphItem>;

function buildModuleItems(content: string, type: GoogleFormModule): GoogleFormItem[] {
  const parsed = parseAssessmentModule(content, type);
  const label = type === "pre" ? "課前診斷" : "課後遷移";
  const items: GoogleFormItem[] = [
    textItem(
      "作答說明",
      "Q1–Q3 為必填單選題，依序了解概念理解、行動應用與生活遷移；Q4 也分成相同三個必填長答欄。請用自己的話作答，不必猜標準句子。",
    ),
    textItem(`${label}｜共用情境`, parsed.scenario || "（尚未解析共用情境）"),
  ];

  for (const question of parsed.questions) {
    const title = questionTitle(question.rawTitle, question.text);
    if (question.rawTitle.includes("Q4")) {
      const guided = parseGuidedQ4Text(question.text);
      if (hasStructuredQ4Scaffold(question.rawTitle, guided.steps)) {
        for (const step of guided.steps) {
          items.push(paragraphItem(
            `Q4-${step.number}｜${step.label}`,
            true,
            `能力欄位：${step.label}\n共同題幹：${guided.stem}\n問題：${step.prompt}\n先看哪裡：${step.focusHint}\n可以這樣開始：${step.sentenceStarter}\n請用 1–2 句話回答。`,
          ));
        }
      } else if (question.rawTitle.includes("[引導式簡答題]")) {
        throw new Error(`${label} Q4 未通過品質檢查，請重新生成評量後再匯出 Google 問卷。`);
      } else {
        // 舊版草稿維持單一長答欄相容性。
        items.push(paragraphItem(title, false));
      }
      continue;
    }
    if (question.options.length >= 4) {
      items.push(choiceItem(title, question.options.slice(0, 4).map(stripOption)));
    }
  }
  return items;
}

export function getGoogleFormsExportIssue(preContent: string, postContent: string): string | null {
  const preIssue = getGoogleFormsModuleExportIssue(preContent, "pre");
  if (preIssue) return preIssue;
  if (postContent.trim()) {
    return getGoogleFormsModuleExportIssue(postContent, "post");
  }
  return null;
}

export function getGoogleFormsModuleExportIssue(
  content: string,
  type: GoogleFormModule,
): string | null {
  const label = type === "pre" ? "課前診斷" : "課後遷移";
  if (!content.trim()) return `${label}尚未產生。`;
  const question = parseAssessmentModule(content, type).questions.find((item) =>
    item.rawTitle.includes("Q4"),
  );
  if (!question) return `${label}缺少 Q4，請重新生成評量。`;
  if (!question.rawTitle.includes("[引導式簡答題]")) return null;
  if (
    !hasStructuredQ4Scaffold(
      question.rawTitle,
      parseGuidedQ4Text(question.text).steps,
    )
  ) {
    return `${label} Q4 未通過品質檢查，請重新生成評量。`;
  }
  return null;
}

export function buildModuleCreateItemRequests(content: string, type: GoogleFormModule) {
  return buildModuleItems(content, type).map((item, index) => ({
    createItem: { item, location: { index } },
  }));
}

/** 保留舊測試與外部呼叫相容；實際建立流程會分別呼叫 buildModuleCreateItemRequests。 */
export function buildCreateItemRequests(preContent: string, postContent: string) {
  const items = [...buildModuleItems(preContent, "pre"), ...buildModuleItems(postContent, "post")];
  return items.map((item, index) => ({ createItem: { item, location: { index } } }));
}

function apiErrorMessage(status: number, detail: string): string {
  if (status === 401) return "Google 授權已失效，請重新登入後再試。";
  if (status === 403) return "Google Forms API 權限不足。請確認已啟用 Forms API、OAuth 同意畫面與目前帳號權限。";
  if (status === 429) return "Google Forms API 請求過多，請稍後重試；已完成的問卷不會重建。";
  return `Google Forms API 錯誤 (${status})：${detail || "未知錯誤"}`;
}

function googleApiErrorDetail(raw: string, fallback: string): string {
  if (!raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; status?: string };
      message?: string;
    };
    return parsed.error?.message ?? parsed.error?.status ?? parsed.message ?? fallback;
  } catch {
    return raw.slice(0, 500);
  }
}

async function googleFormsFetch<T>(path: string, accessToken: string, init: RequestInit): Promise<T> {
  const response = await fetch(`https://forms.googleapis.com${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(apiErrorMessage(
      response.status,
      googleApiErrorDetail(text, response.statusText || "未知錯誤"),
    ));
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export function assessmentExportFingerprint(
  form: CourseForm,
  indicatorName: string,
  preContent: string,
  postContent: string,
): string {
  const source = JSON.stringify({ form, indicatorName, preContent, postContent });
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}-${source.length}`;
}

function titleFor(form: CourseForm, type: GoogleFormModule): string {
  return `${form.subject}｜${form.activityName}｜${type === "pre" ? "課前診斷" : "課後遷移"}`;
}

async function createOneForm(
  type: GoogleFormModule,
  content: string,
  accessToken: string,
  form: CourseForm,
  indicatorName: string,
  existing?: GoogleFormExportEntry,
  onProgress?: (entry: GoogleFormExportEntry) => void,
): Promise<GoogleFormExportEntry> {
  const title = titleFor(form, type);
  let entry: GoogleFormExportEntry = existing?.formId
    ? {
        ...existing,
        type,
        status: "partial",
        stage: existing.stage ?? (existing.status === "complete" ? "content_applied" : "created"),
        error: undefined,
      }
    : { type, status: "error" };
  try {
    if (!entry.formId) {
      const created = await googleFormsFetch<{ formId: string; responderUri?: string }>("/v1/forms", accessToken, {
        method: "POST",
        body: JSON.stringify({ info: { title, documentTitle: title } }),
      });
      if (!created.formId) throw new Error("Google Forms API 未回傳 Form ID，無法繼續建立問卷。");
      entry = {
        type,
        status: "partial",
        stage: "created",
        formId: created.formId,
        editUrl: `https://docs.google.com/forms/d/${created.formId}/edit`,
        responderUri: created.responderUri,
      };
      onProgress?.(entry);
    }

    if (entry.stage === "created") {
      const updated = await googleFormsFetch<{ form?: { responderUri?: string } }>(`/v1/forms/${entry.formId}:batchUpdate`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          includeFormInResponse: true,
          requests: [
            {
              updateFormInfo: {
                info: {
                  title,
                  description: `年級：${form.grade}；科目：${form.subject}；活動：${form.activityName}；NPDL 子指標：${indicatorName || "未命名指標"}`,
                },
                updateMask: "description",
              },
            },
            ...buildModuleCreateItemRequests(content, type),
          ],
        }),
      });
      entry = {
        ...entry,
        status: "partial",
        stage: "content_applied",
        responderUri: updated.form?.responderUri ?? entry.responderUri,
      };
      onProgress?.(entry);
    }

    if (entry.stage === "content_applied") {
      await googleFormsFetch<{ formId?: string }>(`/v1/forms/${entry.formId}:setPublishSettings`, accessToken, {
        method: "POST",
        body: JSON.stringify({
          publishSettings: {
            publishState: {
              isPublished: true,
              isAcceptingResponses: true,
            },
          },
          updateMask: "publishState",
        }),
      });
      entry = {
        ...entry,
        status: "complete",
        stage: "published",
        error: undefined,
      };
      onProgress?.(entry);
    }

    return entry.stage === "published"
      ? { ...entry, status: "complete", error: undefined }
      : entry;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google 問卷建立失敗。";
    return {
      ...entry,
      type,
      status: entry.formId ? "partial" : "error",
      error: message,
    };
  }
}

export async function createGoogleFormsFromAssessment({
  clientId,
  form,
  indicatorName,
  preContent,
  postContent,
  existing,
  onProgress,
}: {
  clientId: string;
  form: CourseForm;
  indicatorName: string;
  preContent: string;
  postContent?: string;
  existing?: GoogleFormsExportRecord | null;
  onProgress?: (record: GoogleFormsExportRecord) => void;
}): Promise<GoogleFormsExportRecord> {
  const trimmedClientId = normalizeGoogleOAuthClientId(clientId);
  const normalizedPostContent = postContent ?? "";
  if (!preContent.trim()) {
    throw new Error("需要先產生課前診斷，才能匯出 Google 問卷。");
  }
  const issue = getGoogleFormsExportIssue(preContent, normalizedPostContent);
  if (issue) throw new Error(issue);

  const fingerprint = assessmentExportFingerprint(
    form,
    indicatorName,
    preContent,
    normalizedPostContent,
  );
  const preFingerprint = assessmentExportFingerprint(
    form,
    indicatorName,
    preContent,
    "",
  );
  const postFingerprint = normalizedPostContent.trim()
    ? assessmentExportFingerprint(
        form,
        indicatorName,
        "",
        normalizedPostContent,
      )
    : undefined;
  const record: GoogleFormsExportRecord = {
    fingerprint,
    preFingerprint,
    postFingerprint,
    pre:
      existing?.preFingerprint === preFingerprint ||
      (existing?.fingerprint === fingerprint && !existing.preFingerprint)
        ? existing.pre
        : undefined,
    post:
      postFingerprint &&
      (existing?.postFingerprint === postFingerprint ||
        (existing?.fingerprint === fingerprint && !existing.postFingerprint))
        ? existing.post
        : undefined,
    updatedAt: Date.now(),
  };
  const available: GoogleFormModule[] = normalizedPostContent.trim()
    ? ["pre", "post"]
    : ["pre"];
  const pending = available.filter(
    (type) => !isGoogleFormExportEntryComplete(record[type]),
  );
  if (pending.length === 0) return record;

  await loadGoogleIdentityScript();
  const accessToken = await requestGoogleAccessToken(trimmedClientId);
  for (const type of pending) {
    record[type] = await createOneForm(
      type,
      type === "pre" ? preContent : normalizedPostContent,
      accessToken,
      form,
      indicatorName,
      record[type],
      (entry) => {
        record[type] = entry;
        record.updatedAt = Date.now();
        onProgress?.({ ...record });
      },
    );
    record.updatedAt = Date.now();
    onProgress?.({ ...record });
  }
  return record;
}
