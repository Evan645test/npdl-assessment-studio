import {
  generateContent,
  getModelProvider,
  type GenerationOptions,
} from "@/lib/ai/client";
import { toUserErrorMessage } from "@/lib/errors";
import {
  buildCanvasStudentWorksheetStarterPrompt,
  buildCanvasTeacherAnswerKeyStarterPrompt,
  buildCanvasTeacherPrepStarterPrompt,
  copyTextToClipboard,
  downloadTextFile,
  openGeminiCanvasWindow,
} from "@/lib/gemini-canvas-launch";

/** Fallback when the teacher is not currently on a Gemini BYOK model. */
export const UNIT_CANVAS_GENERATION_MODEL = "gemini-2.5-flash";
export const UNIT_CANVAS_MAX_OUTPUT_TOKENS = 65_536;

export type UnitCanvasDocumentKind =
  | "teacher_prep"
  | "worksheets_student"
  | "worksheets_answer_key"
  /** @deprecated Use worksheets_student */
  | "worksheets";

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
  return `NPDL-${unitName}-${lessonCount}節教師備課教案.md`;
}

export function buildUnitWorksheetDownloadFileName(
  unitName: string,
  lessonCount: number,
): string {
  return `NPDL-${unitName}-${lessonCount}節學習單學生版.md`;
}

export function buildUnitAnswerKeyDownloadFileName(
  unitName: string,
  lessonCount: number,
): string {
  return `NPDL-${unitName}-${lessonCount}節學習單教師參考解答版.md`;
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

function normalizeKind(kind: UnitCanvasDocumentKind): Exclude<
  UnitCanvasDocumentKind,
  "worksheets"
> {
  return kind === "worksheets" ? "worksheets_student" : kind;
}

function starterPromptForKind(
  kind: Exclude<UnitCanvasDocumentKind, "worksheets">,
  unitName: string,
  lessonCount: number,
): string {
  if (kind === "teacher_prep") {
    return buildCanvasTeacherPrepStarterPrompt(unitName, lessonCount);
  }
  if (kind === "worksheets_answer_key") {
    return buildCanvasTeacherAnswerKeyStarterPrompt(unitName, lessonCount);
  }
  return buildCanvasStudentWorksheetStarterPrompt(unitName, lessonCount);
}

function downloadNameForKind(
  kind: Exclude<UnitCanvasDocumentKind, "worksheets">,
  unitName: string,
  lessonCount: number,
): string {
  if (kind === "teacher_prep") {
    return buildUnitCanvasDownloadFileName(unitName, lessonCount);
  }
  if (kind === "worksheets_answer_key") {
    return buildUnitAnswerKeyDownloadFileName(unitName, lessonCount);
  }
  return buildUnitWorksheetDownloadFileName(unitName, lessonCount);
}

function labelForKind(kind: Exclude<UnitCanvasDocumentKind, "worksheets">): {
  product: string;
  promptNoun: string;
} {
  if (kind === "teacher_prep") {
    return { product: "教師備課教案", promptNoun: "教師備課提示詞" };
  }
  if (kind === "worksheets_answer_key") {
    return {
      product: "教師參考解答版",
      promptNoun: "教師參考解答提示詞",
    };
  }
  return {
    product: "學生版學習單",
    promptNoun: "學生版學習單提示詞",
  };
}

export async function launchUnitDocumentInCanvas(options: {
  prompt: string;
  unitName: string;
  lessonCount: number;
  kind: UnitCanvasDocumentKind;
  geminiKey?: string;
  model?: string;
  onProgress?: GenerationOptions["onProgress"];
}): Promise<UnitWorksheetLaunchResult> {
  const kind = normalizeKind(options.kind);
  const starterPrompt = starterPromptForKind(
    kind,
    options.unitName,
    options.lessonCount,
  );
  const labels = labelForKind(kind);

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
        downloadNameForKind(kind, options.unitName, options.lessonCount),
      );
      await copyTextToClipboard(generated);
      return {
        mode: "generated",
        canvasOpened,
        message: `全部節次${labels.product}已產生、下載並複製；${canvasOpenHint(canvasOpened)}，可直接貼上編修。`,
      };
    } catch (caught) {
      await copyTextToClipboard(options.prompt);
      const reason = toUserErrorMessage(caught);
      return {
        mode: "clipboard",
        canvasOpened,
        message: `無法一鍵產生${labels.product}（${reason}）已改為複製完整${labels.promptNoun}；${canvasOpenHint(canvasOpened)}，請貼上（⌘V / Ctrl+V）後 Enter 開始。`,
      };
    }
  }

  await copyTextToClipboard(options.prompt);
  return {
    mode: "clipboard",
    canvasOpened,
    message: `${labels.promptNoun}已複製；${canvasOpenHint(canvasOpened)}。請貼上（⌘V / Ctrl+V）後 Enter 開始產生；若需一鍵產生請確認 Gemini API Key 與模型可用。`,
  };
}

/** @deprecated Prefer launchUnitDocumentInCanvas({ kind: "worksheets_student" }) */
export async function launchUnitWorksheetsInCanvas(options: {
  prompt: string;
  unitName: string;
  lessonCount: number;
  geminiKey?: string;
  model?: string;
  onProgress?: GenerationOptions["onProgress"];
}): Promise<UnitWorksheetLaunchResult> {
  return launchUnitDocumentInCanvas({
    ...options,
    kind: "worksheets_student",
  });
}
