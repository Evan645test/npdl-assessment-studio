import {
  generateContent,
  getModelProvider,
  type GenerationOptions,
} from "@/lib/ai/client";
import {
  buildCanvasWorksheetStarterPrompt,
  copyTextToClipboard,
  downloadTextFile,
  openGeminiCanvasWindow,
} from "@/lib/gemini-canvas-launch";

export const UNIT_CANVAS_GENERATION_MODEL = "gemini-2.5-pro";
export const UNIT_CANVAS_MAX_OUTPUT_TOKENS = 65_536;

export function resolveUnitCanvasGenerationModel(selectedModel: string): string {
  if (getModelProvider(selectedModel) === "gemini") {
    return selectedModel.includes("pro")
      ? selectedModel
      : UNIT_CANVAS_GENERATION_MODEL;
  }
  return UNIT_CANVAS_GENERATION_MODEL;
}

export function buildUnitCanvasDownloadFileName(
  unitName: string,
  lessonCount: number,
): string {
  return `NPDL-${unitName}-${lessonCount}節完整教案與學習單.md`;
}

export function buildUnitWorksheetDownloadFileName(
  unitName: string,
  lessonCount: number,
): string {
  return `NPDL-${unitName}-${lessonCount}節學習單與判讀指引.md`;
}

export async function generateUnitCanvasDocument(options: {
  prompt: string;
  geminiKey: string;
  model: string;
  onProgress?: GenerationOptions["onProgress"];
}): Promise<string> {
  const text = await generateContent(
    options.prompt,
    options.model,
    options.geminiKey,
    "",
    "",
    {
      onProgress: options.onProgress,
      maxOutputTokens: UNIT_CANVAS_MAX_OUTPUT_TOKENS,
      progressPhase: "narrative",
    },
  );
  if (!text.trim()) {
    throw new Error("Gemini 未回傳內容，請稍後再試或改用較短單元。");
  }
  return text.trim();
}

export type UnitWorksheetLaunchMode = "generated" | "clipboard";

export interface UnitWorksheetLaunchResult {
  mode: UnitWorksheetLaunchMode;
  message: string;
}

export async function launchUnitWorksheetsInCanvas(options: {
  prompt: string;
  unitName: string;
  lessonCount: number;
  geminiKey?: string;
  model?: string;
  onProgress?: GenerationOptions["onProgress"];
}): Promise<UnitWorksheetLaunchResult> {
  const starterPrompt = buildCanvasWorksheetStarterPrompt(
    options.unitName,
    options.lessonCount,
  );

  if (options.geminiKey?.trim()) {
    const model = resolveUnitCanvasGenerationModel(options.model ?? "");
    const generated = await generateUnitCanvasDocument({
      prompt: options.prompt,
      geminiKey: options.geminiKey,
      model,
      onProgress: options.onProgress,
    });
    downloadTextFile(
      generated,
      buildUnitWorksheetDownloadFileName(options.unitName, options.lessonCount),
    );
    await copyTextToClipboard(generated);
    openGeminiCanvasWindow(starterPrompt);
    return {
      mode: "generated",
      message:
        "全部節次學習單已產生、下載並複製；Gemini Canvas 已開啟，可直接貼上編修。",
    };
  }

  await copyTextToClipboard(options.prompt);
  openGeminiCanvasWindow(starterPrompt);
  return {
    mode: "clipboard",
    message:
      "學習單提示詞已複製，Gemini Canvas 已開啟。請貼上（⌘V / Ctrl+V）後 Enter 開始產生；若需一鍵產生請在設定中填入 Gemini API Key。",
  };
}
