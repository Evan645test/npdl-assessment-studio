import { describe, expect, it } from "vitest";
import {
  buildAssessmentDesignContext,
  buildDesiredResults,
  buildEvidencePlanPrompt,
  buildLessonPromptPackage,
  buildUnitPromptPackage,
  isValidLearningDesignProject,
  parseEvidencePlan,
  parseUnitBlueprint,
  validateEvidencePlanResult,
  validateUnitBlueprintResult,
} from "@/lib/learning-design";
import { buildStructuredGeneratePrompt } from "@/prompts";
import type {
  CourseAlignmentResult,
  CourseIdeationInput,
  LearningDesignProjectV1,
  UnitConstraints,
} from "@/types/course-ideation";

const INPUT: CourseIdeationInput = {
  grade: "高一",
  subject: "地理",
  unitName: "全球氣候變遷",
  teachingTopic: "極端氣候與校園調適倡議",
  coreKeywords: ["極端氣候", "校園熱島", "數據證據", "小組倡議"],
};

const ALIGNMENT: CourseAlignmentResult = {
  curriculumSelection: {
    performanceIds: [
      "5730-7406-performance-1c-v-1",
      "5730-7406-performance-3b-v-2",
    ],
    contentIds: [
      "5730-7406-content-ia-v-2",
      "5730-7406-content-eb-v-5",
    ],
    rationale: "以氣候資料分析與調適方案對齊地理探究。",
    mode: "ai_auto",
  },
  backwardDesign: {
    transferGoals: ["能在新的校園情境中，以資料判讀風險並提出調適方案。"],
    enduringUnderstandings: ["氣候風險判斷需要現象、脆弱度與證據的整合。"],
    essentialQuestions: ["我們如何用證據決定校園氣候調適的優先順序？"],
  },
  recommendations: [
    {
      indicatorId: "C2-P1",
      reason: "需要組織與比較多項資料。",
      matchedKeywords: ["數據證據"],
    },
  ],
  learningOutcomes: {
    knowledgeFoundation: {
      statement: "能說明極端氣候與校園熱島的成因及影響。",
      evidence: "概念圖與資料摘要。",
      successCriteria: [
        "能引用資料說明至少兩項氣候風險。",
        "能區分氣候現象、影響與調適措施。",
      ],
    },
    competencySubdimension: {
      statement: "能組織資料並形成有證據的判斷。",
      evidence: "資料比較表與推論紀錄。",
    },
    fourElementsPractice: {
      statement: "能與夥伴提出並修正校園調適倡議。",
      evidence: "倡議簡報、同儕回饋與修訂紀錄。",
    },
  },
  fourElements: [
    {
      name: "學習夥伴關係",
      designMove: "與校內利害關係人共同檢視方案。",
      studentEvidence: "訪談紀錄與修訂表。",
    },
    {
      name: "學習環境",
      designMove: "進行校園實地觀察。",
      studentEvidence: "觀察地圖。",
    },
    {
      name: "數位利用",
      designMove: "使用共享地圖整理資料。",
      studentEvidence: "附來源的資料圖層。",
    },
    {
      name: "教學實踐",
      designMove: "以形成性回饋修正主張。",
      studentEvidence: "初稿與定稿差異。",
    },
  ],
  evidenceTools: ["校園測量表", "倡議簡報", "同儕回饋單"],
  model: "gpt-4.1",
};

