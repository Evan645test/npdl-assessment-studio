import { describe, expect, it } from "vitest";
import { renderAssessmentModuleMarkdown } from "@/lib/assessment-document";
import {
  buildCourseAssessmentSourceFingerprint,
  parseCourseAssessmentSeed,
} from "@/lib/course-assessment";
import {
  renderDiagnosticQuestionsMarkdown,
  renderDiagnosticTeacherGuideMarkdown,
} from "@/lib/diagnostic-export-documents";
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
  evidenceItems: [],
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

describe("diagnostic-export-documents", () => {
  it("renders student questions without teacher rubrics", () => {
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
    const preContent = renderAssessmentModuleMarkdown(seed.pre, "pre", TEST_FORM);
    const questionsMarkdown = renderDiagnosticQuestionsMarkdown({
      form: TEST_FORM,
      unitName: "測試單元",
      indicatorName: "批判性思考",
      preContent,
    });
    const guideMarkdown = renderDiagnosticTeacherGuideMarkdown(seed, TEST_FORM, {
      unitName: "測試單元",
      indicatorName: "批判性思考",
      preContent,
    });

    expect(questionsMarkdown).toContain("# 診斷題組（題目卷）");
    expect(questionsMarkdown).toContain("## 共用情境");
    expect(questionsMarkdown).toContain("診斷一");
    expect(questionsMarkdown).not.toContain("教師判讀與規準");
    expect(questionsMarkdown).not.toContain("教師解析");

    expect(guideMarkdown).toContain("# 診斷指南（教師用）");
    expect(guideMarkdown).toContain("Google Form");
    expect(guideMarkdown).toContain("教師判讀與規準");
    expect(guideMarkdown).toContain("診斷一");
    expect(guideMarkdown).not.toContain("## 課前：思維診斷");
  });
});
