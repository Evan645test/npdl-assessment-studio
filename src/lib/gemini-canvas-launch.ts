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
    `我將貼上「${unitName}」共 ${lessonCount} 節的學習單任務資料。`,
    "請一次產生學生版學習單與教師參考解答版（皆含完整表格標題／表頭）；學生版可直接列印。",
    "不要產生教案流程表，不要只產生一節。",
    "收到貼文後立即開始，不要反問。",
  ].join("");
}

export function buildCanvasTeacherPrepStarterPrompt(
  unitName: string,
  lessonCount: number,
): string {
  return [
    "請在 Gemini Canvas 建立繁體中文文件。",
    `我將貼上「${unitName}」共 ${lessonCount} 節的教師備課／逐節教案任務資料。`,
    "請一次產生全部節次的教師教案（含流程表、形成性檢核與教學決策）。",
    "不要產生學生學習單，不要只產生一節。",
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
