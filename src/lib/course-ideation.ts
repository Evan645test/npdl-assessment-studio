import { INDICATORS, getIndicatorById } from "@/data/indicators";
import type { GenerationPromptParts } from "@/lib/ai/client";
import type { CourseForm } from "@/types";
import {
  buildTaiwanHighSchoolLabPrompt,
  TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT,
} from "@/lib/taiwan-high-school-context";
import {
  COURSE_IDEATION_HANDOFF_VERSION,
  FOUR_ELEMENT_NAMES,
  type AppliedLessonReference,
  type CourseAlignmentResult,
  type CourseIdeationHandoff,
  type CourseIdeationInput,
  type CurrentCourseIdeationHandoff,
  type CurriculumCandidateSet,
  type CurriculumRecommendation,
  type CurriculumSelection,
  type FourElementName,
  type KeywordAnalysisResult,
  type KnowledgeFoundationOutcome,
  type LearningOutcome,
} from "@/types/course-ideation";

const MAX_TEXT_LENGTH = 500;
const HANDOFF_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export const COURSE_IDEATION_RESPONSE_ERROR_MESSAGE =
  "AI 未產生完整的課程分析，請重試或切換模型。";

export class CourseIdeationResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseIdeationResponseError";
  }
}

function responseError(message: string): never {
  throw new CourseIdeationResponseError(message);
}

const fourElementDefinitions: Record<FourElementName, string> = {
  學習夥伴關係:
    "讓學生、教師、家庭、專家與社區成為共同設計者與共同學習者，重新分配發言權、控制權與互動方式。",
  學習環境:
    "同時設計支持歸屬感、冒險、好奇與自主性的學習文化，以及能促進反思、探究與協作的實體或虛擬空間。",
  數位利用:
    "焦點不在工具本身，而在運用數位能力建構知識、協作、創造並分享新知識，擴展課堂內外的學習。",
  教學實踐:
    "選擇最能達成深度學習目標的教學方式，提供適切鷹架、真實任務、探究歷程、回饋與逐步增加的學習責任。",
};

export const KEYWORD_ANALYSIS_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "themes", "curriculumSignals", "suggestedKeywords"],
  properties: {
    summary: { type: "string" },
    themes: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "keywords", "interpretation"],
        properties: {
          label: { type: "string" },
          keywords: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" },
          },
          interpretation: { type: "string" },
        },
      },
    },
    curriculumSignals: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
    suggestedKeywords: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: { type: "string" },
    },
  },
};

const learningOutcomeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["statement", "evidence"],
  properties: {
    statement: { type: "string" },
    evidence: { type: "string" },
  },
};

const knowledgeFoundationOutcomeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["statement", "evidence", "successCriteria"],
  properties: {
    statement: { type: "string" },
    evidence: { type: "string" },
    successCriteria: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: { type: "string" },
    },
  },
};

export const COURSE_ALIGNMENT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "curriculumSelection",
    "curriculumRecommendation",
    "backwardDesign",
    "recommendations",
    "learningOutcomes",
    "fourElements",
    "evidenceTools",
  ],
  properties: {
    curriculumSelection: {
      type: "object",
      additionalProperties: false,
      required: ["performanceIds", "contentIds", "rationale"],
      properties: {
        performanceIds: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: { type: "string" },
        },
        contentIds: {
          type: "array",
          minItems: 2,
          maxItems: 2,
          items: { type: "string" },
        },
        rationale: { type: "string" },
      },
    },
    curriculumRecommendation: {
      type: "object",
      additionalProperties: false,
      required: ["performanceIds", "contentIds", "rationale"],
      properties: {
        performanceIds: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: { type: "string" },
        },
        contentIds: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: { type: "string" },
        },
        rationale: { type: "string" },
      },
    },
    backwardDesign: {
      type: "object",
      additionalProperties: false,
      required: [
        "transferGoals",
        "enduringUnderstandings",
        "essentialQuestions",
      ],
      properties: {
        transferGoals: {
          type: "array",
          minItems: 1,
          maxItems: 2,
          items: { type: "string" },
        },
        enduringUnderstandings: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string" },
        },
        essentialQuestions: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: { type: "string" },
        },
      },
    },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["indicatorId", "reason", "matchedKeywords"],
        properties: {
          indicatorId: { type: "string" },
          reason: { type: "string" },
          matchedKeywords: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" },
          },
        },
      },
    },
    learningOutcomes: {
      type: "object",
      additionalProperties: false,
      required: [
        "knowledgeFoundation",
        "competencySubdimension",
        "fourElementsPractice",
      ],
      properties: {
        knowledgeFoundation: knowledgeFoundationOutcomeSchema,
        competencySubdimension: learningOutcomeSchema,
        fourElementsPractice: learningOutcomeSchema,
      },
    },
    fourElements: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "designMove", "studentEvidence"],
        properties: {
          name: { type: "string", enum: [...FOUR_ELEMENT_NAMES] },
          designMove: { type: "string" },
          studentEvidence: { type: "string" },
        },
      },
    },
    evidenceTools: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
  },
};

