import { describe, expect, it } from "vitest";
import {
  buildCanvasTeacherPrepStarterPrompt,
  buildCanvasWorksheetStarterPrompt,
  buildGeminiCanvasUrl,
  GEMINI_CANVAS_URL,
  GEMINI_CANVAS_URL_PROMPT_LIMIT,
} from "@/lib/gemini-canvas-launch";

describe("gemini-canvas-launch", () => {
  it("opens canvas without query when prompt is missing or too long", () => {
    expect(buildGeminiCanvasUrl()).toBe(GEMINI_CANVAS_URL);
    expect(buildGeminiCanvasUrl("   ")).toBe(GEMINI_CANVAS_URL);
    expect(buildGeminiCanvasUrl("x".repeat(GEMINI_CANVAS_URL_PROMPT_LIMIT + 1))).toBe(
      GEMINI_CANVAS_URL,
    );
  });

  it("embeds short prompts in the canvas url", () => {
    expect(buildGeminiCanvasUrl("請在 Canvas 產生學習單")).toBe(
      `${GEMINI_CANVAS_URL}?prompt=${encodeURIComponent("請在 Canvas 產生學習單")}`,
    );
  });

  it("builds a worksheet starter prompt short enough for canvas url", () => {
    const prompt = buildCanvasWorksheetStarterPrompt("反應速率", 4);
    expect(prompt).toContain("反應速率");
    expect(prompt).toContain("4 節");
    expect(prompt).toContain("學生版");
    expect(prompt).toContain("教師參考解答版");
    expect(prompt).toContain("不要產生教案流程表");
    expect(prompt.length).toBeLessThanOrEqual(GEMINI_CANVAS_URL_PROMPT_LIMIT);
    expect(buildGeminiCanvasUrl(prompt)).toContain("?prompt=");
  });

  it("builds a teacher-prep starter prompt that excludes worksheets", () => {
    const prompt = buildCanvasTeacherPrepStarterPrompt("反應速率", 4);
    expect(prompt).toContain("教師備課");
    expect(prompt).toContain("不要產生學生學習單");
    expect(prompt.length).toBeLessThanOrEqual(GEMINI_CANVAS_URL_PROMPT_LIMIT);
  });
});
