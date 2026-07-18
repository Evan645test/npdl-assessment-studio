export const COURSE_IDEATION_HANDOFF_VERSION = 2 as const;
export const LEARNING_DESIGN_PROJECT_VERSION = 1 as const;
export const LESSON_PROMPT_PACKAGE_VERSION = 1 as const;

export const FOUR_ELEMENT_NAMES = [
  "學習夥伴關係",
  "學習環境",
  "數位利用",
  "教學實踐",
] as const;

export type FourElementName = (typeof FOUR_ELEMENT_NAMES)[number];

export interface CourseIdeationInput {
  grade: string;
  subject: string;
  unitName: string;
  teachingTopic: string;
  coreKeywords: string[];
}

export interface KeywordTheme {
  label: string;
  keywords: string[];
  interpretation: string;
}

export interface KeywordAnalysisResult {
  summary: string;
  themes: KeywordTheme[];
  curriculumSignals: string[];
  suggestedKeywords: string[];
  model: string;
}

export interface AlignmentRecommendation {
  indicatorId: string;
  reason: string;
  matchedKeywords: string[];
}

export interface LearningOutcome {
  statement: string;
  evidence: string;
}

export type CurriculumStage = "IV" | "V";
export type CurriculumKind = "learning_performance" | "learning_content";
export type CurriculumCourseType = "required" | "elective" | "all";

export interface CurriculumEntry {
  id: string;
  domain: string;
  subject: string;
  stage: CurriculumStage;
  kind: CurriculumKind;
  code: string;
  text: string;
  courseType: CurriculumCourseType;
  sourceName: string;
  sourceDocumentTitle: string;
  sourceVersion: string;
}

export interface CurriculumCandidateSet {
  performances: CurriculumEntry[];
  contents: CurriculumEntry[];
}

export interface CurriculumSelection {
  performanceIds: string[];
  contentIds: string[];
  rationale: string;
  mode: "ai_auto" | "teacher_edited";
}

export interface KnowledgeFoundationOutcome extends LearningOutcome {
  successCriteria: string[];
}

export interface FourElementPlan {
  name: FourElementName;
  designMove: string;
  studentEvidence: string;
}

export interface CourseAlignmentResult {
  curriculumSelection: CurriculumSelection;
  backwardDesign: {
    transferGoals: string[];
    enduringUnderstandings: string[];
    essentialQuestions: string[];
  };
  recommendations: AlignmentRecommendation[];
  learningOutcomes: {
    knowledgeFoundation: KnowledgeFoundationOutcome;
    competencySubdimension: LearningOutcome;
    fourElementsPractice: LearningOutcome;
  };
  fourElements: FourElementPlan[];
  evidenceTools: string[];
  model: string;
}

export interface SuccessCriterion {
  id: string;
  text: string;
  outcomeId: "knowledge-foundation";
}

export interface DesiredResults {
  transferGoals: string[];
  enduringUnderstandings: string[];
  essentialQuestions: string[];
  outcomes: Array<{
    id:
      | "knowledge-foundation"
      | "competency-subdimension"
      | "four-elements-practice";
    statement: string;
    evidence: string;
  }>;
  successCriteria: SuccessCriterion[];
}

export type EvidenceType =
  | "diagnostic"
  | "formative"
  | "summative"
  | "transfer";

export interface PerformanceTask {
  goal: string;
  role: string;
  audience: string;
  situation: string;
  product: string;
  criterionIds: string[];
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  criterionIds: string[];
  artifact: string;
  method: string;
  timing: string;
  decisionRule: string;
}

export type EvidenceQuestionId = "Q1" | "Q2" | "Q3" | "Q4";
export type EvidenceQuestionFocus =
  | "conceptual_understanding"
  | "action_application"
  | "life_transfer"
  | "guided_response";

export interface EvidenceQuestionPurpose {
  id: EvidenceQuestionId;
  focus: EvidenceQuestionFocus;
  purpose: string;
  criterionIds: string[];
  observableEvidence: string;
}

export interface EvidenceQuestionMap {
  phase: "pre" | "post";
  sharedProblem: string;
  transferDifference: string;
  questions: EvidenceQuestionPurpose[];
}