export function getCourseAlignmentSchema(
  mode: CurriculumSelection["mode"],
): Record<string, unknown> {
  if (mode === "ai_auto") return COURSE_ALIGNMENT_SCHEMA;

  const rootProperties = COURSE_ALIGNMENT_SCHEMA.properties as Record<
    string,
    unknown
  >;
  const curriculumSelection = rootProperties.curriculumSelection as Record<
    string,
    unknown
  >;
  const curriculumProperties = curriculumSelection.properties as Record<
    string,
    unknown
  >;

  return {
    ...COURSE_ALIGNMENT_SCHEMA,
    properties: {
      ...rootProperties,
      curriculumSelection: {
        ...curriculumSelection,
        properties: {
          ...curriculumProperties,
          performanceIds: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "string" },
          },
          contentIds: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "string" },
          },
        },
      },
    },
  };
}

function uniqueStrings(values: string[], maximum: number): string[] {
  const output: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || output.includes(normalized)) continue;
    output.push(normalized);
    if (output.length >= maximum) break;
  }
  return output;
}

export function normalizeCoreKeywords(values: string[]): string[] {
  return uniqueStrings(values, 5);
}

export function validateCourseIdeationInput(input: CourseIdeationInput): string[] {
  const errors: string[] = [];
  if (!input.grade.trim()) errors.push("請選擇年級。");
  if (!input.subject.trim()) errors.push("請填寫學科。");
  if (input.unitName.trim().length < 2) errors.push("單元名稱至少需要 2 個字。");
  if (input.teachingTopic.trim().length < 2) errors.push("教學主題至少需要 2 個字。");
  const keywords = normalizeCoreKeywords(input.coreKeywords);
  if (keywords.length < 3 || keywords.length > 5) {
    errors.push("核心關鍵字必須為 3–5 個。");
  }
  if (keywords.some((keyword) => keyword.length > 30)) {
    errors.push("每個核心關鍵字不得超過 30 個字。");
  }
  return errors;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) responseError("AI 回應不是有效的 JSON 物件。");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
  } catch {
    responseError("AI 回應不是有效的 JSON 物件。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    responseError("AI 回應不是有效的 JSON 物件。");
  }
  return parsed as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    responseError(`AI 回應缺少 ${field}。`);
  }
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function firstString(
  record: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    const value = optionalString(record[field]);
    if (value) return value;
  }
  return null;
}

