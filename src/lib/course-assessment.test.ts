import { describe, expect, it } from "vitest";
import {
  assembleAssessmentDocument,
  buildAssessmentEvidencePackageMarkdown,
  buildAssessmentDesignSourceFingerprint,
  buildAssessmentQuestionAlignments,
  buildCourseAssessmentSourceFingerprint,
  isCourseAssessmentSeedCurrent,
  parseCourseAssessmentSeed,
  renderCourseAssessmentSeedMarkdown,
} from "@/lib/course-assessment";
import {
  TEST_ASSESSMENT_DOCUMENT,
  TEST_FORM,
} from "@/test/assessment-fixture";
import type {
  CourseIdeationInput,
  DesiredResults,
  EvidencePlanResult,
} from "@/types/course-ideation";

const course: CourseIdeationInput = {
  grade: "高二",
  subject: "化學",
  unitName: "反應速率",
  teachingTopic: "以生活保存問題探究反應速率",
  coreKeywords: ["反應速率", "變因控制", "證據比較"],
};

const desiredResults: DesiredResults = {
  transferGoals: ["能以資料判斷生活情境中的反應速率問題。"],
  enduringUnderstandings: ["反應速率判斷需要控制變因並比較證據。"],
  essentialQuestions: ["如何確認觀察到的差異來自指定變因？"],
  outcomes: [
    {
      id: "knowledge-foundation",
      statement: "理解反應速率與變因控制。",
      evidence: "資料判讀紀錄。",
    },
    {
      id: "competency-subdimension",
      statement: "能比較證據。",
      evidence: "證據比較表。",
    },
    {
      id: "four-elements-practice",
      statement: "能協作修正方案。",
      evidence: "修訂紀錄。",
    },
  ],
  successCriteria: [
    {
      id: "success-1",
      outcomeId: "knowledge-foundation",
      text: "能辨識控制變因。",
    },
    {
      id: "success-2",
      outcomeId: "knowledge-foundation",
      text: "能引用資料說明判斷。",
    },
  ],
};

const focuses = [
  "conceptual_understanding",
  "action_application",
  "life_transfer",
  "guided_response",
] as const;

const evidencePlan: EvidencePlanResult = {
  performanceTask: {
    goal: "提出保存建議。",
    role: "生活科學顧問",
    audience: "家庭成員",
    situation: "需要比較兩種保存方式。",
    product: "附證據的保存建議",
    criterionIds: ["success-1", "success-2"],
  },
  questionMaps: (["pre", "post"] as const).map((phase) => ({
    phase,
    sharedProblem:
      phase === "pre" ? "如何判斷保存方式？" : "新限制下如何調整？",
    transferDifference:
      phase === "pre" ? "課前生活經驗" : "加入新資料與時間限制",
    questions: focuses.map((focus, index) => ({
      id: `Q${index + 1}` as "Q1" | "Q2" | "Q3" | "Q4",
      focus,
      purpose: `${phase} Q${index + 1} 目的`,
      criterionIds: [index % 2 === 0 ? "success-1" : "success-2"],
      observableEvidence: `${phase} Q${index + 1} 可觀察證據`,
    })),
  })),
  evidenceItems: [
    {
      id: "diagnostic-1",
      type: "diagnostic",
      title: "課前診斷",
      criterionIds: ["success-1"],
      artifact: "前測",
      method: "問卷",
      timing: "課前",
      decisionRule: "依結果調整教學。",
    },
  ],
  rubric: desiredResults.successCriteria.map((criterion) => ({
    criterionId: criterion.id,
    levels: {
      evidenceLimited: "只憑直覺。",
      emerging: "能引用單一線索。",
      developing: "能比較資料。",
      mastering: "能因新限制調整並確認。",
    },
  })),
  assessmentDocument: null,
  mode: "ai_generated",
  model: "gemini-2.5-flash",
};

