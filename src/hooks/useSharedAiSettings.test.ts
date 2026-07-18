import { describe, expect, it } from "vitest";
import {
  resolveSharedAiModel,
  SHARED_AI_DEFAULT_MODEL,
  SHARED_AI_MODEL_OPTIONS,
} from "@/hooks/useSharedAiSettings";
import { resolveStudioWorkspace } from "@/lib/studio-workspace";

describe("unified studio settings and routing", () => {
  it("exposes BYOK models only", () => {
    expect(SHARED_AI_MODEL_OPTIONS.length).toBeGreaterThan(0);
    expect(
      SHARED_AI_MODEL_OPTIONS.every(
        (option) =>
          option.group === "gemini" ||
          option.group === "openai" ||
          option.group === "xai",
      ),
    ).toBe(true);
    expect(
      SHARED_AI_MODEL_OPTIONS.some((option) =>
        option.value.startsWith("puter:"),
      ),
    ).toBe(false);
  });

  it("migrates a legacy Puter model to a valid course BYOK model", () => {
    expect(
      resolveSharedAiModel(
        "puter:gemini-3.1-flash-lite",
        "gpt-4.1-mini",
      ),
    ).toEqual({
      model: "gpt-4.1-mini",
      migratedFromPuter: true,
    });
  });

  it("falls back to Gemini 2.5 Flash when no BYOK model is valid", () => {
    expect(resolveSharedAiModel("puter:gpt-5.4-nano", null)).toEqual({
      model: SHARED_AI_DEFAULT_MODEL,
      migratedFromPuter: true,
    });
  });

  it("defaults the root workspace to course and supports direct assessment", () => {
    expect(resolveStudioWorkspace("")).toBe("course");
    expect(resolveStudioWorkspace("?workspace=course")).toBe("course");
    expect(resolveStudioWorkspace("?workspace=assessment")).toBe("assessment");
    expect(resolveStudioWorkspace("?workspace=unknown")).toBe("course");
  });
});