function normalizeStringArrayValue(
  value: unknown,
  maximum: number,
): string[] {
  const candidates: string[] = [];
  const append = (item: unknown) => {
    if (typeof item === "string") {
      candidates.push(
        ...item
          .split(/[,，、;；\n]+/)
          .map((part) => part.trim())
          .filter(Boolean),
      );
      return;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const record = item as Record<string, unknown>;
    const text = firstString(record, ["keyword", "label", "name", "text", "value"]);
    if (text) candidates.push(text);
  };

  if (Array.isArray(value)) {
    value.forEach(append);
  } else {
    append(value);
  }
  return uniqueStrings(candidates, maximum);
}

function requiredStringArray(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string[] {
  if ((value === undefined || value === null) && minimum === 0) return [];
  const values = normalizeStringArrayValue(value, maximum);
  if (values.length === 0 && minimum > 0) {
    responseError(`AI 回應缺少 ${field}。`);
  }
  if (values.length < minimum) responseError(`AI 回應的 ${field} 數量不足。`);
  return values;
}

function requiredOutcome(value: unknown, field: string): LearningOutcome {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    responseError(`AI 回應缺少 ${field}。`);
  }
  const record = value as Record<string, unknown>;
  return {
    statement: requiredString(record.statement, `${field}.statement`),
    evidence: requiredString(record.evidence, `${field}.evidence`),
  };
}

function requiredKnowledgeFoundation(
  value: unknown,
  field: string,
): KnowledgeFoundationOutcome {
  const outcome = requiredOutcome(value, field);
  const record = value as Record<string, unknown>;
  return {
    ...outcome,
    successCriteria: requiredTextArray(
      record.successCriteria,
      `${field}.successCriteria`,
      2,
      4,
    ),
  };
}

function requiredTextArray(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string[] {
  if (!Array.isArray(value)) responseError(`AI 回應缺少 ${field}。`);
  if (value.length < minimum || value.length > maximum) {
    responseError(`AI 回應的 ${field} 數量不合法。`);
  }
  const output = value.map((item, index) =>
    requiredString(item, `${field}[${index}]`),
  );
  if (new Set(output).size !== output.length) {
    responseError(`AI 回應的 ${field} 含有重複項目。`);
  }
  return output;
}

function requiredIdArray(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string[] {
  if (!Array.isArray(value)) responseError(`AI 回應缺少 ${field}。`);
  if (value.length < minimum || value.length > maximum) {
    responseError(`AI 回應的 ${field} 數量不合法。`);
  }
  const ids = value.map((item, index) =>
    requiredString(item, `${field}[${index}]`),
  );
  if (new Set(ids).size !== ids.length) {
    responseError(`AI 回應的 ${field} 含有重複 ID。`);
  }
  return ids;
}

function parseCurriculumSelection(
  value: unknown,
  candidates: CurriculumCandidateSet,
  mode: CurriculumSelection["mode"],
): CurriculumSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    responseError("AI 回應缺少 curriculumSelection。");
  }
  const record = value as Record<string, unknown>;
  const performanceIds = requiredIdArray(
    record.performanceIds,
    "curriculumSelection.performanceIds",
    mode === "ai_auto" ? 2 : 1,
    2,
  );
  const contentIds = requiredIdArray(
    record.contentIds,
    "curriculumSelection.contentIds",
    mode === "ai_auto" ? 2 : 1,
    mode === "ai_auto" ? 2 : 3,
  );
  const validateIds = (
    ids: string[],
    allowedIds: Set<string>,
    field: string,
  ) => {
    for (const id of ids) {
      if (!allowedIds.has(id)) {
        responseError(`AI 回應的 ${field} 含有未知或不適用的課綱 ID：${id}。`);
      }
    }
  };
  validateIds(
    performanceIds,
    new Set(candidates.performances.map((entry) => entry.id)),
    "curriculumSelection.performanceIds",
  );
  validateIds(
    contentIds,
    new Set(candidates.contents.map((entry) => entry.id)),
    "curriculumSelection.contentIds",
  );
  return {
    performanceIds,
    contentIds,
    rationale: requiredString(
      record.rationale,
      "curriculumSelection.rationale",
    ),
    mode,
  };
}

function parseCurriculumRecommendation(
  value: unknown,
  candidates: CurriculumCandidateSet,
): CurriculumRecommendation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    responseError("AI 回應缺少 curriculumRecommendation。");
  }
  const record = value as Record<string, unknown>;
  const performanceIds = requiredIdArray(
    record.performanceIds,
    "curriculumRecommendation.performanceIds",
    5,
    5,
  );
  const contentIds = requiredIdArray(
    record.contentIds,
    "curriculumRecommendation.contentIds",
    5,
    5,
  );
  const validateIds = (
    ids: string[],
    allowedIds: Set<string>,
    field: string,
  ) => {
    for (const id of ids) {
      if (!allowedIds.has(id)) {
        responseError(`AI 回應的 ${field} 含有未知或不適用的課綱 ID：${id}。`);
      }
    }
  };
  validateIds(
    performanceIds,
    new Set(candidates.performances.map((entry) => entry.id)),
    "curriculumRecommendation.performanceIds",
  );
  validateIds(
    contentIds,
    new Set(candidates.contents.map((entry) => entry.id)),
    "curriculumRecommendation.contentIds",
  );
  return {
    performanceIds,
    contentIds,
    rationale: requiredString(
      record.rationale,
      "curriculumRecommendation.rationale",
    ),
  };
}

