import {
  generateContent,
  getModelProvider,
  type GenerationOptions,
} from "@/lib/ai/client";
import { toUserErrorMessage } from "@/lib/errors";
import {
  buildCanvasWorksheetStarterPrompt,
  copyTextToClipboard,
  downloadTextFile,
  openGeminiCanvasWindow,
} from "@/lib/gemini-canvas-launch";

/** Fallback when the teacher is not currently on a Gemini BYOK model. */
export const UNIT_CANVAS_GENERATION_MODEL = "gemini-2.5-flash";
export const UNIT_CANVAS_MAX_OUTPUT_TOKENS = 65_536;

export function resolveUnitCanvasGenerationModel(selectedModel: string): string {
  if (
    getModelProvider(selectedModel) === "gemini" &&
    !selectedModel.startsWith("puter:")
  ) {
    return selectedModel;
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
  canvasOpened: boolean;
}

function canvasOpenHint(opened: boolean): string {
  return opened
    ? "Gemini Canvas 已開啟"
    : "若瀏覽器封鎖彈出視窗，請允許本站彈出視窗後再試，或手動開啟 https://gemini.google.com/canvas";
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

  // Open Canvas in the same user-gesture turn so popup blockers do not
  // suppress the window after long async generation / clipboard work.
  const canvasWindow = openGeminiCanvasWindow(starterPrompt);
  const canvasOpened = Boolean(canvasWindow);

  if (options.geminiKey?.trim()) {
    try {
      const model = resolveUnitCanvasGenerationModel(options.model ?? "");
      const generated = await generateUnitCanvasDocument({
        prompt: options.prompt,
        geminiKey: options.geminiKey,
        model,
        onProgress: options.onProgress,
      });
      downloadTextFile(
        generated,
        buildUnitWorksheetDownloadFileName(
          options.unitName,
          options.lessonCount,
        ),
      );
      await copyTextToClipboard(generated);
      return {
        mode: "generated",
        canvasOpened,
        message: `全部節次學習單已產生、下載並複製；${canvasOpenHint(canvasOpened)}，可直接貼上編修。`,
      };
    } catch (caught) {
      await copyTextToClipboard(options.prompt);
      const reason = toUserErrorMessage(caught);
      return {
        mode: "clipboard",
        canvasOpened,
        message: `無法一鍵產生學習單（${reason}）已改為複製完整學習單提示詞；${canvasOpenHint(canvasOpened)}，請貼上（⌘V / Ctrl+V）後 Enter 開始。`,
      };
    }
  }

  await copyTextToClipboard(options.prompt);
  return {
    mode: "clipboard",
    canvasOpened,
    message: `學習單提示詞已複製；${canvasOpenHint(canvasOpened)}。請貼上（⌘V / Ctrl+V）後 Enter 開始產生；若需一鍵產生請確認 Gemini API Key 與模型可用。`,
  };
}