export interface RubricLevelSet {
  evidenceLimited: string;
  emerging: string;
  developing: string;
  mastering: string;
}

export interface AcademicRubricCriterion {
  criterionId: string;
  levels: RubricLevelSet;
}

export interface EvidencePlanResult {
  performanceTask: PerformanceTask;
  questionMaps: EvidenceQuestionMap[];
  evidenceItems: EvidenceItem[];
  rubric: AcademicRubricCriterion[];
  assessmentDocument: import("./index").AssessmentDocument | null;
  mode: "ai_generated" | "teacher_edited";
  model: string;
}

export interface UnitConstraints {
  totalLessons: number;
  minutesPerLesson: number;
  requiredActivities: string;
  equipmentConstraints: string;
  priorExperience: string;
  differentiationNeeds: string;
}

export interface UnitLessonBlueprint {
  id: string;
  lessonNumber: number;
  title: string;
  minutes: number;
  milestone: string;
  outcomeIds: DesiredResults["outcomes"][number]["id"][];
  criterionIds: string[];
  evidenceItemIds: string[];
  learningIntention: string;
  coreTask: string;
  formativeCheck: string;
  decisionRule: string;
  primaryIndicatorId: string;
  fourElementNames: FourElementName[];
  previousConnection: string;
  nextConnection: string;
}

export interface UnitBlueprintResult {
  unitArc: string;
  lessons: UnitLessonBlueprint[];
  mode: "ai_generated" | "teacher_edited";
  model: string;
}

export type WorkflowState = "empty" | "current" | "stale";

export interface LessonPromptStatus {
  lessonId: string;
  promptVersion: typeof LESSON_PROMPT_PACKAGE_VERSION;
  lastCopiedAt?: number;
  generatedExternally: boolean;
}

export interface LearningDesignProjectV1 {
  version: typeof LEARNING_DESIGN_PROJECT_VERSION;
  id: string;
  createdAt: number;
  updatedAt: number;
  input: CourseIdeationInput;
  analysis: KeywordAnalysisResult | null;
  alignment: CourseAlignmentResult | null;
  customCurriculumEntries: CurriculumEntry[];
  selectedIndicatorId: string;
  desiredResults: DesiredResults | null;
  desiredResultsConfirmedAt: number | null;
  evidencePlan: EvidencePlanResult | null;
  evidencePlanConfirmedAt: number | null;
  unitConstraints: UnitConstraints;
  unitBlueprint: UnitBlueprintResult | null;
  unitBlueprintConfirmedAt: number | null;
  lessonPromptStatus: LessonPromptStatus[];
  alignmentAudit: {
    desiredResults: WorkflowState;
    evidencePlan: WorkflowState;
    unitBlueprint: WorkflowState;
  };
}

export interface LessonPromptPackage {
  version: typeof LESSON_PROMPT_PACKAGE_VERSION;
  projectId: string;
  lessonId: string;
  target: "gemini_canvas";
  generatedAt: number;
  fullPrompt: string;
  gemInstructions: string;
  lessonTaskPrompt: string;
}

export interface AssessmentDesignContext {
  projectId: string;
  curriculum: Array<{
    id: string;
    code: string;
    text: string;
    kind: CurriculumKind;
  }>;
  transferGoals: string[];
  enduringUnderstandings: string[];
  essentialQuestions: string[];
  outcomes: DesiredResults["outcomes"];
  successCriteria: SuccessCriterion[];
  performanceTask: PerformanceTask | null;
  questionMaps: EvidenceQuestionMap[];
  evidenceItems: EvidenceItem[];
}

export interface LegacyCourseIdeationHandoff {
  version: 1;
  createdAt: number;
  input: CourseIdeationInput;
  selectedIndicatorId: string;
  evidenceTools: string[];
}

export interface CurrentCourseIdeationHandoff {
  version: typeof COURSE_IDEATION_HANDOFF_VERSION;
  createdAt: number;
  projectId: string;
  input: CourseIdeationInput;
  selectedIndicatorId: string;
  evidenceTools: string[];
}

export type CourseIdeationHandoff =
  | LegacyCourseIdeationHandoff
  | CurrentCourseIdeationHandoff;
