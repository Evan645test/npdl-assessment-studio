export const COURSE_IDEATION_HANDOFF_VERSION = 1 as const;

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

export interface FourElementPlan {
  name: FourElementName;
  designMove: string;
  studentEvidence: string;
}

export interface CourseAlignmentResult {
  recommendations: AlignmentRecommendation[];
  learningOutcomes: {
    knowledgeFoundation: LearningOutcome;
    competencySubdimension: LearningOutcome;
    fourElementsPractice: LearningOutcome;
  };
  fourElements: FourElementPlan[];
  evidenceTools: string[];
  model: string;
}

export interface CourseIdeationHandoff {
  version: typeof COURSE_IDEATION_HANDOFF_VERSION;
  createdAt: number;
  input: CourseIdeationInput;
  selectedIndicatorId: string;
  evidenceTools: string[];
}