export function parseKeywordAnalysis(
  raw: string,
  model: string,
  fallbackCoreKeywords: string[] = [],
): KeywordAnalysisResult {
  const parsed = parseJsonObject(raw);
  const rawThemes =
    parsed.themes ?? parsed.themeGroups ?? parsed.clusters;
  const themeList = Array.isArray(rawThemes)
    ? rawThemes
    : rawThemes && typeof rawThemes === "object"
      ? Object.values(rawThemes)
      : null;
  if (!themeList) responseError("AI 回應缺少 themes。");

  const controlledKeywords = normalizeCoreKeywords(fallbackCoreKeywords);
  const themes = themeList.slice(0, 4).map((theme, index) => {
    if (!theme || typeof theme !== "object" || Array.isArray(theme)) {
      responseError(`AI 回應的 themes[${index}] 格式錯誤。`);
    }
    const record = theme as Record<string, unknown>;
    const keywords =
      normalizeStringArrayValue(
        record.keywords ??
          record.coreKeywords ??
          record.relatedKeywords ??
          record.matchedKeywords ??
          record.terms,
        5,
      );
    const recoveredKeywords =
      keywords.length > 0 ? keywords : controlledKeywords;
    if (recoveredKeywords.length === 0) {
      responseError(`AI 回應缺少 themes[${index}].keywords。`);
    }
    const interpretation = firstString(
      record,
      [
        "interpretation",
        "description",
        "meaning",
        "rationale",
        "educationalMeaning",
        "insight",
      ],
    );
    if (!interpretation) {
      responseError(`AI 回應缺少 themes[${index}].interpretation。`);
    }
    return {
      label: firstString(record, ["label", "title", "name", "theme"]) ??
        recoveredKeywords[0],
      keywords: recoveredKeywords,
      interpretation,
    };
  });
  if (themes.length < 2) responseError("AI 回應至少需要 2 個關鍵字主題群。");
  const curriculumSignalsValue =
    parsed.curriculumSignals ??
    parsed.alignmentSignals ??
    parsed.competencySignals ??
    parsed.learningSignals ??
    parsed.signals;
  const curriculumSignals = normalizeStringArrayValue(
    curriculumSignalsValue,
    4,
  );
  const recoveredSignals =
    curriculumSignals.length >= 2
      ? curriculumSignals
      : uniqueStrings(
          [
            ...curriculumSignals,
            ...themes.map((theme) => theme.interpretation),
          ],
          4,
        );
  if (recoveredSignals.length < 2) {
    responseError("AI 回應的 curriculumSignals 數量不足。");
  }
  return {
    summary: requiredString(
      parsed.summary ?? parsed.overview ?? parsed.analysisSummary,
      "summary",
    ),
    themes,
    curriculumSignals: recoveredSignals,
    suggestedKeywords: requiredStringArray(
      parsed.suggestedKeywords ?? parsed.additionalKeywords,
      "suggestedKeywords",
      0,
      3,
    ),
    model,
  };
}

