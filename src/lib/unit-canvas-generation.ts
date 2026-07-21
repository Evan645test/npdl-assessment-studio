import {
  generateContent,
  getModelProvider,
  type GenerationOptions,
} from "@/lib/ai/client";

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