const RAW_EVIDENCE = {
  performanceTask: {
    goal: "提出可執行的校園氣候調適方案。",
    role: "校園氣候顧問",
    audience: "校務會議代表",
    situation: "校園需要決定下一年度優先改善項目。",
    product: "附資料證據的倡議簡報與行動方案",
    criterionIds: ["success-1", "success-2"],
  },
  questionMaps: (["pre", "post"] as const).map((phase) => ({
    phase,
    sharedProblem:
      phase === "pre"
        ? "如何判斷校園中最需要處理的高溫風險？"
        : "面對新增遮蔭資料與預算限制，應如何修正調適優先順序？",
    transferDifference:
      phase === "pre"
        ? "課前只使用學生既有生活經驗與一般資料。"
        : "課後加入新的遮蔭資料、預算限制與不同使用者需求。",
    questions: [
      {
        id: "Q1",
        focus: "conceptual_understanding",
        purpose: "辨識問題與直接相關的氣候風險證據。",
        criterionIds: ["success-1"],
        observableEvidence: "能指出關鍵風險與至少一項相關資料。",
      },
      {
        id: "Q2",
        focus: "action_application",
        purpose: "比較不同資料並選擇可執行的判斷方式。",
        criterionIds: ["success-1", "success-2"],
        observableEvidence: "能說明資料取捨與行動理由。",
      },
      {
        id: "Q3",
        focus: "life_transfer",
        purpose: "把判斷方法遷移到新的校園限制。",
        criterionIds: ["success-2"],
        observableEvidence: "能因應限制調整方法並確認結果。",
      },
      {
        id: "Q4",
        focus: "guided_response",
        purpose: "整合概念、行動與遷移形成完整書面判斷。",
        criterionIds: ["success-1", "success-2"],
        observableEvidence: "能留下可依四級進程判讀的完整回應。",
      },
    ],
  })),
  evidenceItems: [
    {
      type: "diagnostic",
      title: "課前 Q1–Q4",
      criterionIds: ["success-1", "success-2"],
      artifact: "四題基準想法紀錄",
      method: "個人作答後匿名彙整",
      timing: "第一節開始",
      decisionRule: "若三分之一以上學生混淆天氣與氣候，先安排共同判讀。",
    },
    {
      type: "formative",
      title: "資料判讀出口單",
      criterionIds: ["success-1"],
      artifact: "主張、證據與推論三欄出口單",
      method: "教師依檢核表快速分類",
      timing: "第二節結束",
      decisionRule: "若三分之一以上缺少證據，下一節先補做共同判讀。",
    },
    {
      type: "summative",
      title: "校園調適倡議",
      criterionIds: ["success-1", "success-2"],
      artifact: "倡議簡報與資料附件",
      method: "學科規準評定並接受真實受眾回饋",
      timing: "第三節",
      decisionRule: "未達發展層級者依回饋補證並修訂。",
    },
    {
      type: "transfer",
      title: "課後 Q1–Q4",
      criterionIds: ["success-1", "success-2"],
      artifact: "新校園案例的四題遷移作答",
      method: "個人書面回應",
      timing: "第三節結束",
      decisionRule: "若無法遷移，下一單元保留跨情境比較鷹架。",
    },
  ],
  rubric: ["success-1", "success-2"].map((criterionId) => ({
    criterionId,
    levels: {
      evidenceLimited: "未提出可辨識的證據。",
      emerging: "提出單一資料但未說明關聯。",
      developing: "能以相關資料支持判斷。",
      mastering: "能比較多項資料、處理限制並形成有力判斷。",
    },
  })),
};

const CONSTRAINTS: UnitConstraints = {
  totalLessons: 3,
  minutesPerLesson: 50,
  requiredActivities: "校園踏查",
  equipmentConstraints: "每組一台平板",
  priorExperience: "已讀過基本氣候圖表",
  differentiationNeeds: "提供資料判讀句型鷹架",
};