export function parseCourseAlignment(
  raw: string,
  model: string,
  candidates: CurriculumCandidateSet,
  selectionMode: CurriculumSelection["mode"] = "ai_auto",
): CourseAlignmentResult {
  const parsed = parseJsonObject(raw);
  const curriculumSelection = parseCurriculumSelection(
    parsed.curriculumSelection,
    candidates,
    selectionMode,
  );
  const curriculumRecommendation = parseCurriculumRecommendation(
    parsed.curriculumRecommendation,
    candidates,
  );
  if (
    selectionMode === "ai_auto" &&
    (!curriculumSelection.performanceIds.every((id) =>
      curriculumRecommendation.performanceIds.includes(id),
    ) ||
      !curriculumSelection.contentIds.every((id) =>
        curriculumRecommendation.contentIds.includes(id),
      ))
  ) {
    responseError("AI 自動採用的課綱 ID 必須包含在 5 項推薦清單中。");
  }
  if (
    !parsed.backwardDesign ||
    typeof parsed.backwardDesign !== "object" ||
    Array.isArray(parsed.backwardDesign)
  ) {
    responseError("AI 回應缺少 backwardDesign。");
  }
  const backwardDesign = parsed.backwardDesign as Record<string, unknown>;
  if (!Array.isArray(parsed.recommendations)) {
    responseError("AI 回應缺少 recommendations。");
  }
  const seenIds = new Set<string>();
  const recommendations = parsed.recommendations
    .slice(0, 2)
    .map((recommendation, index) => {
      if (
        !recommendation ||
        typeof recommendation !== "object" ||
        Array.isArray(recommendation)
      ) {
        responseError(`AI 回應的 recommendations[${index}] 格式錯誤。`);
      }
      const record = recommendation as Record<string, unknown>;
      const indicatorId = requiredString(
        record.indicatorId,
        `recommendations[${index}].indicatorId`,
      );
      if (!getIndicatorById(indicatorId)) {
        responseError(`AI 推薦了不存在的子向度：${indicatorId}。`);
      }
      if (seenIds.has(indicatorId)) {
        responseError(`AI 重複推薦子向度：${indicatorId}。`);
      }
      seenIds.add(indicatorId);
      return {
        indicatorId,
        reason: requiredString(record.reason, `recommendations[${index}].reason`),
        matchedKeywords: requiredStringArray(
          record.matchedKeywords,
          `recommendations[${index}].matchedKeywords`,
          1,
          5,
        ),
      };
    });
  if (recommendations.length < 1) responseError("AI 未推薦任何子向度。");

  if (
    !parsed.learningOutcomes ||
    typeof parsed.learningOutcomes !== "object" ||
    Array.isArray(parsed.learningOutcomes)
  ) {
    responseError("AI 回應缺少 learningOutcomes。");
  }
  const outcomes = parsed.learningOutcomes as Record<string, unknown>;

  if (!Array.isArray(parsed.fourElements) || parsed.fourElements.length !== 4) {
    responseError("AI 回應必須完整包含四個 NPDL 學習設計要素。");
  }
  const seenElements = new Set<FourElementName>();
  const fourElements = parsed.fourElements.map((element, index) => {
    if (!element || typeof element !== "object" || Array.isArray(element)) {
      responseError(`AI 回應的 fourElements[${index}] 格式錯誤。`);
    }
    const record = element as Record<string, unknown>;
    const name = requiredString(record.name, `fourElements[${index}].name`);
    if (!FOUR_ELEMENT_NAMES.includes(name as FourElementName)) {
      responseError(`AI 回應含有未知的學習設計要素：${name}。`);
    }
    if (seenElements.has(name as FourElementName)) {
      responseError(`AI 重複輸出學習設計要素：${name}。`);
    }
    seenElements.add(name as FourElementName);
    return {
      name: name as FourElementName,
      designMove: requiredString(
        record.designMove,
        `fourElements[${index}].designMove`,
      ),
      studentEvidence: requiredString(
        record.studentEvidence,
        `fourElements[${index}].studentEvidence`,
      ),
    };
  });

  return {
    curriculumSelection,
    curriculumRecommendation,
    backwardDesign: {
      transferGoals: requiredTextArray(
        backwardDesign.transferGoals,
        "backwardDesign.transferGoals",
        1,
        2,
      ),
      enduringUnderstandings: requiredTextArray(
        backwardDesign.enduringUnderstandings,
        "backwardDesign.enduringUnderstandings",
        1,
        3,
      ),
      essentialQuestions: requiredTextArray(
        backwardDesign.essentialQuestions,
        "backwardDesign.essentialQuestions",
        1,
        3,
      ),
    },
    recommendations,
    learningOutcomes: {
      knowledgeFoundation: requiredKnowledgeFoundation(
        outcomes.knowledgeFoundation,
        "learningOutcomes.knowledgeFoundation",
      ),
      competencySubdimension: requiredOutcome(
        outcomes.competencySubdimension,
        "learningOutcomes.competencySubdimension",
      ),
      fourElementsPractice: requiredOutcome(
        outcomes.fourElementsPractice,
        "learningOutcomes.fourElementsPractice",
      ),
    },
    fourElements,
    evidenceTools: requiredStringArray(
      parsed.evidenceTools,
      "evidenceTools",
      2,
      5,
    ),
    model,
  };
}

