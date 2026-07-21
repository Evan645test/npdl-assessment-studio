import { describe, expect, it } from "vitest";
import {
  buildUnitWorksheetDownloadFileName,
  resolveUnitCanvasGenerationModel,
  UNIT_CANVAS_GENERATION_MODEL,
} from "@/lib/unit-canvas-generation";

describe("unit-canvas-generation", () => {
  it("prefers pro models for long canvas documents", () => {
    expect(resolveUnitCanvasGenerationModel("gemini-2.5-flash")).toBe(
      UNIT_CANVAS_GENERATION_MODEL,
    );
    expect(resolveUnitCanvasGenerationModel("gemini-2.5-pro")).toBe("gemini-2.5-pro");
    expect(resolveUnitCanvasGenerationModel("gpt-4.1")).toBe(UNIT_CANVAS_GENERATION_MODEL);
  });

  it("builds worksheet download file names", () => {
    expect(buildUnitWorksheetDownloadFileName("反應速率", 4)).toBe(
      "NPDL-反應速率-4節學習單與判讀指引.md",
    );
  });
});
