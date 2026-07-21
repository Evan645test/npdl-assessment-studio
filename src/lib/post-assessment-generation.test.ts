import { describe, expect, it, vi } from "vitest";
import {
  generatePostAssessment,
  type AssessmentGenerateFn,
} from "@/lib/assessment-generation";
import {
  TEST_ASSESSMENT_DOCUMENT,
  TEST_FORM,
} from "@/test/assessment-fixture";
import type {
  AssessmentDesignContext,
  CourseAssessmentSeedV1,
} from "@/types/course-ideation";

const mappings = (phase: "pre" | "post") =>
  (["q1", "q2", "q3", "q4"] as const).map((question, index) => ({
    questionKey: `${phase}.${question}` as
      | "pre.q1"
      | "pre.q2"
      | "pre.q3"
      | "pre.q4"
      | "post.q1"
      | "post.q2"
      | "post.q3"
      | "post.q4",
    purpose: `${phase} Q${index + 1} 目的`,
    focus: [
      "conceptual_understanding",
      "action_application",
      "life_transfer",
      "guided_response",
    ][index] as
      | "conceptual_understanding"
      | "action_application"
      | "life_transfer"
      | "guided_response",
    criterionIds: ["success-1"],
    observableEvidence: `${phase} Q${index + 1} 證據`,
  }));

const seed: CourseAssessmentSeedV1 = {
  version: 1,
  generatedAt: 1,
  model: "gemini-2.5-flash",
  sourceFingerprint: "course-assessment-v1-test",
  narrative: TEST_ASSESSMENT_DOCUMENT.narrative,
  pre: TEST_ASSESSMENT_DOCUMENT.pre,
  preMappings: mappings("pre"),
  plannedPostMappings: mappings("post"),
  mode: "ai_generated",
};

const context: AssessmentDesignContext = {
  projectId: "learning-design-test",
  sourceUpdatedAt: 1,
  sourceFingerprint: "assessment-design-v1-test",
  assessmentSeedSourceFingerprint: seed.sourceFingerprint,
  curriculum: [],
  transferGoals: ["能把證據比較遷移到新的生活問題。"],
  enduringUnderstandings: ["可靠判斷需要比較資料與限制。"],
  essentialQuestions: ["如何確認判斷有足夠證據？"],
  outcomes: [],
  successCriteria: [
    {
      id: "success-1",
      outcomeId: "knowledge-foundation",
      text: "能比較證據。",
    },
  ],
  selectedIndicatorId: "C2-P1",
  performanceTask: null,
  questionMaps: [],
  evidenceItems: [],
  academicRubric: [],
  unitBlueprint: null,
  courseAssessmentSeed: seed,
};

describe("course-aligned post assessment generation", () => {
  it("keeps course narrative and pre immutable while generating only post", async () => {
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValue(
        JSON.stringify({ post: TEST_ASSESSMENT_DOCUMENT.post }),
      );

    const result = await generatePostAssessment(
      {
        form: TEST_FORM,
        indicator: null,
        model: "gemini-2.5-flash",
        geminiKey: "test",
        openaiKey: "",
        xaiKey: "",
        designContext: context,
        implementationNotes: "第三節改用紙本資料，學生仍需要因果推論鷹架。",
      },
      generate,
    );

    expect(result.document.narrative).toEqual(seed.narrative);
    expect(result.document.pre).toEqual(seed.pre);
    expect(result.document.post).toEqual(TEST_ASSESSMENT_DOCUMENT.post);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0]).toMatchObject({
      stable: expect.stringContaining("本次只能生成完整課後 Q1–Q4"),
      dynamic: expect.stringContaining("第三節改用紙本資料"),
    });
  });

  it("repairs an invalid post response once", async () => {
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce("not-json")
      .mockResolvedValueOnce(
        JSON.stringify({ post: TEST_ASSESSMENT_DOCUMENT.post }),
      );

    const result = await generatePostAssessment(
      {
        form: TEST_FORM,
        indicator: null,
        model: "gemini-2.5-flash",
        geminiKey: "test",
        openaiKey: "",
        xaiKey: "",
        designContext: context,
        implementationNotes: "",
      },
      generate,
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repairStatus).toBe("succeeded");
  });

  it("blocks a stale course source before sending an AI request", async () => {
    const generate = vi.fn<AssessmentGenerateFn>();
    await expect(
      generatePostAssessment(
        {
          form: TEST_FORM,
          indicator: null,
          model: "gemini-2.5-flash",
          geminiKey: "test",
          openaiKey: "",
          xaiKey: "",
          designContext: {
            ...context,
            assessmentSeedSourceFingerprint:
              "course-assessment-v1-newer-source",
          },
          implementationNotes: "",
        },
        generate,
      ),
    ).rejects.toThrow("請重新產生並帶入最新的診斷題組");
    expect(generate).not.toHaveBeenCalled();
  });

  it("repairs a post module that directly repeats pre questions", async () => {
    const repeated = structuredClone(TEST_ASSESSMENT_DOCUMENT.post);
    repeated.scenarioBlueprint = structuredClone(seed.pre.scenarioBlueprint);
    repeated.q1 = structuredClone(seed.pre.q1);
    repeated.q2 = structuredClone(seed.pre.q2);
    repeated.q3 = structuredClone(seed.pre.q3);
    const generate = vi
      .fn<AssessmentGenerateFn>()
      .mockResolvedValueOnce(JSON.stringify({ post: repeated }))
      .mockResolvedValueOnce(
        JSON.stringify({ post: TEST_ASSESSMENT_DOCUMENT.post }),
      );

    const result = await generatePostAssessment(
      {
        form: TEST_FORM,
        indicator: null,
        model: "gemini-2.5-flash",
        geminiKey: "test",
        openaiKey: "",
        xaiKey: "",
        designContext: context,
        implementationNotes: "",
      },
      generate,
    );

    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.repairStatus).toBe("succeeded");
    expect(result.document.post.scenarioBlueprint).not.toEqual(
      seed.pre.scenarioBlueprint,
    );
  });
});