export function buildKeywordAnalysisPrompt(
  input: CourseIdeationInput,
): GenerationPromptParts {
  return {
    stable: `你是精通台灣中學課程與 NPDL 深度學習的課程設計顧問。
任務是把教師提供的 3–5 個核心關鍵字整理成可供後續 6Cs 對齊的結構化分析。
遵循逆向設計：先辨識學生要理解的學科內容、可遷移到真實世界的問題，以及能證明學會的成功表現；此階段不可直接跳到活動清單。
不得虛構課綱條文、不得加入學生姓名或個資、不得把模糊詞包裝成已確認事實。
${TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT}
只輸出符合 JSON Schema 的繁體中文 JSON。`,
    dynamic: `【課程輸入】
- 年級：${input.grade}
- 學科：${input.subject}
- 單元名稱：${input.unitName}
- 教學主題：${input.teachingTopic}
- 核心關鍵字：${normalizeCoreKeywords(input.coreKeywords).join("、")}

${buildTaiwanHighSchoolLabPrompt(input.subject)}

【分析要求】
1. summary：用 2–3 句連結學科學習核心與真實世界問題；真實問題須能縮小成校內、社區公開資料或模擬情境可探究的尺度，不可只重述關鍵字或直接列教學活動。
2. themes：整理 2–4 個主題群，每群指出包含的原始關鍵字與教育意義，並區分內容概念、真實情境、學生行動或預期證據；不得暗示需要未提供的昂貴設備、校外人脈或長期行政協調。
3. curriculumSignals：列出 2–4 個後續對齊 6Cs 的訊號。每項至少包含「在一般高中課堂能完成的可觀察行動」或「能以紙本、口頭、簡報、圖表、草圖或低擬真原型留下的作品／表現」，並至少有一項指向新情境的應用或遷移。
4. suggestedKeywords：只有在能補足明顯缺口時才提供，最多 3 個，不可取代教師原始關鍵字；不得加入會把課程推向昂貴技術、公開競賽或難以取得外部合作的關鍵字。
5. 若原始構想超出台灣高中一般現場，保留其學習目的，但把執行尺度改寫成校內、小組、公開資料、模擬或低科技版本。`,
  };
}