const RAW_BLUEPRINT = {
  unitArc: "先診斷概念，再練習資料判讀，最後完成倡議並遷移。",
  lessons: [
    {
      lessonNumber: 1,
      title: "辨識校園氣候風險",
      minutes: 50,
      milestone: "形成待驗證的風險假設。",
      outcomeIds: ["knowledge-foundation"],
      criterionIds: ["success-1"],
      evidenceItemIds: ["evidence-diagnostic-1"],
      learningIntention: "辨識氣候現象與可觀察風險。",
      coreTask: "完成課前 Q1–Q4 並進行校園踏查。",
      formativeCheck: "風險假設卡",
      decisionRule: "概念混淆超過三分之一時安排共同分類。",
      primaryIndicatorId: "C2-P1",
      fourElementNames: ["學習環境"],
      previousConnection: "連結生活中的高溫經驗。",
      nextConnection: "帶著假設進入資料判讀。",
    },
    {
      lessonNumber: 2,
      title: "用資料支持判斷",
      minutes: 50,
      milestone: "完成有證據的初步主張。",
      outcomeIds: ["knowledge-foundation", "competency-subdimension"],
      criterionIds: ["success-1", "success-2"],
      evidenceItemIds: ["evidence-formative-1"],
      learningIntention: "比較資料並解釋風險。",
      coreTask: "小組整理測量與公開資料。",
      formativeCheck: "資料判讀出口單",
      decisionRule: "缺少證據者先補做共同判讀再進入倡議。",
      primaryIndicatorId: "C2-P1",
      fourElementNames: ["學習夥伴關係", "數位利用"],
      previousConnection: "檢驗第一節風險假設。",
      nextConnection: "把證據轉為可溝通的調適方案。",
    },
    {
      lessonNumber: 3,
      title: "倡議、回饋與遷移",
      minutes: 50,
      milestone: "完成倡議並在新案例中遷移。",
      outcomeIds: ["four-elements-practice"],
      criterionIds: ["success-1", "success-2"],
      evidenceItemIds: ["evidence-summative-1", "evidence-transfer-1"],
      learningIntention: "以資料說服真實受眾並修正方案。",
      coreTask: "發表倡議、依回饋修訂並完成課後 Q1–Q4。",
      formativeCheck: "受眾回饋與修訂紀錄",
      decisionRule: "未達發展層級者補證後再提交。",
      primaryIndicatorId: "C2-P1",
      fourElementNames: ["學習夥伴關係", "教學實踐"],
      previousConnection: "使用第二節形成的證據主張。",
      nextConnection: "將策略遷移到下一個社區案例。",
    },
  ],
};

function createProject(): LearningDesignProjectV1 {
  const desiredResults = buildDesiredResults(ALIGNMENT);
  const evidencePlan = parseEvidencePlan(
    JSON.stringify(RAW_EVIDENCE),
    "gpt-4.1",
    desiredResults,
  );
  const unitBlueprint = parseUnitBlueprint(
    JSON.stringify(RAW_BLUEPRINT),
    "gpt-4.1",
    desiredResults,
    evidencePlan,
    CONSTRAINTS,
    "C2-P1",
  );
  return {
    version: 1,
    id: "learning-design-test-project",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_100_000,
    input: INPUT,
    analysis: null,
    alignment: ALIGNMENT,
    customCurriculumEntries: [],
    selectedIndicatorId: "C2-P1",
    desiredResults,
    desiredResultsConfirmedAt: 1_700_000_050_000,
    evidencePlan,
    evidencePlanConfirmedAt: 1_700_000_060_000,
    unitConstraints: CONSTRAINTS,
    unitBlueprint,
    unitBlueprintConfirmedAt: 1_700_000_070_000,
    lessonPromptStatus: [],
    alignmentAudit: {
      desiredResults: "current",
      evidencePlan: "current",
      unitBlueprint: "current",
    },
  };
}

