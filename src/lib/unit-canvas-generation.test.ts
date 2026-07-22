import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildUnitAnswerKeyDownloadFileName,
  buildUnitCanvasDownloadFileName,
  buildUnitWorksheetDownloadFileName,
  launchUnitDocumentInCanvas,
  launchUnitWorksheetsInCanvas,
  resolveUnitCanvasGenerationModel,
  UNIT_CANVAS_GENERATION_MODEL,
} from "@/lib/unit-canvas-generation";

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>(
    "@/lib/ai/client",
  );
  return {
    ...actual,
    generateContent: vi.fn(),
  };
});

vi.mock("@/lib/gemini-canvas-launch", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/gemini-canvas-launch")
  >("@/lib/gemini-canvas-launch");
  return {
    ...actual,
    openGeminiCanvasWindow: vi.fn(() => ({ closed: false })),
    copyTextToClipboard: vi.fn(async () => undefined),
    downloadTextFile: vi.fn(),
  };
});

import { generateContent } from "@/lib/ai/client";
import {
  copyTextToClipboard,
  downloadTextFile,
  openGeminiCanvasWindow,
} from "@/lib/gemini-canvas-launch";

describe("unit-canvas-generation", () => {
  beforeEach(() => {
    vi.mocked(generateContent).mockReset();
    vi.mocked(openGeminiCanvasWindow).mockReset();
    vi.mocked(copyTextToClipboard).mockReset();
    vi.mocked(downloadTextFile).mockReset();
    vi.mocked(openGeminiCanvasWindow).mockReturnValue({
      closed: false,
    } as Window);
    vi.mocked(copyTextToClipboard).mockResolvedValue(undefined);
  });

  it("uses the teacher's selected Gemini model for worksheet generation", () => {
    expect(resolveUnitCanvasGenerationModel("gemini-3-flash-preview")).toBe(
      "gemini-3-flash-preview",
    );
    expect(resolveUnitCanvasGenerationModel("gemini-2.5-pro")).toBe(
      "gemini-2.5-pro",
    );
    expect(resolveUnitCanvasGenerationModel("gpt-4.1")).toBe(
      UNIT_CANVAS_GENERATION_MODEL,
    );
  });

  it("builds teacher-prep and worksheet download file names", () => {
    expect(buildUnitCanvasDownloadFileName("反應速率", 4)).toBe(
      "NPDL-反應速率-4節教師備課教案.md",
    );
    expect(buildUnitWorksheetDownloadFileName("反應速率", 4)).toBe(
      "NPDL-反應速率-4節學習單學生版.md",
    );
    expect(buildUnitAnswerKeyDownloadFileName("反應速率", 4)).toBe(
      "NPDL-反應速率-4節學習單教師參考解答版.md",
    );
  });

  it("launches teacher-prep Canvas documents with a distinct product label", async () => {
    vi.mocked(generateContent).mockRejectedValueOnce(
      new Error("404 model_not_found"),
    );
    const result = await launchUnitDocumentInCanvas({
      prompt: "教師備課提示詞",
      unitName: "化學流言",
      lessonCount: 6,
      kind: "teacher_prep",
      geminiKey: "test-key",
      model: "gemini-3-flash-preview",
    });
    expect(result.mode).toBe("clipboard");
    expect(result.message).toContain("教師備課提示詞");
    expect(result.message).not.toContain("學習單提示詞");
    expect(copyTextToClipboard).toHaveBeenCalledWith("教師備課提示詞");
  });

  it("opens Canvas before async generation and falls back to clipboard on API failure", async () => {
    const order: string[] = [];
    vi.mocked(openGeminiCanvasWindow).mockImplementation(() => {
      order.push("open");
      return { closed: false } as Window;
    });
    vi.mocked(generateContent).mockImplementation(async () => {
      order.push("generate");
      throw new Error("404 model_not_found");
    });
    vi.mocked(copyTextToClipboard).mockImplementation(async () => {
      order.push("copy");
    });

    const result = await launchUnitWorksheetsInCanvas({
      prompt: "完整學習單提示詞",
      unitName: "化學流言",
      lessonCount: 6,
      geminiKey: "test-key",
      model: "gemini-3-flash-preview",
    });

    expect(order[0]).toBe("open");
    expect(order).toEqual(["open", "generate", "copy"]);
    expect(result.mode).toBe("clipboard");
    expect(result.canvasOpened).toBe(true);
    expect(result.message).toContain("已改為複製完整學生版學習單提示詞");
    expect(copyTextToClipboard).toHaveBeenCalledWith("完整學習單提示詞");
    expect(downloadTextFile).not.toHaveBeenCalled();
  });

  it("downloads generated worksheets when the API succeeds", async () => {
    vi.mocked(generateContent).mockResolvedValueOnce("# 學習單\n內容");
    const result = await launchUnitWorksheetsInCanvas({
      prompt: "完整學習單提示詞",
      unitName: "化學流言",
      lessonCount: 6,
      geminiKey: "test-key",
      model: "gemini-3-flash-preview",
    });
    expect(result.mode).toBe("generated");
    expect(downloadTextFile).toHaveBeenCalled();
    expect(copyTextToClipboard).toHaveBeenCalledWith("# 學習單\n內容");
    expect(openGeminiCanvasWindow).toHaveBeenCalledTimes(1);
  });
});