export function buildCourseAlignmentPrompt(
  input: CourseIdeationInput,
  analysis: KeywordAnalysisResult,
  candidates: CurriculumCandidateSet,
  preferredSelection?: CurriculumSelection | null,
  lessonReference?: AppliedLessonReference | null,
  preferredRecommendation?: CurriculumRecommendation | null,
): GenerationPromptParts {
  const catalog = INDICATORS.map((indicator) => ({
    id: indicator.id,
    dimension: indicator.dimension,
    name: indicator.name,
  }));
  return {
    stable: `你是精通 NPDL（New Pedagogies for Deep Learning）的資深課程設計顧問。
請從提供的受控 6Cs 子向度目錄中推薦 1–2 個最適合的子向度，不得建立不存在的 ID。
首次自動校準時，必須從提供的受控 108 課綱候選中各推薦恰好 5 項學習表現與 5 項學習內容，並從每組推薦中採用最相關的 2 項，再進行 6Cs 對齊。教師已調整課綱選擇時，則必須原樣保留教師選擇。只能輸出候選目錄內的完整 ID，不得建立、改寫或猜測 ID。
推薦必須依據學生在任務中要執行的具體認知或實作行為及其可觀察證據；禁止只因主題名稱或關鍵字相似就配對素養。
學習成果必須形成三層遞進：知識基礎 → 素養子向度 → NPDL 學習設計四要素整合實踐。
三層不是三個平行活動：後一層必須運用前一層，並逐步提高學生的責任、獨立性與向真實或新情境遷移的程度。
「四要素」不是 Engage/Explore/Explain/Elaborate 教學循環，也不得稱為 4E。
${TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT}

【NPDL 學習設計四要素定義】
${FOUR_ELEMENT_NAMES.map((name) => `- ${name}：${fourElementDefinitions[name]}`).join("\n")}

只輸出符合 JSON Schema 的繁體中文 JSON。`,
    dynamic: `【課程輸入】
${JSON.stringify(
  {
    grade: input.grade,
    subject: input.subject,
    unitName: input.unitName,
    teachingTopic: input.teachingTopic,
    coreKeywords: normalizeCoreKeywords(input.coreKeywords),
  },
  null,
  2,
)}

【階段一關鍵字分析】
${JSON.stringify(
  {
    summary: analysis.summary,
    themes: analysis.themes,
    curriculumSignals: analysis.curriculumSignals,
  },
  null,
  2,
)}

${lessonReference
  ? `【教師確認採用的既有教案參考｜來源為既有課程 NPDL 轉換】
${JSON.stringify(lessonReference, null, 2)}
只能把這些資料視為可沿用構想或現場限制；不得讓它取代受控課綱或自行補出未提供的事實。輸出須改寫成符合 NPDL 敘述，不可照抄原教案。`
  : ""}

${buildTaiwanHighSchoolLabPrompt(input.subject)}

【受控 108 課綱候選目錄】
${JSON.stringify(
  {
    learningPerformances: candidates.performances.map((entry) => ({
      id: entry.id,
      code: entry.code,
      text: entry.text,
      stage: entry.stage,
      subject: entry.subject,
      courseType: entry.courseType,
      source: entry.sourceDocumentTitle,
    })),
    learningContents: candidates.contents.map((entry) => ({
      id: entry.id,
      code: entry.code,
      text: entry.text,
      stage: entry.stage,
      subject: entry.subject,
      courseType: entry.courseType,
      source: entry.sourceDocumentTitle,
    })),
  },
  null,
  2,
)}

${preferredSelection?.mode === "teacher_edited"
  ? `【教師已調整的課綱選擇】
必須原樣輸出下列 ID，不得替換：
${JSON.stringify(
  {
    performanceIds: preferredSelection.performanceIds,
    contentIds: preferredSelection.contentIds,
  },
  null,
  2,
)}`
  : "【課綱採用方式】\n請依課程輸入與階段一分析，各自建議並採用恰好 2 項最相關的學習表現與 2 項最相關的學習內容。"}

${preferredRecommendation
  ? `【原始 AI 課綱推薦】
curriculumRecommendation 必須原樣保留下列 ID，不得替換：
${JSON.stringify(
  {
    performanceIds: preferredRecommendation.performanceIds,
    contentIds: preferredRecommendation.contentIds,
    rationale: preferredRecommendation.rationale,
  },
  null,
  2,
)}`
  : "【課綱推薦方式】\ncurriculumRecommendation 必須各輸出恰好 5 個互不重複的 learningPerformances ID 與 learningContents ID，並依相關性排序；curriculumSelection 的 2 個 ID 必須來自各自的 5 項推薦清單。"}

【可用 6Cs 子向度目錄】
${JSON.stringify(catalog, null, 2)}

【輸出要求】
1. curriculumRecommendation：學習表現與學習內容各推薦恰好 5 個受控 ID，依相關性排序；rationale 簡要說明整組推薦依據。
2. curriculumSelection：${preferredSelection?.mode === "teacher_edited" ? "原樣輸出教師選擇的 learningPerformances ID 與 learningContents ID" : "從各自 5 項推薦中採用恰好 2 個 learningPerformances ID 與恰好 2 個 learningContents ID"}，rationale 說明所選課綱與單元、關鍵字及預期學生表現的關係。不得抄寫或改寫課綱原文。
3. backwardDesign：transferGoals 寫學生在離開本單元後能獨立遷移的行動；enduringUnderstandings 寫值得長期保留的關係或原理；essentialQuestions 寫可貫穿單元且不能只用單一事實回答的探究問題。
4. recommendations：推薦 1–2 個子向度。每項理由必須完整連結「課程任務 → 學生具體認知或實作行為 → 可觀察證據」，不得只做名詞配對。
5. learningOutcomes：三層各提供一項可觀察、可評量的成果 statement，並提供 evidence。知識基礎須以採用的課綱條目為錨點，另提供 2–4 項 successCriteria；素養子向度回答「學生運用知識能做什麼」；四要素整合實踐回答「學生如何在真實或新情境中整合行動並產出結果」。不得只使用「了解、認識、培養」等無法直接觀察的動詞。
6. fourElements：四個要素各恰好一次，且共同支撐同一個整合實踐成果，不得生成四個互不相干的裝飾性活動。designMove 要說明教師如何安排該要素、如何與至少另一要素連動，以及如何逐步把學習責任交給學生；studentEvidence 要寫學生實際留下的作品、行動、互動或修訂證據。數位利用必須深化知識建構、協作、創造或分享，不可只列工具名稱，且須有紙本或離線替代路徑。
7. evidenceTools：列出 2–5 個能帶入後續評量設計的工具或證據形式，必須可由一般高中教師在正常課時內蒐集與判讀，不得預設付費平台或一人一機。`,
  };
}

