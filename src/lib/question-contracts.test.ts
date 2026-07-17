import { describe, expect, it } from "vitest";
import { renderAssessmentMarkdown } from "@/lib/assessment-document";
import {
  normalizeAssessmentQuestionStems,
  questionStemSatisfiesContract,
} from "@/lib/question-contracts";
import { validateGeneratedMarkdown } from "@/lib/validate-output";
import { TEST_ASSESSMENT_DOCUMENT, TEST_FORM } from "@/test/assessment-fixture";

const REPRESENTATIVE_INDICATORS = [
  "C1-P1",
  "C1-P3",
  "C2-P1",
  "C3-P1",
  "C4-P1",
  "C5-P3",
  "C6-P1",
] as const;

describe("Q1–Q3 ability contracts", () => {
  it("keeps already-valid legacy stems unchanged", () => {
    const normalized = normalizeAssessmentQuestionStems(TEST_ASSESSMENT_DOCUMENT);

    expect(normalized).toBe(TEST_ASSESSMENT_DOCUMENT);
  });

  it("normalizes cue-free stems for every strategy, module, and grade band", () => {
    for (const grade of ["國二", "高二"]) {
      for (const indicatorId of REPRESENTATIVE_INDICATORS) {
        const document = structuredClone(TEST_ASSESSMENT_DOCUMENT);
        const originalOptions = new Map<string, unknown>();
        for (const type of ["pre", "post"] as const) {
          for (const number of [1, 2, 3] as const) {
            const question = document[type][`q${number}`];
            question.stem = `面對這些資料時，哪一項最適合學生採用-${type}-${number}`;
            originalOptions.set(`${type}.${number}`, question.options);
          }
        }
        const form = {
          ...TEST_FORM,
          grade,
          source: "資料庫" as const,
          indicatorId,
          customIndicator: "",
        };

        const normalized = normalizeAssessmentQuestionStems(document);
        for (const type of ["pre", "post"] as const) {
          for (const number of [1, 2, 3] as const) {
            const question = normalized[type][`q${number}`];
            expect(
              questionStemSatisfiesContract(question.stem, number),
              `${grade}/${indicatorId}/${type}.q${number}: ${question.stem}`,
            ).toBe(true);
            expect(question.stem).toContain(`哪一項最適合學生採用-${type}-${number}`);
            expect(question.options).toBe(originalOptions.get(`${type}.${number}`));
          }
        }
        expect(validateGeneratedMarkdown(renderAssessmentMarkdown(normalized, form), form).errors)
          .toEqual([]);
      }
    }
  });

  it("normalizes punctuation without duplicating an existing ability lead-in", () => {
    const document = structuredClone(TEST_ASSESSMENT_DOCUMENT);
    document.pre.q3.stem = "把目前的做法用到新的生活情境時，應如何調整？？";

    const normalized = normalizeAssessmentQuestionStems(document);

    expect(normalized.pre.q3.stem).toBe(
      "把目前的做法用到新的生活情境時，應如何調整？",
    );
    expect(normalized.pre.q3.stem.match(/新的生活情境/g)).toHaveLength(1);
  });
});
