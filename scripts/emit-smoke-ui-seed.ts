/**
 * Emits a localStorage seed for scripts/smoke-ui.mjs so the single-flow
 * CoursePostAssessmentPanel opens with a complete assessment document.
 *
 * Usage: npx vite-node scripts/emit-smoke-ui-seed.ts
 */
import {
  buildAssessmentQuestionAlignments,
  buildCourseAssessmentSourceFingerprint,
} from "../src/lib/course-assessment";
import {
  buildDesiredResults,
  parseEvidencePlan,
  parseUnitBlueprint,
} from "../src/lib/learning-design";
import { TEST_ASSESSMENT_DOCUMENT } from "../src/test/assessment-fixture";
import type {
  CourseAlignmentResult,
  CourseIdeationInput,
  KeywordAnalysisResult,
  LearningDesignProjectV1,
  UnitConstraints,
} from "../src/types/course-ideation";

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

const ANALYSIS: KeywordAnalysisResult = {
  summary: "以校園氣候資料與調適倡議串起探究與證據判斷。",
  themes: [
    {
      label: "氣候風險",
      keywords: ["極端氣候", "校園熱島"],
      interpretation: "現象與影響",
    },
    {
      label: "證據判斷",
      keywords: ["數據證據", "小組倡議"],
      interpretation: "資料比較與溝通",
    },
  ],
  curriculumSignals: ["地理探究", "氣候變遷"],
  suggestedKeywords: ["極端氣候", "校園熱島", "數據證據", "小組倡議"],
  model: "gpt-4.1",
};

const PROJECT_ID = "smoke-ui-project-01";
const NOW = Date.now();

const desiredResults = buildDesiredResults(ALIGNMENT);
const evidencePlanBase = parseEvidencePlan(
  JSON.stringify(RAW_EVIDENCE),
  "gpt-4.1",
  desiredResults,
);
const assessmentDocument = structuredClone(TEST_ASSESSMENT_DOCUMENT);
const evidencePlan = {
  ...evidencePlanBase,
  assessmentDocument,
};
const unitBlueprint = parseUnitBlueprint(
  JSON.stringify(RAW_BLUEPRINT),
  "gpt-4.1",
  desiredResults,
  evidencePlanBase,
  CONSTRAINTS,
  "C2-P1",
);
const sourceFingerprint = buildCourseAssessmentSourceFingerprint({
  course: INPUT,
  selectedIndicatorId: "C2-P1",
  desiredResults,
  evidencePlan,
});
const mappings = buildAssessmentQuestionAlignments(evidencePlanBase);
const courseAssessmentSeed = {
  version: 1 as const,
  generatedAt: NOW,
  model: "gpt-4.1",
  sourceFingerprint,
  narrative: assessmentDocument.narrative,
  pre: assessmentDocument.pre,
  preMappings: mappings.preMappings,
  plannedPostMappings: mappings.plannedPostMappings,
  mode: "ai_generated" as const,
};

const project: LearningDesignProjectV1 = {
  version: 1,
  id: PROJECT_ID,
  createdAt: NOW - 60_000,
  updatedAt: NOW,
  courseOriginMode: "new",
  input: INPUT,
  analysis: ANALYSIS,
  alignment: ALIGNMENT,
  customCurriculumEntries: [],
  selectedIndicatorId: "C2-P1",
  desiredResults,
  desiredResultsConfirmedAt: NOW - 40_000,
  evidencePlan,
  evidencePlanConfirmedAt: NOW - 30_000,
  courseAssessmentSeed,
  unitConstraints: CONSTRAINTS,
  unitBlueprint,
  unitBlueprintConfirmedAt: NOW - 20_000,
  lessonPromptStatus: [],
  alignmentAudit: {
    desiredResults: "current",
    evidencePlan: "current",
    unitBlueprint: "current",
  },
};

const draft = {
  courseOriginMode: "new" as const,
  input: INPUT,
  analysis: ANALYSIS,
  alignment: ALIGNMENT,
  curriculumSelection: ALIGNMENT.curriculumSelection,
  customCurriculumEntries: [],
  selectedIndicatorId: "C2-P1",
  projectId: PROJECT_ID,
  projectCreatedAt: project.createdAt,
  desiredResults,
  desiredResultsConfirmedAt: project.desiredResultsConfirmedAt,
  evidencePlan,
  evidencePlanConfirmedAt: project.evidencePlanConfirmedAt,
  courseAssessmentSeed,
  unitConstraints: CONSTRAINTS,
  unitBlueprint,
  unitBlueprintConfirmedAt: project.unitBlueprintConfirmedAt,
  lessonPromptStatus: [],
  alignmentAudit: project.alignmentAudit,
  savedAt: NOW,
};

process.stdout.write(
  JSON.stringify({
    draft,
    project,
    q4DecisionTask: assessmentDocument.pre.scenarioBlueprint.decisionTask,
  }),
);