describe("course assessment seed", () => {
  it("maps pre and post Q1-Q4 without allowing AI-created IDs", () => {
    const mappings = buildAssessmentQuestionAlignments(evidencePlan);
    expect(mappings.preMappings.map((item) => item.questionKey)).toEqual([
      "pre.q1",
      "pre.q2",
      "pre.q3",
      "pre.q4",
    ]);
    expect(
      mappings.plannedPostMappings[2].criterionIds,
    ).toEqual(["success-1"]);
  });

  it("parses narrative and pre while attaching deterministic mappings", () => {
    const fingerprint = buildCourseAssessmentSourceFingerprint({
      course,
      selectedIndicatorId: "C2-P1",
      desiredResults,
      evidencePlan,
    });
    const seed = parseCourseAssessmentSeed(
      JSON.stringify({
        narrative: TEST_ASSESSMENT_DOCUMENT.narrative,
        pre: TEST_ASSESSMENT_DOCUMENT.pre,
      }),
      {
        model: "gemini-2.5-flash",
        sourceFingerprint: fingerprint,
        evidencePlan,
      },
    );
    expect(isCourseAssessmentSeedCurrent(seed, fingerprint)).toBe(true);
    expect(seed.preMappings[0].purpose).toBe("pre Q1 目的");
    expect(
      renderCourseAssessmentSeedMarkdown(seed, TEST_FORM),
    ).toContain("## 課前：思維診斷");
    expect(
      assembleAssessmentDocument(seed, TEST_ASSESSMENT_DOCUMENT.post).pre,
    ).toEqual(TEST_ASSESSMENT_DOCUMENT.pre);
    const evidencePackage = buildAssessmentEvidencePackageMarkdown({
      context: {
        projectId: "learning-design-test",
        sourceUpdatedAt: 1,
        sourceFingerprint: "assessment-design-v1-test",
        assessmentSeedSourceFingerprint: fingerprint,
        curriculum: [],
        transferGoals: desiredResults.transferGoals,
        enduringUnderstandings: desiredResults.enduringUnderstandings,
        essentialQuestions: desiredResults.essentialQuestions,
        outcomes: desiredResults.outcomes,
        successCriteria: desiredResults.successCriteria,
        selectedIndicatorId: "C2-P1",
        performanceTask: evidencePlan.performanceTask,
        questionMaps: evidencePlan.questionMaps,
        evidenceItems: evidencePlan.evidenceItems,
        academicRubric: evidencePlan.rubric,
        unitBlueprint: null,
        courseAssessmentSeed: seed,
      },
      document: TEST_ASSESSMENT_DOCUMENT,
      form: TEST_FORM,
      implementationNotes: "第三節改用紙本資料。",
    });
    expect(evidencePackage).toContain("## Q1–Q4 對齊表");
    expect(evidencePackage).toContain("## NPDL 子向度官方四級進程");
    expect(evidencePackage).toContain("第三節改用紙本資料");
  });

  it("marks the seed stale when evidence purposes change", () => {
    const fingerprint = buildCourseAssessmentSourceFingerprint({
      course,
      selectedIndicatorId: "C2-P1",
      desiredResults,
      evidencePlan,
    });
    const changed = structuredClone(evidencePlan);
    changed.questionMaps[0].questions[0].purpose = "新的目的";
    const changedFingerprint = buildCourseAssessmentSourceFingerprint({
      course,
      selectedIndicatorId: "C2-P1",
      desiredResults,
      evidencePlan: changed,
    });
    expect(changedFingerprint).not.toBe(fingerprint);
  });

  it("changes the assessment handoff fingerprint when the lesson blueprint changes", () => {
    const first = buildAssessmentDesignSourceFingerprint({
      assessmentSeedSourceFingerprint: "course-assessment-v1-test",
      unitBlueprint: {
        unitArc: "先診斷再探究。",
        lessons: [],
        mode: "ai_generated",
        model: "gemini-2.5-flash",
      },
    });
    const second = buildAssessmentDesignSourceFingerprint({
      assessmentSeedSourceFingerprint: "course-assessment-v1-test",
      unitBlueprint: {
        unitArc: "先診斷、探究，再以新情境檢查遷移。",
        lessons: [],
        mode: "teacher_edited",
        model: "gemini-2.5-flash",
      },
    });
    expect(second).not.toBe(first);
  });
});
