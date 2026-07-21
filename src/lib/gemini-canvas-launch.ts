export const GEMINI_CANVAS_URL = "https://gemini.google.com/canvas";

/** 瀏覽器 URL 長度安全上限；完整單元提示詞通常超過此值，改走剪貼簿。 */
export const GEMINI_CANVAS_URL_PROMPT_LIMIT = 1800;

export function buildGeminiCanvasUrl(prompt?: string): string {
  const trimmed = prompt?.trim();
  if (!trimmed || trimmed.length > GEMINI_CANVAS_URL_PROMPT_LIMIT) {
    return GEMINI_CANVAS_URL;
  }
  return `${GEMINI_CANVAS_URL}?prompt=${encodeURIComponent(trimmed)}`;
}

export function buildCanvasWorksheetStarterPrompt(
  unitName: string,
  lessonCount: number,
): string {
  return [
    "請在 Gemini Canvas 建立繁體中文文件。",
    `我將貼上「${unitName}」共 ${lessonCount} 節的完整學習單任務資料。`,
    "請一次產生全部節次的學生學習單（每節含「知識基礎」與「NPDL 子向度思考」）與教師判讀指引。",
    "不要產生教案流程表，不要只產生一節。",
    "收到貼文後立即開始，不要反問。",
  ].join("");
}

export function openGeminiCanvasWindow(prompt?: string): Window | null {
  const url = buildGeminiCanvasUrl(prompt);
  return window.open(url, "_blank", "noopener,noreferrer");
}

export async function copyTextToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function downloadTextFile(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName.replace(/[\\/:*?"<>|]/g, "-");
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
