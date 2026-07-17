import { describe, expect, it } from "vitest";
import {
  COURSE_IDEATION_EXAMPLES,
  DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
  createCourseIdeationExampleInput,
} from "@/data/course-ideation-examples";
import { validateCourseIdeationInput } from "@/lib/course-ideation";

describe("course ideation examples", () => {
  it("provides valid examples across distinct subjects", () => {
    expect(COURSE_IDEATION_EXAMPLES).toHaveLength(8);
    expect(
      new Set(COURSE_IDEATION_EXAMPLES.map((example) => example.input.subject))
        .size,
    ).toBe(COURSE_IDEATION_EXAMPLES.length);

    for (const example of COURSE_IDEATION_EXAMPLES) {
      expect(example.id).toMatch(/^[a-z0-9-]+$/);
      expect(example.label.trim()).not.toBe("");
      expect(validateCourseIdeationInput(example.input)).toEqual([]);
    }
  });

  it("returns a defensive copy and rejects unknown identifiers", () => {
    const first = createCourseIdeationExampleInput(
      DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
    );
    const second = createCourseIdeationExampleInput(
      DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
    );

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.coreKeywords).not.toBe(second.coreKeywords);
    expect(() => createCourseIdeationExampleInput("missing-example")).toThrow(
      "找不到課程發想測試範例",
    );
  });
});
