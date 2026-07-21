import { describe, expect, it } from "vitest";
import {
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
});
