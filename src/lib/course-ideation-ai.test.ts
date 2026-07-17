import { describe, expect, it } from "vitest";
import {
  COURSE_IDEATION_DEFAULT_MODEL,
  COURSE_IDEATION_MODEL_OPTIONS,
  getCourseIdeationProvider,
  resolveCourseIdeationModel,
} from "@/lib/course-ideation-ai";

describe("course ideation BYOK model policy", () => {
  it("defaults to Gemini 2.5 Flash and excludes every free Puter model", () => {
    expect(COURSE_IDEATION_DEFAULT_MODEL).toBe("gemini-2.5-flash");
    expect(COURSE_IDEATION_MODEL_OPTIONS.length).toBeGreaterThan(0);
    expect(
      COURSE_IDEATION_MODEL_OPTIONS.every(
        (option) => !option.value.startsWith("puter:"),
      ),
    ).toBe(true);
  });

  it("keeps an existing course BYOK selection ahead of the legacy shared model", () => {
    expect(resolveCourseIdeationModel("grok-4.5", "gpt-4.1")).toBe("grok-4.5");
    expect(getCourseIdeationProvider("grok-4.5")).toBe("xai");
  });

  it("migrates a legacy BYOK model but rejects the legacy Puter default", () => {
    expect(resolveCourseIdeationModel(null, "gpt-4.1")).toBe("gpt-4.1");
    expect(
      resolveCourseIdeationModel(null, "puter:gemini-3.1-flash-lite"),
    ).toBe("gemini-2.5-flash");
  });
});