describe("learning design project", () => {
  it("creates stable success IDs and a complete evidence system", () => {
    const desiredResults = buildDesiredResults(ALIGNMENT);
    expect(desiredResults.successCriteria.map((criterion) => criterion.id)).toEqual([
      "success-1",
      "success-2",
    ]);

    const evidencePlan = parseEvidencePlan(
      JSON.stringify(RAW_EVIDENCE),
      "gpt-4.1",
      desiredResults,
    );
    expect(evidencePlan.evidenceItems.map((item) => item.id)).toEqual([
      "evidence-diagnostic-1",
      "evidence-formative-1",
      "evidence-summative-1",
      "evidence-transfer-1",
    ]);
    expect(evidencePlan.rubric).toHaveLength(2);

    const prompt = buildEvidencePlanPrompt(INPUT, ALIGNMENT, "C2-P1", {
      learningGoals: ["沿用既有教案的資料判讀目標"],
      reusableActivities: ["校園踏查"],
      assessmentIdeas: ["主張證據推論表"],
      resources: ["每組一台共用平板"],
      constraints: ["每節 50 分鐘"],
      differentiationSupports: ["提供圖表判讀句型"],
    });
    expect(prompt.stable).toContain("一班約 30–40 位學生");
    expect(prompt.stable).toContain("不得預設學生一人一機");
    expect(prompt.dynamic).toContain("3–5 人小組");
    expect(prompt.dynamic).toContain("校內低科技替代方案");
    expect(prompt.dynamic).toContain("沿用既有教案的資料判讀目標");
  });

  it("rejects invented success criteria and invalid lesson sequencing", () => {
    const desiredResults = buildDesiredResults(ALIGNMENT);
    const invalidEvidence = structuredClone(RAW_EVIDENCE);
    invalidEvidence.evidenceItems[0].criterionIds = ["success-99"];
    expect(() =>
      parseEvidencePlan(
        JSON.stringify(invalidEvidence),
        "gpt-4.1",
        desiredResults,
      ),
    ).toThrow("未知 ID");

    const evidencePlan = parseEvidencePlan(
      JSON.stringify(RAW_EVIDENCE),
      "gpt-4.1",
      desiredResults,
    );
    const invalidBlueprint = structuredClone(RAW_BLUEPRINT);
    invalidBlueprint.lessons[0].evidenceItemIds = ["evidence-formative-1"];
    expect(() =>
      parseUnitBlueprint(
        JSON.stringify(invalidBlueprint),
        "gpt-4.1",
        desiredResults,
        evidencePlan,
        CONSTRAINTS,
        "C2-P1",
      ),
    ).toThrow("第一節必須連結課前診斷證據");
  });

  it("enforces the controlled Q1–Q4 map and unique evidence IDs", () => {
    const desiredResults = buildDesiredResults(ALIGNMENT);
    const invalidQuestionMap = structuredClone(RAW_EVIDENCE);
    invalidQuestionMap.questionMaps[1].questions[1].focus =
      "conceptual_understanding";
    expect(() =>
      parseEvidencePlan(
        JSON.stringify(invalidQuestionMap),
        "gpt-4.1",
        desiredResults,
      ),
    ).toThrow("順序或能力焦點不合法");

    const evidencePlan = parseEvidencePlan(
      JSON.stringify(RAW_EVIDENCE),
      "gpt-4.1",
      desiredResults,
    );
    evidencePlan.evidenceItems[1].id = evidencePlan.evidenceItems[0].id;
    expect(validateEvidencePlanResult(evidencePlan, desiredResults)[0]).toContain(
      "ID 不得空白或重複",
    );
  });

  it("validates success-criterion coverage and the required lesson evidence order", () => {
    const desiredResults = buildDesiredResults(ALIGNMENT);
    const evidencePlan = parseEvidencePlan(
      JSON.stringify(RAW_EVIDENCE),
      "gpt-4.1",
      desiredResults,
    );
    const blueprint = parseUnitBlueprint(
      JSON.stringify(RAW_BLUEPRINT),
      "gpt-4.1",
      desiredResults,
      evidencePlan,
      CONSTRAINTS,
      "C2-P1",
    );
    blueprint.lessons[0].criterionIds = ["success-1"];
    blueprint.lessons[1].criterionIds = ["success-1"];
    blueprint.lessons[2].criterionIds = ["success-1"];
    expect(
      validateUnitBlueprintResult(
        blueprint,
        desiredResults,
        evidencePlan,
        CONSTRAINTS,
        "C2-P1",
      )[0],
    ).toContain("未完整涵蓋成功指標");
  });

  it("fills the controlled primary 6Cs ID when Gemini omits it", () => {
    const desiredResults = buildDesiredResults(ALIGNMENT);
    const evidencePlan = parseEvidencePlan(
      JSON.stringify(RAW_EVIDENCE),
      "gpt-4.1",
      desiredResults,
    );
    const missingPrimaryIndicator = structuredClone(RAW_BLUEPRINT);
    delete (
      missingPrimaryIndicator.lessons[0] as {
        primaryIndicatorId?: string;
      }
    ).primaryIndicatorId;
    for (const field of [
      "lessonNumber",
      "minutes",
      "title",
      "milestone",
      "learningIntention",
      "coreTask",
      "formativeCheck",
      "decisionRule",
      "previousConnection",
      "nextConnection",
    ]) {
      delete (
        missingPrimaryIndicator.lessons[0] as unknown as Record<
          string,
          unknown
        >
      )[field];
    }
    missingPrimaryIndicator.lessons[0].outcomeIds = [];
    missingPrimaryIndicator.lessons[0].criterionIds = [];
    missingPrimaryIndicator.lessons[0].evidenceItemIds = [];
    missingPrimaryIndicator.lessons[0].fourElementNames = [];
    delete (
      missingPrimaryIndicator as unknown as {
        unitArc?: string;
      }
    ).unitArc;

    const parsed = parseUnitBlueprint(
      JSON.stringify(missingPrimaryIndicator),
      "gemini-2.5-flash",
      desiredResults,
      evidencePlan,
      CONSTRAINTS,
      "C2-P1",
    );
    expect(parsed.lessons[0].primaryIndicatorId).toBe("C2-P1");
    expect(parsed.lessons[0].lessonNumber).toBe(1);
    expect(parsed.lessons[0].minutes).toBe(CONSTRAINTS.minutesPerLesson);
    expect(parsed.lessons[0].outcomeIds).toEqual(["knowledge-foundation"]);
    expect(parsed.lessons[0].criterionIds).toEqual(["success-1", "success-2"]);
    expect(parsed.lessons[0].evidenceItemIds).toEqual([
      "evidence-diagnostic-1",
    ]);
    expect(parsed.lessons[0].fourElementNames).toEqual(["學習環境"]);
    expect(parsed.lessons[0].milestone).toContain("課前 Q1–Q4");
    expect(parsed.lessons[0].learningIntention).toContain("極端氣候");
    expect(parsed.lessons[0].decisionRule).toContain("三分之一");
    expect(parsed.unitArc).toContain("倡議簡報");

    const stringWrapped = parseUnitBlueprint(
      JSON.stringify(JSON.stringify(RAW_BLUEPRINT)),
      "gemini-2.5-flash",
      desiredResults,
      evidencePlan,
      CONSTRAINTS,
      "C2-P1",
    );
    expect(stringWrapped.lessons).toHaveLength(CONSTRAINTS.totalLessons);

    const inventedPrimaryIndicator = structuredClone(RAW_BLUEPRINT);
    inventedPrimaryIndicator.lessons[0].primaryIndicatorId = "C9-UNKNOWN";
    expect(() =>
      parseUnitBlueprint(
        JSON.stringify(inventedPrimaryIndicator),
        "gemini-2.5-flash",
        desiredResults,
        evidencePlan,
        CONSTRAINTS,
        "C2-P1",
      ),
    ).toThrow("錯誤的 6Cs 子向度 ID");
  });

  it("builds a controlled Canvas prompt and blocks stale projects", () => {
    const project = createProject();
    const promptPackage = buildLessonPromptPackage(
      project,
      "lesson-2",
      1_700_000_200_000,
    );

    expect(promptPackage.target).toBe("gemini_canvas");
    expect(promptPackage.fullPrompt).toContain("第 2 節｜用資料支持判斷");
    expect(promptPackage.fullPrompt).toContain("地1c-Ⅴ-1");
    expect(promptPackage.fullPrompt).toContain("success-1");
    expect(promptPackage.fullPrompt).toContain("50");
    expect(promptPackage.fullPrompt).not.toContain("notebooklm.google.com");
    expect(promptPackage.fullPrompt).not.toContain("API Key");
    expect(promptPackage.fullPrompt).toBe(
      `${promptPackage.gemInstructions}\n\n${promptPackage.lessonTaskPrompt}`,
    );

    const unitPromptPackage = buildUnitPromptPackage(
      project,
      1_700_000_200_000,
    );
    expect(unitPromptPackage.lessonId).toBe("unit-all");
    expect(unitPromptPackage.fullPrompt).toContain(
      "一次完成資料中列出的全部節次",
    );
    expect(unitPromptPackage.fullPrompt).toContain('"lessonNumber": 1');
    expect(unitPromptPackage.fullPrompt).toContain('"lessonNumber": 2');
    expect(unitPromptPackage.fullPrompt).toContain('"lessonNumber": 3');
    expect(unitPromptPackage.fullPrompt).toContain("完整單元逐節教案");
    expect(unitPromptPackage.fullPrompt).toContain("每節學生學習單");
    expect(unitPromptPackage.fullPrompt).toContain(
      '"heading": "A. 知識基礎"',
    );
    expect(unitPromptPackage.fullPrompt).toContain(
      '"heading": "B. NPDL 子向度思考"',
    );
    expect(unitPromptPackage.fullPrompt).toContain('"officialProgression"');
    expect(
      unitPromptPackage.fullPrompt.match(/"heading": "A\. 知識基礎"/g),
    ).toHaveLength(3);
    expect(unitPromptPackage.fullPrompt).toContain("學生學習單與教師判讀指引");
    expect(unitPromptPackage.fullPrompt).toContain("低科技替代路徑");
    expect(unitPromptPackage.fullPrompt).toContain(
      "未指定物理、化學、生物或地球科學實驗室",
    );
    expect(unitPromptPackage.fullPrompt).not.toContain("notebooklm.google.com");

    const staleProject: LearningDesignProjectV1 = {
      ...project,
      alignmentAudit: { ...project.alignmentAudit, evidencePlan: "stale" },
    };
    expect(() =>
      buildLessonPromptPackage(staleProject, "lesson-2"),
    ).toThrow("必須完成校準");

    expect(() =>
      buildLessonPromptPackage(
        { ...project, unitBlueprintConfirmedAt: null },
        "lesson-2",
      ),
    ).toThrow("必須完成校準");
  });

  it("provides the assessment studio with the full backward-design context", () => {
    const project = createProject();
    expect(isValidLearningDesignProject(project)).toBe(true);
    const context = buildAssessmentDesignContext(project);
    expect(context?.projectId).toBe(project.id);
    expect(context?.curriculum).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "5730-7406-performance-1c-v-1" }),
        expect.objectContaining({ id: "5730-7406-content-ia-v-2" }),
      ]),
    );
    expect(context?.successCriteria).toHaveLength(2);
    expect(context?.performanceTask?.product).toContain("倡議簡報");
    expect(context?.questionMaps).toHaveLength(2);
    expect(context?.questionMaps[1].transferDifference).toContain("預算限制");
    expect(context?.evidenceItems).toHaveLength(4);
    const contextWithReference = buildAssessmentDesignContext({
      ...project,
      appliedLessonReference: {
        learningGoals: ["資料判讀目標"],
        reusableActivities: ["校園踏查"],
        assessmentIdeas: [],
        resources: ["每組一台共用平板"],
        constraints: [],
        differentiationSupports: [],
      },
    });
    expect(contextWithReference?.lessonReference?.learningGoals).toEqual([
      "資料判讀目標",
    ]);
    expect(
      buildAssessmentDesignContext({
        ...project,
        evidencePlanConfirmedAt: null,
      }),
    ).toBeNull();

    const prompt = buildStructuredGeneratePrompt(
      {
        grade: "高一",
        subject: "地理",
        source: "資料庫",
        indicatorId: "C2-P1",
        customIndicator: "",
        activityName: "全球氣候變遷",
        lifeKeywords: "極端氣候、數據證據",
        tools: "資料判讀表",
      },
      null,
      undefined,
      context,
    );
    expect(prompt.dynamic).toContain("逆向設計專案脈絡");
    expect(prompt.dynamic).toContain("success-1");
    expect(prompt.dynamic).toContain("地1c-Ⅴ-1");
    expect(prompt.dynamic).toContain("guided_response");
  });
});
