const KEYS = {
  geminiKey: "npdl_custom_api_key",
  openaiKey: "npdl_openai_api_key",
  xaiKey: "npdl_xai_api_key",
  model: "npdl_selected_model",
  questionBank: "npdl_question_bank",
  draft: "npdl_draft_v3",
  legacyDraft: "npdl_draft_v2",
  draftDismissed: "npdl_draft_dismissed",
  googleOAuthClientId: "npdl_google_oauth_client_id",
  googleFormsExports: "npdl_google_forms_exports_v1",
} as const;

export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readStorage(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): void {
  writeStorage(key, JSON.stringify(value));
}

export { KEYS };
