export type ProgressionLevel = "evidence_limited" | "emerging" | "developing" | "mastering";

export type IndicatorSource = "資料庫" | "自訂";

export interface ProgressionLevels {
  evidence_limited: string;
  emerging: string;
  developing: string;
  mastering: string;
}

export interface Indicator {
  id: string;
  dimension: string;
  dimensionDesc: string;
  name: string;
  levels: ProgressionLevels;
}

export interface CourseForm {
  grade: string;
  subject: string;
  source: IndicatorSource;
  indicatorId: string;
  customIndicator: string;
  activityName: string;
  lifeKeywords: string;
  tools: string;
}

export type ModuleTab = 0 | 1 | 2;

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export type RefineType = "progression" | "scenario" | "question";

export interface RefineTarget {
  type: RefineType;
  id: string;
  title: string;
  currentContent: string;
}

export interface ParsedQuestion {
  id: string;
  type: "pre" | "post";
  rawTitle: string;
  text: string;
  options: string[];
  explanation: string;
  rawBlock: string;
}

export interface SavedQuestion extends ParsedQuestion {
  createdAt: number;
  tags?: string[];
}

export interface DraftState {
  form: CourseForm;
  assessmentDocument: AssessmentDocument | null;
  assessmentDesignContext?: import("./course-ideation").AssessmentDesignContext | null;
  /** 只供從 v2 升級的舊草稿使用；新版生成內容一律由 assessmentDocument 衍生。 */
  legacyMarkdown?: string | null;
  activeModuleTab: ModuleTab;
  savedAt: number;
}

export interface LegacyDraftState {
  form: CourseForm;
  generatedMarkdown: string | null;
  activeModuleTab: ModuleTab;
  savedAt: number;
}

export interface IdeationResult {
  lifeKeywords: string[];
  tools: string[];
  model: string;
}

export type AssessmentSection = "narrative" | "pre" | "post";

export type AssessmentTarget =
  | "global"
  | "narrative"
  | "pre.scenario"
  | "pre.q1"
  | "pre.q2"
  | "pre.q3"
  | "pre.q4"
  | "pre.statistics"
  | "post.scenario"
  | "post.q1"
  | "post.q2"
  | "post.q3"
  | "post.q4"
  | "post.statistics";

export interface NarrativeLevelDocument {
  classroomBehavior: string;
  verbalExpression: string;
  lifeProjection: string;
  motivationMonologue: string;
  emotionalPain: string;
  keyActivity: string;
  scaffold: string;
  teacherDialogue: string;
}

export interface NarrativeDocument {
  evidenceLimited: NarrativeLevelDocument;
  emerging: NarrativeLevelDocument;
  developing: NarrativeLevelDocument;
  mastering: NarrativeLevelDocument;
}

export interface AssessmentChoiceDocument {
  text: string;
  rationale: string;
}

export interface AssessmentQuestionDocument {
  stem: string;
  options: [
    AssessmentChoiceDocument,
    AssessmentChoiceDocument,
    AssessmentChoiceDocument,
    AssessmentChoiceDocument,
  ];
}

export interface ScenarioEvidenceDocument {
  label: string;
  detail: string;
}

export interface ScenarioBlueprintDocument {
  setting: string;
  contextFacts:
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string];
  evidenceA: ScenarioEvidenceDocument;
  evidenceB: ScenarioEvidenceDocument;
  conflict: string;
  decisionTask: string;
  observationFocus: [string, string] | [string, string, string];
  constraint: string;
}

export interface AssessmentOpenQuestionDocument {
  evidenceLimited: string;
  emerging: string;
  developing: string;
  mastering: string;
  studentExamples: {
    evidenceLimited: string;
    emerging: string;
    developing: string;
    mastering: string;
  };
  /**
   * 課後 Q4 的教師概念理解註記。舊草稿與課前資料可沒有此欄位；
   * 新版結構化生成會要求課後模組完整提供。
   */
  conceptAnnotations?: {
    correct: string;
    partial: string;
    misconception: string;
  };
  /**
   * 課後 Q4 的教師生活遷移註記。此註記只供人工對照，
   * 不代表系統已自動評分學生答案。
   */
  transferAnnotations?: {
    notYet: string;
    emerging: string;
    adaptive: string;
  };
}

export interface AssessmentModuleDocument {
  scenarioBlueprint: ScenarioBlueprintDocument;
  q1: AssessmentQuestionDocument;
  q2: AssessmentQuestionDocument;
  q3: AssessmentQuestionDocument;
  q4: AssessmentOpenQuestionDocument;
  statistics: string;
}

export interface AssessmentDocument {
  narrative: NarrativeDocument;
  pre: AssessmentModuleDocument;
  post: AssessmentModuleDocument;
}

export type AssessmentPatch = Partial<{
  narrative: NarrativeDocument;
  pre: Partial<AssessmentModuleDocument>;
  post: Partial<AssessmentModuleDocument>;
}>;

export type GenerationPhase =
  | "connecting"
  | "narrative"
  | "pre"
  | "post"
  | "rendering"
  | "validating"
  | "repairing";

export interface GenerationProgress {
  phase: GenerationPhase;
  receivedChars: number;
  completedSections: AssessmentSection[];
}