export function buildCourseIdeationHandoff(
  input: CourseIdeationInput,
  alignment: CourseAlignmentResult,
  selectedIndicatorId: string,
  projectId: string,
  now = Date.now(),
): CurrentCourseIdeationHandoff {
  if (!alignment.recommendations.some((item) => item.indicatorId === selectedIndicatorId)) {
    throw new Error("所選子向度不在目前推薦結果中。");
  }
  return {
    version: COURSE_IDEATION_HANDOFF_VERSION,
    createdAt: now,
    projectId: requiredString(projectId, "projectId"),
    input: {
      ...input,
      grade: input.grade.trim(),
      subject: input.subject.trim(),
      unitName: input.unitName.trim(),
      teachingTopic: input.teachingTopic.trim(),
      coreKeywords: normalizeCoreKeywords(input.coreKeywords),
    },
    selectedIndicatorId,
    evidenceTools: uniqueStrings(alignment.evidenceTools, 5),
  };
}

export function isValidCourseIdeationHandoff(
  value: unknown,
  now = Date.now(),
): value is CourseIdeationHandoff {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const handoff = value as Partial<CourseIdeationHandoff>;
  if (handoff.version !== 1 && handoff.version !== COURSE_IDEATION_HANDOFF_VERSION) {
    return false;
  }
  if (
    typeof handoff.createdAt !== "number" ||
    !Number.isFinite(handoff.createdAt) ||
    handoff.createdAt > now ||
    now - handoff.createdAt > HANDOFF_MAX_AGE_MS
  ) {
    return false;
  }
  if (!handoff.input || validateCourseIdeationInput(handoff.input).length > 0) return false;
  if (typeof handoff.selectedIndicatorId !== "string" || !getIndicatorById(handoff.selectedIndicatorId)) {
    return false;
  }
  if (
    handoff.version === COURSE_IDEATION_HANDOFF_VERSION &&
    (typeof handoff.projectId !== "string" ||
      !/^[a-z0-9-]{8,100}$/i.test(handoff.projectId))
  ) {
    return false;
  }
  return (
    Array.isArray(handoff.evidenceTools) &&
    handoff.evidenceTools.length >= 2 &&
    handoff.evidenceTools.length <= 5 &&
    handoff.evidenceTools.every(
      (tool) => typeof tool === "string" && tool.trim().length > 0,
    )
  );
}

export function courseIdeationHandoffToForm(
  handoff: CourseIdeationHandoff,
): CourseForm {
  const activityName =
    handoff.input.unitName === handoff.input.teachingTopic
      ? handoff.input.unitName
      : `${handoff.input.unitName}－${handoff.input.teachingTopic}`;
  return {
    grade: handoff.input.grade,
    subject: handoff.input.subject,
    source: "資料庫",
    indicatorId: handoff.selectedIndicatorId,
    customIndicator: "",
    activityName,
    lifeKeywords: handoff.input.coreKeywords.join("、"),
    tools:
      uniqueStrings(handoff.evidenceTools, 5).join("、") ||
      "學習歷程紀錄、同儕回饋、成果發表",
  };
}
