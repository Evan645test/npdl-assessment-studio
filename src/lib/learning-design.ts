import {
  FOUR_ELEMENT_NAMES,
  type AppliedLessonReference,
  type AssessmentDesignContext,
  type CourseAlignmentResult,
  type CourseAssessmentSeedV1,
  type CourseIdeationInput,
  type DesiredResults,
  type EvidenceItem,
  type EvidencePlanResult,
  type EvidenceQuestionFocus,
  type EvidenceQuestionMap,
  type EvidenceType,
  LEARNING_DESIGN_PROJECT_VERSION,
  LESSON_PROMPT_PACKAGE_VERSION,
  type LearningDesignProjectV1,
  type LessonPromptPackage,
  type UnitBlueprintResult,
  type UnitConstraints,
  type UnitLessonBlueprint,
} from "@/types/course-ideation";
import { getCurriculumEntry } from "@/lib/curriculum";
import { getIndicatorById } from "@/data/indicators";
import { CourseIdeationResponseError, sanitizeGeneratedText } from "@/lib/course-ideation";
import type { GenerationPromptParts } from "@/lib/ai/client";
import {
  buildTaiwanHighSchoolLabPrompt,
  TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT,
} from "@/lib/taiwan-high-school-context";
import {
  buildAssessmentDesignSourceFingerprint,
  buildCourseAssessmentSourceFingerprint,
} from "@/lib/course-assessment";

const MAX_TEXT_LENGTH = 800;
const OUTCOME_IDS = [
  "knowledge-foundation",
  "competency-subdimension",
  "four-elements-practice",
] as const;
const EVIDENCE_TYPES: EvidenceType[] = [
  "diagnostic",
  "formative",
  "summative",
  "transfer",
];
const QUESTION_FOCUS_BY_ID = {
  Q1: "conceptual_understanding",
  Q2: "action_application",
  Q3: "life_transfer",
  Q4: "guided_response",
} as const satisfies Record<string, EvidenceQuestionFocus>;

export const DEFAULT_UNIT_CONSTRAINTS: UnitConstraints = {
  totalLessons: 6,
  minutesPerLesson: 50,
  requiredActivities: "",
  equipmentConstraints: "",
  priorExperience: "",
  differentiationNeeds: "",
};

export const EVIDENCE_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["performanceTask", "questionMaps", "evidenceItems", "rubric"],
  properties: {
    performanceTask: {
      type: "object",
      additionalProperties: false,
      required: [
        "goal",
        "role",
        "audience",
        "situation",
        "product",
        "criterionIds",
      ],
      properties: {
        goal: { type: "string" },
        role: { type: "string" },
        audience: { type: "string" },
        situation: { type: "string" },
        product: { type: "string" },
        criterionIds: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
      },
    },
    questionMaps: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "phase",
          "sharedProblem",
          "transferDifference",
          "questions",
        ],
        properties: {
          phase: { type: "string", enum: ["pre", "post"] },
          sharedProblem: { type: "string" },
          transferDifference: { type: "string" },
          questions: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "id",
                "focus",
                "purpose",
                "criterionIds",
                "observableEvidence",
              ],
              properties: {
                id: { type: "string", enum: ["Q1", "Q2", "Q3", "Q4"] },
                focus: {
                  type: "string",
                  enum: [
                    "conceptual_understanding",
                    "action_application",
                    "life_transfer",
                    "guided_response",
                  ],
                },
                purpose: { type: "string" },
                criterionIds: {
                  type: "array",
                  minItems: 1,
                  maxItems: 4,
                  items: { type: "string" },
                },
                observableEvidence: { type: "string" },
              },
            },
          },
        },
      },
    },
    evidenceItems: {
      type: "array",
      minItems: 4,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "title",
          "criterionIds",
          "artifact",
          "method",
          "timing",
          "decisionRule",
        ],
        properties: {
          type: { type: "string", enum: EVIDENCE_TYPES },
          title: { type: "string" },
          criterionIds: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" },
          },
          artifact: { type: "string" },
          method: { type: "string" },
          timing: { type: "string" },
          decisionRule: { type: "string" },
        },
      },
    },
    rubric: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["criterionId", "levels"],
        properties: {
          criterionId: { type: "string" },
          levels: {
            type: "object",
            additionalProperties: false,
            required: [
              "evidenceLimited",
              "emerging",
              "developing",
              "mastering",
            ],
            properties: {
              evidenceLimited: { type: "string" },
              emerging: { type: "string" },
              developing: { type: "string" },
              mastering: { type: "string" },
            },
          },
        },
      },
    },
  },
};

export const UNIT_BLUEPRINT_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["unitArc", "lessons"],
  properties: {
    unitArc: { type: "string" },
    lessons: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "lessonNumber",
          "title",
          "minutes",
          "milestone",
          "outcomeIds",
          "criterionIds",
          "evidenceItemIds",
          "learningIntention",
          "coreTask",
          "formativeCheck",
          "decisionRule",
          "primaryIndicatorId",
          "fourElementNames",
          "previousConnection",
          "nextConnection",
        ],
        properties: {
          lessonNumber: { type: "integer", minimum: 1, maximum: 20 },
          title: { type: "string" },
          minutes: { type: "integer", minimum: 20, maximum: 120 },
          milestone: { type: "string" },
          outcomeIds: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string", enum: OUTCOME_IDS },
          },
          criterionIds: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" },
          },
          evidenceItemIds: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string" },
          },
          learningIntention: { type: "string" },
          coreTask: { type: "string" },
          formativeCheck: { type: "string" },
          decisionRule: { type: "string" },
          primaryIndicatorId: { type: "string" },
          fourElementNames: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: { type: "string", enum: FOUR_ELEMENT_NAMES },
          },
          previousConnection: { type: "string" },
          nextConnection: { type: "string" },
        },
      },
    },
  },
};

function responseError(message: string): never {
  throw new CourseIdeationResponseError(message);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const normalize = (value: string) =>
    value
      .replace(/^\uFEFF/, "")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  const candidates = [normalize(raw)];

  try {
    const outer = JSON.parse(candidates[0]) as unknown;
    if (typeof outer === "string" && outer.trim()) {
      candidates.push(normalize(outer));
    } else if (outer && typeof outer === "object" && !Array.isArray(outer)) {
      return outer as Record<string, unknown>;
    }
  } catch {
    // 下一步會從前後說明文字中擷取 JSON 物件。
  }

  for (const candidate of candidates) {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // 繼續嘗試下一個候選格式。
    }
  }
  responseError("AI 回應不是有效的 JSON 物件。");
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    responseError(`AI 回應缺少 ${field}。`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    responseError(`AI 回應缺少 ${field}。`);
  }
  return value.trim().slice(0, MAX_TEXT_LENGTH);
}

function stringOrControlledFallback(
  value: unknown,
  field: string,
  fallback: string,
): string {
  if (value === undefined || value === null || value === "") {
    return requiredString(fallback, field);
  }
  return requiredString(value, field);
}

function requiredInteger(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    responseError(`AI 回應的 ${field} 不合法。`);
  }
  return value;
}

function requiredStringArray(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): string[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) {
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

function stringArrayOrControlledFallback(
  value: unknown,
  field: string,
  fallback: string[],
  minimum: number,
  maximum: number,
): string[] {
  if (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return requiredStringArray(fallback, field, minimum, maximum);
  }
  return requiredStringArray(value, field, minimum, maximum);
}

function validateControlledIds(
  ids: string[],
  allowed: Set<string>,
  field: string,
): void {
  for (const id of ids) {
    if (!allowed.has(id)) responseError(`AI 回應的 ${field} 含有未知 ID：${id}。`);
  }
}

export function buildDesiredResults(
  alignment: CourseAlignmentResult,
): DesiredResults {
  const sanitizeOutcome = <T extends { statement: string; evidence: string }>(
    outcome: T,
  ): T => ({
    ...outcome,
    statement: sanitizeGeneratedText(outcome.statement).slice(0, 500),
    evidence: sanitizeGeneratedText(outcome.evidence).slice(0, 500),
  });
  const knowledgeFoundation = sanitizeOutcome(
    alignment.learningOutcomes.knowledgeFoundation,
  );
  const competencySubdimension = sanitizeOutcome(
    alignment.learningOutcomes.competencySubdimension,
  );
  const fourElementsPractice = sanitizeOutcome(
    alignment.learningOutcomes.fourElementsPractice,
  );
  return {
    transferGoals: [...alignment.backwardDesign.transferGoals],
    enduringUnderstandings: [...alignment.backwardDesign.enduringUnderstandings],
    essentialQuestions: [...alignment.backwardDesign.essentialQuestions],
    outcomes: [
      {
        id: "knowledge-foundation",
        statement: knowledgeFoundation.statement,
        evidence: knowledgeFoundation.evidence,
      },
      {
        id: "competency-subdimension",
        statement: competencySubdimension.statement,
        evidence: competencySubdimension.evidence,
      },
      {
        id: "four-elements-practice",
        statement: fourElementsPractice.statement,
        evidence: fourElementsPractice.evidence,
      },
    ],
    successCriteria: knowledgeFoundation.successCriteria.map(
      (text, index) => ({
        id: `success-${index + 1}`,
        text: sanitizeGeneratedText(text).slice(0, 500),
        outcomeId: "knowledge-foundation" as const,
      }),
    ),
  };
}

export function buildEvidencePlanPrompt(
  input: CourseIdeationInput,
  alignment: CourseAlignmentResult,
  selectedIndicatorId: string,
  lessonReference?: AppliedLessonReference | null,
): GenerationPromptParts {
  const desiredResults = buildDesiredResults(alignment);
  const indicator = getIndicatorById(selectedIndicatorId);
  return {
    stable: `你是精通逆向設計、台灣 108 課綱與 NPDL 的評量設計顧問。
任務是先決定可接受的學習證據，再讓後續教學活動服務這些證據。
只能使用提供的成功指標 ID，不得建立新 ID。
學科成功指標規準與 6Cs 官方進程必須分開，不得混成單一分數。
課前診斷不得洩漏尚未教過的課程答案；課後遷移必須更換情境。
${TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT}
只輸出符合 JSON Schema 的繁體中文 JSON。`,
    dynamic: `【課程】
${JSON.stringify(input, null, 2)}

${lessonReference
  ? `【教師確認採用的既有教案參考｜來源為既有課程 NPDL 轉換】
${JSON.stringify(lessonReference, null, 2)}
只能沿用其中可行的活動、評量構想、資源、限制與差異化支持；不得取代成功指標或受控課綱。輸出須改寫成符合 NPDL 與逆向設計的敘述，不可照抄原教案活動清單。

`
  : ""}
${buildTaiwanHighSchoolLabPrompt(input.subject)}

【已確認學習終點】
${JSON.stringify(desiredResults, null, 2)}

【主要 6Cs 子向度】
${JSON.stringify(
  indicator
    ? {
        id: indicator.id,
        dimension: indicator.dimension,
        name: indicator.name,
        levels: indicator.levels,
      }
    : { id: selectedIndicatorId },
  null,
  2,
)}

【NPDL 四要素設計】
${JSON.stringify(alignment.fourElements, null, 2)}

【輸出要求】
1. performanceTask：用真實問題設計目標、角色、受眾、情境、成果，criterionIds 必須涵蓋全部成功指標。預設受眾是同儕、其他班級、教師或校內行政，成果須能由 3–5 人小組在正常課時內，以一般教室、紙筆、投影及少量共用裝置完成；不得把「真實」誤寫成必須對外公開、邀請專家、取得政府或企業回覆。若需特殊設備、網路或外部合作，情境與成果內必須明寫可達成相同成功指標的校內低科技替代方案。
2. questionMaps：恰好包含 pre、post 兩組，每組依序提供 Q1–Q4。focus 固定為 Q1 conceptual_understanding、Q2 action_application、Q3 life_transfer、Q4 guided_response。只規劃目的與可觀察證據，不得撰寫正式題目。post.transferDifference 必須說明相較課前新增的資料、限制或情境。
3. evidenceItems：提供 4–8 筆，至少各有一筆 diagnostic、formative、summative、transfer。diagnostic 必須明確命名並描述「課前 Q1–Q4」，transfer 必須明確命名並描述更換情境的「課後 Q1–Q4」。每筆都要留下具體 artifact，並提供可操作的 decisionRule。
4. rubric：每個成功指標恰好一列，四級描述分別是證據有限、萌芽、發展、精熟，描述學生可觀察表現。
5. criterionIds 只能使用：${desiredResults.successCriteria.map((criterion) => criterion.id).join("、")}。`,
  };
}

export function parseEvidencePlan(
  raw: string,
  model: string,
  desiredResults: DesiredResults,
): EvidencePlanResult {
  const parsed = parseJsonObject(raw);
  const allowedCriteria = new Set(
    desiredResults.successCriteria.map((criterion) => criterion.id),
  );
  if (!Array.isArray(parsed.questionMaps) || parsed.questionMaps.length !== 2) {
    responseError("評量證據必須恰好包含診斷性與遷移性四階參照。");
  }
  const questionMaps: EvidenceQuestionMap[] = parsed.questionMaps.map(
    (item, mapIndex) => {
      const record = requiredRecord(item, `questionMaps[${mapIndex}]`);
      const phase = requiredString(
        record.phase,
        `questionMaps[${mapIndex}].phase`,
      );
      if (phase !== "pre" && phase !== "post") {
        responseError(`questionMaps[${mapIndex}].phase 不合法。`);
      }
      if (!Array.isArray(record.questions) || record.questions.length !== 4) {
        responseError(`${phase === "pre" ? "診斷性" : "遷移性"}四階參照必須完整規劃四個階段。`);
      }
      const questions = record.questions.map((question, questionIndex) => {
        const questionRecord = requiredRecord(
          question,
          `questionMaps[${mapIndex}].questions[${questionIndex}]`,
        );
        const expectedId = `Q${questionIndex + 1}` as keyof typeof QUESTION_FOCUS_BY_ID;
        const id = requiredString(
          questionRecord.id,
          `questionMaps[${mapIndex}].questions[${questionIndex}].id`,
        );
        const focus = requiredString(
          questionRecord.focus,
          `questionMaps[${mapIndex}].questions[${questionIndex}].focus`,
        );
        if (id !== expectedId || focus !== QUESTION_FOCUS_BY_ID[expectedId]) {
          responseError(`${phase === "pre" ? "診斷性" : "遷移性"}四階參照的順序或能力焦點不合法。`);
        }
        const criterionIds = requiredStringArray(
          questionRecord.criterionIds,
          `questionMaps[${mapIndex}].questions[${questionIndex}].criterionIds`,
          1,
          4,
        );
        validateControlledIds(
          criterionIds,
          allowedCriteria,
          `questionMaps[${mapIndex}].questions[${questionIndex}].criterionIds`,
        );
        return {
          id: expectedId,
          focus: QUESTION_FOCUS_BY_ID[expectedId],
          purpose: requiredString(
            questionRecord.purpose,
            `questionMaps[${mapIndex}].questions[${questionIndex}].purpose`,
          ),
          criterionIds,
          observableEvidence: requiredString(
            questionRecord.observableEvidence,
            `questionMaps[${mapIndex}].questions[${questionIndex}].observableEvidence`,
          ),
        };
      });
      return {
        phase,
        sharedProblem: requiredString(
          record.sharedProblem,
          `questionMaps[${mapIndex}].sharedProblem`,
        ),
        transferDifference: requiredString(
          record.transferDifference,
          `questionMaps[${mapIndex}].transferDifference`,
        ),
        questions,
      };
    },
  );
  if (
    questionMaps[0].phase !== "pre" ||
    questionMaps[1].phase !== "post"
  ) {
    responseError("四階參照地圖必須依序為診斷性與遷移性。");
  }
  const performance = requiredRecord(parsed.performanceTask, "performanceTask");
  const performanceCriterionIds = requiredStringArray(
    performance.criterionIds,
    "performanceTask.criterionIds",
    1,
    4,
  );
  validateControlledIds(
    performanceCriterionIds,
    allowedCriteria,
    "performanceTask.criterionIds",
  );
  if (
    performanceCriterionIds.length !== allowedCriteria.size ||
    ![...allowedCriteria].every((id) => performanceCriterionIds.includes(id))
  ) {
    responseError("真實總結任務必須涵蓋全部成功指標。");
  }

  if (
    !Array.isArray(parsed.evidenceItems) ||
    parsed.evidenceItems.length < 4 ||
    parsed.evidenceItems.length > 8
  ) {
    responseError("AI 回應的 evidenceItems 數量不合法。");
  }
  const typeCounts = new Map<EvidenceType, number>();
  const evidenceItems: EvidenceItem[] = parsed.evidenceItems.map(
    (item, index) => {
      const record = requiredRecord(item, `evidenceItems[${index}]`);
      const type = requiredString(
        record.type,
        `evidenceItems[${index}].type`,
      ) as EvidenceType;
      if (!EVIDENCE_TYPES.includes(type)) {
        responseError(`AI 回應含有未知的證據類型：${type}。`);
      }
      const count = (typeCounts.get(type) ?? 0) + 1;
      typeCounts.set(type, count);
      const criterionIds = requiredStringArray(
        record.criterionIds,
        `evidenceItems[${index}].criterionIds`,
        1,
        4,
      );
      validateControlledIds(
        criterionIds,
        allowedCriteria,
        `evidenceItems[${index}].criterionIds`,
      );
      return {
        id: `evidence-${type}-${count}`,
        type,
        title: requiredString(record.title, `evidenceItems[${index}].title`),
        criterionIds,
        artifact: requiredString(
          record.artifact,
          `evidenceItems[${index}].artifact`,
        ),
        method: requiredString(
          record.method,
          `evidenceItems[${index}].method`,
        ),
        timing: requiredString(
          record.timing,
          `evidenceItems[${index}].timing`,
        ),
        decisionRule: requiredString(
          record.decisionRule,
          `evidenceItems[${index}].decisionRule`,
        ),
      };
    },
  );
  for (const type of EVIDENCE_TYPES) {
    if (!typeCounts.has(type)) responseError(`評量證據缺少 ${type}。`);
  }
  for (const type of ["diagnostic", "transfer"] as const) {
    const joined = evidenceItems
      .filter((item) => item.type === type)
      .map((item) => `${item.title} ${item.artifact} ${item.method}`)
      .join(" ");
    if (!/Q1/i.test(joined) || !/Q4/i.test(joined)) {
      responseError(
        type === "diagnostic"
          ? "診斷性四階參照必須明確包含四個階段。"
          : "遷移性四階參照必須明確包含四個階段。",
      );
    }
  }
  const coveredCriteria = new Set(
    evidenceItems.flatMap((item) => item.criterionIds),
  );
  if ([...allowedCriteria].some((id) => !coveredCriteria.has(id))) {
    responseError("評量證據未完整涵蓋成功指標。");
  }

  if (
    !Array.isArray(parsed.rubric) ||
    parsed.rubric.length !== allowedCriteria.size
  ) {
    responseError("評量規準必須與成功指標一一對應。");
  }
  const rubric = parsed.rubric.map((item, index) => {
    const record = requiredRecord(item, `rubric[${index}]`);
    const criterionId = requiredString(
      record.criterionId,
      `rubric[${index}].criterionId`,
    );
    validateControlledIds(
      [criterionId],
      allowedCriteria,
      `rubric[${index}].criterionId`,
    );
    const levels = requiredRecord(record.levels, `rubric[${index}].levels`);
    return {
      criterionId,
      levels: {
        evidenceLimited: requiredString(
          levels.evidenceLimited,
          `rubric[${index}].levels.evidenceLimited`,
        ),
        emerging: requiredString(
          levels.emerging,
          `rubric[${index}].levels.emerging`,
        ),
        developing: requiredString(
          levels.developing,
          `rubric[${index}].levels.developing`,
        ),
        mastering: requiredString(
          levels.mastering,
          `rubric[${index}].levels.mastering`,
        ),
      },
    };
  });
  if (new Set(rubric.map((row) => row.criterionId)).size !== rubric.length) {
    responseError("評量規準含有重複成功指標。");
  }

  return {
    performanceTask: {
      goal: requiredString(performance.goal, "performanceTask.goal"),
      role: requiredString(performance.role, "performanceTask.role"),
      audience: requiredString(
        performance.audience,
        "performanceTask.audience",
      ),
      situation: requiredString(
        performance.situation,
        "performanceTask.situation",
      ),
      product: requiredString(
        performance.product,
        "performanceTask.product",
      ),
      criterionIds: performanceCriterionIds,
    },
    questionMaps,
    evidenceItems,
    rubric,
    assessmentDocument: null,
    mode: "ai_generated",
    model,
  };
}

export function validateEvidencePlanResult(
  evidencePlan: EvidencePlanResult,
  desiredResults: DesiredResults,
): string[] {
  try {
    const evidenceIds = evidencePlan.evidenceItems.map((item) => item.id);
    if (
      evidenceIds.some((id) => typeof id !== "string" || !id.trim()) ||
      new Set(evidenceIds).size !== evidenceIds.length
    ) {
      responseError("評量證據 ID 不得空白或重複。");
    }
    parseEvidencePlan(
      JSON.stringify(evidencePlan),
      evidencePlan.model,
      desiredResults,
    );
    return [];
  } catch (error) {
    return [
      error instanceof Error
        ? error.message
        : "評量證據資料無法通過驗證。",
    ];
  }
}

export function buildEvidencePlanRepairPrompt(
  input: CourseIdeationInput,
  alignment: CourseAlignmentResult,
  selectedIndicatorId: string,
  invalidRaw: string,
  validationError: string,
): GenerationPromptParts {
  const base = buildEvidencePlanPrompt(
    input,
    alignment,
    selectedIndicatorId,
  );
  return {
    stable: `${base.stable}

【唯一一次修復模式】
保留原回應中有效的教學設計，只修正驗證錯誤。仍只能使用提供的受控 ID，並輸出完整 JSON。`,
    dynamic: `${base.dynamic}

【驗證錯誤】
${validationError}

【待修原始回應】
${invalidRaw.slice(0, 30000)}`,
  };
}

export function validateUnitConstraints(constraints: UnitConstraints): string[] {
  const errors: string[] = [];
  if (
    !Number.isInteger(constraints.totalLessons) ||
    constraints.totalLessons < 1 ||
    constraints.totalLessons > 20
  ) {
    errors.push("總節數必須為 1–20 節。");
  }
  if (
    !Number.isInteger(constraints.minutesPerLesson) ||
    constraints.minutesPerLesson < 20 ||
    constraints.minutesPerLesson > 120
  ) {
    errors.push("每節時間必須為 20–120 分鐘。");
  }
  return errors;
}

export function buildUnitBlueprintPrompt(
  input: CourseIdeationInput,
  alignment: CourseAlignmentResult,
  selectedIndicatorId: string,
  evidencePlan: EvidencePlanResult,
  constraints: UnitConstraints,
  lessonReference?: AppliedLessonReference | null,
  courseAssessmentSeed?: CourseAssessmentSeedV1 | null,
): GenerationPromptParts {
  const desiredResults = buildDesiredResults(alignment);
  const evidenceForPrompt = {
    performanceTask: evidencePlan.performanceTask,
    questionMaps: evidencePlan.questionMaps,
    evidenceItems: evidencePlan.evidenceItems,
    rubric: evidencePlan.rubric,
  };
  return {
    stable: `你是精通逆向設計與 NPDL 的單元課程架構師。
請從已確認的學習終點與評量證據倒推節次安排，不得先列活動再補目標。
只能使用提供的 outcome、criterion、evidence 與 indicator ID。
每節都必須產生可觀察證據及後續教學決策。
${TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT}
只輸出符合 JSON Schema 的繁體中文 JSON。`,
    dynamic: `【課程】
${JSON.stringify(input, null, 2)}

${lessonReference
  ? `【教師確認採用的既有教案參考｜來源為既有課程 NPDL 轉換】
${JSON.stringify(lessonReference, null, 2)}
優先在不破壞學習終點與評量證據的前提下沿用，並遵守其中的現場限制；輸出須符合 NPDL 敘述，不可照抄原教案。

`
  : ""}
${buildTaiwanHighSchoolLabPrompt(input.subject)}

【學習終點】
${JSON.stringify(desiredResults, null, 2)}

【主要子向度 ID】
${selectedIndicatorId}

【四要素】
${JSON.stringify(alignment.fourElements, null, 2)}

【評量證據】
${JSON.stringify(evidenceForPrompt, null, 2)}

${courseAssessmentSeed
  ? `【已確認的課前評量】
${JSON.stringify(
  {
    scenarioBlueprint: courseAssessmentSeed.pre.scenarioBlueprint,
    preMappings: courseAssessmentSeed.preMappings,
  },
  null,
  2,
)}
第一節必須能承接這份課前診斷留下的證據。

`
  : ""}
【課程限制】
${JSON.stringify(constraints, null, 2)}

【輸出要求】
1. lessons 必須恰好 ${constraints.totalLessons} 節，lessonNumber 從 1 連續編號，每節 minutes 必須是 ${constraints.minutesPerLesson}。
2. 第一節必須連結 diagnostic 證據；最後一節必須連結 transfer 證據；summative 證據安排在最後兩節之一。
3. 每節至少連結一個 outcomeId、criterionId、evidenceItemId、一個 NPDL 四要素與主要子向度 ${selectedIndicatorId}。
4. 全部成功指標必須在節次中被涵蓋，且總結任務前必須安排練習、回饋與修訂。
5. 可用 outcomeIds：${OUTCOME_IDS.join("、")}。
6. 可用 criterionIds：${desiredResults.successCriteria.map((criterion) => criterion.id).join("、")}。
7. 可用 evidenceItemIds：${evidencePlan.evidenceItems.map((item) => item.id).join("、")}。
8. 為避免輸出截斷，unitArc 最多 200 字；每節各文字欄位最多 120 字，直接描述可執行內容，不重複課程背景。`,
  };
}

export function parseUnitBlueprint(
  raw: string,
  model: string,
  desiredResults: DesiredResults,
  evidencePlan: EvidencePlanResult,
  constraints: UnitConstraints,
  selectedIndicatorId: string,
): UnitBlueprintResult {
  const constraintErrors = validateUnitConstraints(constraints);
  if (constraintErrors.length > 0) responseError(constraintErrors[0]);
  const parsed = parseJsonObject(raw);
  if (
    !Array.isArray(parsed.lessons) ||
    parsed.lessons.length !== constraints.totalLessons
  ) {
    responseError(`單元藍圖必須恰好包含 ${constraints.totalLessons} 節。`);
  }
  const allowedOutcomes = new Set<string>(OUTCOME_IDS);
  const allowedCriteria = new Set(
    desiredResults.successCriteria.map((criterion) => criterion.id),
  );
  const evidenceById = new Map(
    evidencePlan.evidenceItems.map((item) => [item.id, item]),
  );
  const allowedEvidence = new Set(evidenceById.keys());
  const evidenceIdsByType = (type: EvidenceType) =>
    evidencePlan.evidenceItems
      .filter((item) => item.type === type)
      .map((item) => item.id);
  const lessons: UnitLessonBlueprint[] = parsed.lessons
    .map((item, index) => {
      const record = requiredRecord(item, `lessons[${index}]`);
      const lessonNumber =
        record.lessonNumber === undefined
          ? index + 1
          : requiredInteger(
              record.lessonNumber,
              `lessons[${index}].lessonNumber`,
              1,
              constraints.totalLessons,
            );
      const minutes =
        record.minutes === undefined
          ? constraints.minutesPerLesson
          : requiredInteger(
              record.minutes,
              `lessons[${index}].minutes`,
              20,
              120,
            );
      if (minutes !== constraints.minutesPerLesson) {
        responseError(`第 ${lessonNumber} 節時間必須為 ${constraints.minutesPerLesson} 分鐘。`);
      }
      const fallbackOutcomeIds: UnitLessonBlueprint["outcomeIds"] =
        lessonNumber === 1
          ? ["knowledge-foundation"]
          : lessonNumber === constraints.totalLessons
            ? ["four-elements-practice"]
            : ["competency-subdimension"];
      const outcomeIds = stringArrayOrControlledFallback(
        record.outcomeIds,
        `lessons[${index}].outcomeIds`,
        fallbackOutcomeIds,
        1,
        3,
      ) as UnitLessonBlueprint["outcomeIds"];
      validateControlledIds(
        outcomeIds,
        allowedOutcomes,
        `lessons[${index}].outcomeIds`,
      );
      const criterionIds = stringArrayOrControlledFallback(
        record.criterionIds,
        `lessons[${index}].criterionIds`,
        [...allowedCriteria],
        1,
        4,
      );
      validateControlledIds(
        criterionIds,
        allowedCriteria,
        `lessons[${index}].criterionIds`,
      );
      const diagnosticIds = evidenceIdsByType("diagnostic");
      const formativeIds = evidenceIdsByType("formative");
      const summativeIds = evidenceIdsByType("summative");
      const transferIds = evidenceIdsByType("transfer");
      const fallbackEvidenceItemIds =
        constraints.totalLessons === 1
          ? [
              diagnosticIds[0],
              summativeIds[0],
              transferIds[0],
            ].filter((id): id is string => Boolean(id))
          : lessonNumber === 1
            ? diagnosticIds.slice(0, 4)
            : lessonNumber === constraints.totalLessons
              ? [...summativeIds, ...transferIds].slice(0, 4)
              : lessonNumber === constraints.totalLessons - 1
                ? [...formativeIds, ...summativeIds].slice(0, 4)
                : formativeIds.slice(0, 4);
      const evidenceItemIds = stringArrayOrControlledFallback(
        record.evidenceItemIds,
        `lessons[${index}].evidenceItemIds`,
        fallbackEvidenceItemIds,
        1,
        4,
      );
      validateControlledIds(
        evidenceItemIds,
        allowedEvidence,
        `lessons[${index}].evidenceItemIds`,
      );
      const primaryIndicatorId =
        record.primaryIndicatorId === undefined
          ? selectedIndicatorId
          : requiredString(
              record.primaryIndicatorId,
              `lessons[${index}].primaryIndicatorId`,
            );
      if (primaryIndicatorId !== selectedIndicatorId) {
        responseError(`第 ${lessonNumber} 節使用了錯誤的 6Cs 子向度 ID。`);
      }
      const fallbackFourElementNames: UnitLessonBlueprint["fourElementNames"] =
        lessonNumber === 1
          ? ["學習環境"]
          : lessonNumber === constraints.totalLessons
            ? ["學習夥伴關係", "教學實踐"]
            : ["數位利用", "教學實踐"];
      const fourElementNames = stringArrayOrControlledFallback(
        record.fourElementNames,
        `lessons[${index}].fourElementNames`,
        fallbackFourElementNames,
        1,
        4,
      ) as UnitLessonBlueprint["fourElementNames"];
      validateControlledIds(
        fourElementNames,
        new Set(FOUR_ELEMENT_NAMES),
        `lessons[${index}].fourElementNames`,
      );
      const linkedEvidence = evidenceItemIds
        .map((id) => evidenceById.get(id))
        .filter((entry): entry is EvidenceItem => Boolean(entry));
      const linkedOutcomes = desiredResults.outcomes.filter((outcome) =>
        outcomeIds.includes(outcome.id),
      );
      const title = stringOrControlledFallback(
        record.title,
        `lessons[${index}].title`,
        `第 ${lessonNumber} 節學習任務`,
      );
      const formativeCheckFallback =
        linkedEvidence.map((entry) => entry.title).join("、") ||
        "本節可觀察學習證據";
      const decisionRuleFallback =
        linkedEvidence.map((entry) => entry.decisionRule).join("；") ||
        "若三分之一以上學生尚未達成成功指標，下一節先安排示例分析、補救鷹架與再次檢核。";
      return {
        id: `lesson-${lessonNumber}`,
        lessonNumber,
        title,
        minutes,
        milestone: stringOrControlledFallback(
          record.milestone,
          `lessons[${index}].milestone`,
          `完成「${title}」並留下「${formativeCheckFallback}」。`,
        ),
        outcomeIds,
        criterionIds,
        evidenceItemIds,
        learningIntention: stringOrControlledFallback(
          record.learningIntention,
          `lessons[${index}].learningIntention`,
          linkedOutcomes.map((outcome) => outcome.statement).join("；") ||
            "依本節成功指標完成可觀察的學習成果。",
        ),
        coreTask: stringOrControlledFallback(
          record.coreTask,
          `lessons[${index}].coreTask`,
          linkedEvidence.map((entry) => entry.artifact).join("；") ||
            "完成本節對應的學習任務與證據作品。",
        ),
        formativeCheck: stringOrControlledFallback(
          record.formativeCheck,
          `lessons[${index}].formativeCheck`,
          formativeCheckFallback,
        ),
        decisionRule: stringOrControlledFallback(
          record.decisionRule,
          `lessons[${index}].decisionRule`,
          decisionRuleFallback,
        ),
        primaryIndicatorId,
        fourElementNames,
        previousConnection: stringOrControlledFallback(
          record.previousConnection,
          `lessons[${index}].previousConnection`,
          lessonNumber === 1
            ? "連結學生先備經驗與課前診斷證據。"
            : "承接前一節形成的學習成果與可觀察證據。",
        ),
        nextConnection: stringOrControlledFallback(
          record.nextConnection,
          `lessons[${index}].nextConnection`,
          lessonNumber === constraints.totalLessons
            ? "以課後遷移證據檢查學習成果在新情境中的應用。"
            : "帶著本節證據與待改進處進入下一節學習任務。",
        ),
      };
    })
    .sort((left, right) => left.lessonNumber - right.lessonNumber);

  lessons.forEach((lesson, index) => {
    if (lesson.lessonNumber !== index + 1) {
      responseError("節次編號必須從 1 連續排列。");
    }
  });
  const criterionCoverage = new Set(lessons.flatMap((lesson) => lesson.criterionIds));
  if ([...allowedCriteria].some((id) => !criterionCoverage.has(id))) {
    responseError("單元藍圖未完整涵蓋成功指標。");
  }
  const evidenceTypesFor = (lesson: UnitLessonBlueprint) =>
    lesson.evidenceItemIds.map((id) => evidenceById.get(id)?.type);
  if (!evidenceTypesFor(lessons[0]).includes("diagnostic")) {
    responseError("第一節必須連結診斷性四階參照。");
  }
  if (!evidenceTypesFor(lessons[lessons.length - 1]).includes("transfer")) {
    responseError("最後一節必須連結遷移性四階參照。");
  }
  if (
    !lessons
      .slice(Math.max(0, lessons.length - 2))
      .some((lesson) => evidenceTypesFor(lesson).includes("summative"))
  ) {
    responseError("總結任務必須安排在最後兩節之一。");
  }

  return {
    unitArc: stringOrControlledFallback(
      parsed.unitArc,
      "unitArc",
      `從課前診斷出發，逐步練習與回饋，完成「${evidencePlan.performanceTask.product}」，最後以新情境檢查遷移。`,
    ),
    lessons,
    mode: "ai_generated",
    model,
  };
}

export function validateUnitBlueprintResult(
  unitBlueprint: UnitBlueprintResult,
  desiredResults: DesiredResults,
  evidencePlan: EvidencePlanResult,
  constraints: UnitConstraints,
  selectedIndicatorId: string,
): string[] {
  try {
    parseUnitBlueprint(
      JSON.stringify(unitBlueprint),
      unitBlueprint.model,
      desiredResults,
      evidencePlan,
      constraints,
      selectedIndicatorId,
    );
    return [];
  } catch (error) {
    return [
      error instanceof Error
        ? error.message
        : "單元節次藍圖無法通過驗證。",
    ];
  }
}

export function buildUnitBlueprintRepairPrompt(
  input: CourseIdeationInput,
  alignment: CourseAlignmentResult,
  selectedIndicatorId: string,
  evidencePlan: EvidencePlanResult,
  constraints: UnitConstraints,
  invalidRaw: string,
  validationError: string,
  courseAssessmentSeed?: CourseAssessmentSeedV1 | null,
): GenerationPromptParts {
  const base = buildUnitBlueprintPrompt(
    input,
    alignment,
    selectedIndicatorId,
    evidencePlan,
    constraints,
    undefined,
    courseAssessmentSeed,
  );
  return {
    stable: `${base.stable}

【唯一一次修復模式】
保留原回應中有效的節次安排，只修正驗證錯誤。仍只能使用提供的受控 ID，並輸出完整 JSON。`,
    dynamic: `${base.dynamic}

【驗證錯誤】
${validationError}

【待修原始回應】
${invalidRaw.slice(0, 30000)}`,
  };
}

export function buildAssessmentDesignContext(
  project: LearningDesignProjectV1,
): AssessmentDesignContext | null {
  if (
    !project.desiredResults ||
    !project.evidencePlan ||
    !project.alignment ||
    !project.desiredResultsConfirmedAt ||
    !project.evidencePlanConfirmedAt ||
    project.alignmentAudit.desiredResults !== "current" ||
    project.alignmentAudit.evidencePlan !== "current"
  ) {
    return null;
  }
  const curriculum = [
    ...project.alignment.curriculumSelection.performanceIds,
    ...project.alignment.curriculumSelection.contentIds,
  ]
    .map((id) => getCurriculumEntry(id, project.customCurriculumEntries))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .map((entry) => ({
      id: entry.id,
      code: entry.code,
      text: entry.text,
      kind: entry.kind,
    }));
  const assessmentSeedSourceFingerprint =
    buildCourseAssessmentSourceFingerprint({
      course: project.input,
      selectedIndicatorId: project.selectedIndicatorId,
      desiredResults: project.desiredResults,
      evidencePlan: project.evidencePlan,
    });
  return {
    projectId: project.id,
    sourceUpdatedAt: project.updatedAt,
    sourceFingerprint: buildAssessmentDesignSourceFingerprint({
      assessmentSeedSourceFingerprint,
      unitBlueprint: project.unitBlueprint ?? null,
    }),
    assessmentSeedSourceFingerprint,
    curriculum,
    transferGoals: project.desiredResults.transferGoals,
    enduringUnderstandings: project.desiredResults.enduringUnderstandings,
    essentialQuestions: project.desiredResults.essentialQuestions,
    outcomes: project.desiredResults.outcomes,
    successCriteria: project.desiredResults.successCriteria,
    selectedIndicatorId: project.selectedIndicatorId,
    performanceTask: project.evidencePlan?.performanceTask ?? null,
    questionMaps: project.evidencePlan?.questionMaps ?? [],
    evidenceItems: project.evidencePlan?.evidenceItems ?? [],
    academicRubric: project.evidencePlan?.rubric ?? [],
    unitBlueprint: project.unitBlueprint ?? null,
    courseAssessmentSeed: project.courseAssessmentSeed ?? null,
    lessonReference: project.appliedLessonReference ?? null,
  };
}

export function isValidLearningDesignProject(
  value: unknown,
): value is LearningDesignProjectV1 {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const project = value as Partial<LearningDesignProjectV1>;
  return (
    project.version === LEARNING_DESIGN_PROJECT_VERSION &&
    typeof project.id === "string" &&
    /^[a-z0-9-]{8,100}$/i.test(project.id) &&
    typeof project.createdAt === "number" &&
    typeof project.updatedAt === "number" &&
    Boolean(project.input) &&
    typeof project.selectedIndicatorId === "string" &&
    Boolean(project.alignmentAudit) &&
    ["empty", "current", "stale"].includes(
      project.alignmentAudit?.desiredResults ?? "",
    ) &&
    ["empty", "current", "stale"].includes(
      project.alignmentAudit?.evidencePlan ?? "",
    ) &&
    ["empty", "current", "stale"].includes(
      project.alignmentAudit?.unitBlueprint ?? "",
    )
  );
}

const GEM_INSTRUCTIONS = `你是熟悉台灣 108 課綱、NPDL 深度學習、逆向設計與形成性評量的資深教學設計者。
收到「本節任務資料」後，請直接在 Gemini Canvas 建立一份繁體中文逐節教案文件。
所有課綱代碼、課綱原文、成功指標與受控 ID 都是不可改寫的設計錨點。
不得虛構學生資料、課綱、教材來源或不存在的設備。
活動必須服務學習目標並留下可觀察證據；數位工具必須深化知識建構、協作或回饋。
若資料不足，先在文件開頭列出最小必要假設，不得反問後停止產出。
各教學階段分鐘數總和必須等於本節總時間。

文件固定包含：
1. 本節概覽
2. 學習目標與學生版成功條件
3. 教材與課前準備
4. 分段教學流程表（時間、教師行動、學生行動、可觀察證據）
5. 核心提問與預期回應
6. 形成性檢核與教學決策
7. 差異化鷹架、補救與延伸
8. NPDL 四要素如何實際發生
9. 收束、出口單與下一節銜接
10. 課後教師反思欄
11. 課綱、成功指標、任務與證據對齊表`;

const UNIT_TEACHER_PREP_GEM_INSTRUCTIONS = `你是熟悉台灣 108 課綱、NPDL 深度學習、逆向設計與形成性評量的資深教學設計者。
請直接在 Gemini Canvas 建立一份可供教師實際備課使用的繁體中文「完整單元逐節教案」，一次完成資料中列出的全部節次，不得只產生其中一節，也不得要求教師逐節重新下指令。

本任務只產出教師備課教案，不需要學生學習單或教師參考解答版。
所有課綱代碼、課綱原文、學習成果、成功指標、節次順序、總結任務與受控 ID 都是不可改寫的設計錨點。不得虛構學生個資、課綱、教材來源或不存在的設備。若資料不足，在文件開頭集中列出最小必要假設，之後仍須完成全部教案。
${TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT}

完整文件固定包含：
1. 單元總覽：年級、科目、單元、總節數、總時間與單元學習歷程。
2. 108 課綱、學習終點、成功指標、6Cs 與 NPDL 四要素對齊表。
3. 評量證據地圖：課前 Q1–Q4 目的、形成性證據、真實總結任務、課後遷移與教學決策。
4. 全部節次的完整教案；每一節均依序提供：
   - 本節概覽、學習目標與學生版成功條件。
   - 教材、設備與課前準備。
   - 分段教學流程表：時間、教師行動、學生行動、核心提問、可觀察證據。
   - 形成性檢核、判讀方式與下一步教學決策。
   - 差異化鷹架、補救與延伸。
   - 6Cs 與 NPDL 四要素如何實際發生。
   - 收束、出口單及與前後節的銜接。
   - 課後教師反思欄。
5. 全單元課綱、成功指標、節次、任務與證據覆蓋表。

品質規則：
- 必須完整產生資料中的每一節，節次不可合併、刪除或新增。
- 每節分段時間總和必須等於該節分鐘數。
- 每項活動必須指出學習目的與可觀察證據。
- 不要產出學生學習單題本；學習單另有獨立提示詞處理。
- 數位工具只能用於知識建構、協作或回饋，不得為使用而使用。
- 課後 Q1–Q4 必須使用新資料、新限制或新情境檢查遷移。
- 學科成功指標規準與 6Cs 官方進程必須分開呈現。`;

const UNIT_WORKSHEET_GEM_INSTRUCTIONS = `你是熟悉台灣 108 課綱、NPDL 深度學習、逆向設計與形成性評量的資深教學設計者。
請直接在 Gemini Canvas 建立一份繁體中文「全部節次學習單」文件，一次完成資料中列出的全部節次，不得只產生其中一節，也不得要求教師逐節重新下指令。

本文件只分兩個版本，不得再產出教案流程表或其他額外文類：
1. 學生版學習單（可直接列印發給學生）
2. 教師參考解答版（教師用，含參考答案與判讀要點）
產出標準＝學生版列印即可作答；教師版可對照批改與即時調整教學。貼到 Google 文件／Word 後不必再補標題或欄位。
${TAIWAN_HIGH_SCHOOL_FEASIBILITY_PROMPT}

文件固定結構（順序不可改）：

══════════════════════════════════
第一部分｜學生版學習單（全部節次）
══════════════════════════════════
先給單元封面與目錄：年級、科目、單元名稱、總節數、主要 6Cs 子向度；以表格列出「節次｜標題｜分鐘｜學習單頁次」。
再依節次順序產出每一節學生版。學生版全程不得出現參考答案、標準答案、教師判語或教學決策。

【每節學生版｜可直接列印格式】
必須依序包含下列區塊，標題文字不得省略或改寫成摘要：
A. 頁首識別區（Markdown 表格，表頭完整）：
   | 單元 | 第○節 | 節次標題 |
   | 班級 | 座號 | 姓名 | 日期 |
   班級／座號／姓名／日期欄位必須留白；不得填入任何真實學生資料。頁首須標明「學生版」。
B. 學習目標與學生版成功條件：以項目清單完整寫出，不可只寫「見教案」。
C. 本節閱讀／操作素材（若題目需要資料、數據、案例、圖表、實驗觀察欄）：必須整段內嵌，並以有完整表頭的表格呈現；不得寫「見附件」「見投影片」。
D. 「A. 知識基礎」區（3–5 題）：
   - 區標題必須寫成「A. 知識基礎」。
   - 每題固定格式：題號、題幹、作答指令、作答欄。
   - 作答欄依題型使用完整表頭表格，例如：
     · 簡答／解釋：| 作答 |（下方留足夠空白列）
     · 選擇／配對：選項完整列出，並提供 | 題號 | 答案 | 理由 |
     · 資料判讀：先給完整資料表（含欄位名稱），再給 | 觀察 | 證據 | 解釋 |
     · 實驗／觀察紀錄：| 步驟或時間 | 觀察現象 | 數據或紀錄 | 初步推論 |
E. 「B. NPDL 子向度思考」區（3–4 題）：
   - 區標題必須寫成「B. NPDL 子向度思考」，並標明本節主要 6Cs 子向度名稱。
   - 題目須要求記錄思考或協作歷程、引用作品／觀察證據、連結真實情境。
   - 最後一題必須是「官方四級進程自我判讀」，使用完整表頭表格，四級名稱與描述都要寫出：
     | 進程等級 | 官方描述 | 我目前最接近的證據 | 勾選 |
     並另附 | 我選擇此等級的理由 | 下一步我要做的一件具體行動 |。
F. 頁尾：本節完成檢查清單（3–5 項可勾選短句）與「本節我還想問的問題」空白欄。

══════════════════════════════════
第二部分｜教師參考解答版（全部節次）
══════════════════════════════════
開頭註明「教師用／不發給學生」。依與學生版相同的節次與題號順序，逐節提供參考解答。

【每節教師參考解答版】
- 標題必須寫「教師參考解答版｜第○節｜（節次標題）」。
- 先用 2–4 句說明本節期望看見的整體表現。
- 再以完整表頭表格逐題呈現，欄位不得省略：
  | 題號 | 區塊（知識基礎／NPDL） | 參考解答或可接受回應特徵 | 對應成功指標 | 可觀察證據 | 常見迷思或不足表現 | 未達標時的即時教學決策 |
- 自我判讀題須提供：各等級典型證據樣貌，以及教師如何據學生自評與作品交叉核對。
- 不得改動學生版題號、題幹順序；教師版是對照解答，不是另一套新題。

列印與品質規則（強制）：
- 所有表格都必須有完整表頭列；禁止無標題欄、只有分隔線、或「（表格）」佔位文字。
- 表格欄名必須為可直接理解的繁體中文。
- 學生版必須自給自足：列印後即可作答，不依賴外部連結或不存在的附件。
- 必須完整產生資料中的每一節；節次不可合併、刪除或新增。
- 每節學生版都必須同時包含「知識基礎」與「NPDL 子向度思考」兩區。
- 知識基礎與 NPDL 子向度思考必須分開判讀；學科成功指標規準不得與 6Cs 官方進程混為一體。
- 所有課綱代碼、成功指標、節次順序與受控 ID 都是不可改寫的設計錨點；不得虛構學生個資或不存在的附件。
- 優先黑白列印友善；勾選框可用 □ 表示。`;

const UNIT_PREP_COACH_GEM_INSTRUCTIONS = `你是本單元的「NPDL 備課諮詢 Gem」，專門協助台灣高中教師處理課堂實施問題。
你的唯一知識邊界是教師貼上的「本單元設計錨點」：108／6Cs 校準結果、學習終點、成功指標、評量證據、真實任務、節次藍圖、課程限制與實驗室脈絡。你必須以這些錨點為準，不得用一般教學常識覆蓋或改寫它們。

回答原則：
1. 先對齊錨點：每次建議都要點出依據的學習成果、成功指標、證據項目、節次目標或 6Cs 子向度；若錨點未涵蓋，明確說「錨點未定義」並只給最小必要假設。
2. 只服務備課與課堂實施：時間不夠、學生卡關、分組失衡、形成性證據不足、設備故障、差異化調整、出口單判讀、下一節銜接等。不要重寫整份教案，也不要另開與錨點無關的新單元。
3. 建議必須可在台灣普通高中常規教室落地；優先低科技、低成本替代路徑。
4. 評量邏輯不可偏離：不得建議放棄已定成功指標，或把學科規準與 6Cs 官方進程混成同一把尺。
5. 不要求、不蒐集、不儲存學生姓名或其他可識別個資；討論學生時只用班級代號與座號，或「某組／某位學生」。
6. 若教師問題會導致偏離已校準終點，先警示風險，再提供「仍對齊終點」的最小調整方案（例如刪減活動但仍保留關鍵證據）。
7. 回答使用繁體中文，結構清楚：先給可立即執行的建議，再補理由與可觀察證據，必要時附 1 個備案。
8. 不要虛構課綱條文、設備、數據或校外資源；也不要輸出 API Key、帳密或把錨點全文無必要地整份回貼。`;

function buildLessonWorksheetBriefs(project: LearningDesignProjectV1) {
  if (
    !project.alignment ||
    !project.desiredResults ||
    !project.evidencePlan ||
    !project.unitBlueprint
  ) {
    throw new Error("學習設計專案缺少學習單所需脈絡。");
  }
  const indicator = getIndicatorById(project.selectedIndicatorId);
  const knowledgeFoundation = project.desiredResults.outcomes.find(
    (outcome) => outcome.id === "knowledge-foundation",
  );
  const competencyOutcome = project.desiredResults.outcomes.find(
    (outcome) => outcome.id === "competency-subdimension",
  );

  return project.unitBlueprint.lessons.map((lesson) => {
    const linkedCriteria = project.desiredResults!.successCriteria.filter(
      (criterion) => lesson.criterionIds.includes(criterion.id),
    );
    const linkedEvidence = project.evidencePlan!.evidenceItems.filter((item) =>
      lesson.evidenceItemIds.includes(item.id),
    );
    return {
      lessonId: lesson.id,
      lessonNumber: lesson.lessonNumber,
      lessonTitle: lesson.title,
      minutes: lesson.minutes,
      learningIntention: lesson.learningIntention,
      knowledgeFoundationSection: {
        heading: "A. 知識基礎",
        outcome: knowledgeFoundation ?? null,
        curriculumEntryIds: [
          ...project.alignment!.curriculumSelection.performanceIds,
          ...project.alignment!.curriculumSelection.contentIds,
        ],
        linkedSuccessCriteria: linkedCriteria,
        linkedEvidence,
        requiredQuestionCount: "3–5 題",
        progression:
          "概念辨識 → 資料或現象判讀 → 引用證據解釋 → 應用於本節任務",
      },
      npdlSubdimensionThinkingSection: {
        heading: "B. NPDL 子向度思考",
        outcome: competencyOutcome ?? null,
        primaryCompetency: indicator
          ? {
              id: indicator.id,
              dimension: indicator.dimension,
              name: indicator.name,
              officialProgression: indicator.levels,
            }
          : { id: project.selectedIndicatorId },
        fourElements: project.alignment!.fourElements.filter((element) =>
          lesson.fourElementNames.includes(element.name),
        ),
        linkedEvidence,
        requiredQuestionCount: "3–4 題",
        progression:
          "記錄思考或協作歷程 → 以作品或觀察證據說明判斷 → 連結真實情境 → 依官方四級進程自評並提出下一步",
      },
      teacherAnswerKeyRequirements: {
        separateFromStudentVersion: true,
        versionLabel: "教師參考解答版",
        printReady: true,
        requiredTableHeaders: [
          "題號",
          "區塊（知識基礎／NPDL）",
          "參考解答或可接受回應特徵",
          "對應成功指標",
          "可觀察證據",
          "常見迷思或不足表現",
          "未達標時的即時教學決策",
        ],
        requiredFields: [
          "參考解答或可接受回應特徵",
          "對應成功指標",
          "可觀察證據",
          "常見迷思或不足表現",
          "未達標時的即時教學決策",
        ],
      },
      documentParts: [
        "第一部分｜學生版學習單（全部節次）",
        "第二部分｜教師參考解答版（全部節次）",
      ],
      printReadyLayout: {
        goal: "學生版可直接列印發給學生；教師參考解答版供對照批改，兩者分開",
        studentHeaderTableColumns: [
          "單元",
          "第○節",
          "節次標題",
          "班級",
          "座號",
          "姓名",
          "日期",
        ],
        forbidMissingTableHeaders: true,
        forbidExternalAttachments: true,
        forbidAnswersInStudentVersion: true,
        selfAssessmentTableHeaders: [
          "進程等級",
          "官方描述",
          "我目前最接近的證據",
          "勾選",
        ],
        nextActionTableHeaders: [
          "我選擇此等級的理由",
          "下一步我要做的一件具體行動",
        ],
      },
    };
  });
}

export function buildLessonPromptPackage(
  project: LearningDesignProjectV1,
  lessonId: string,
  now = Date.now(),
): LessonPromptPackage {
  if (
    project.alignmentAudit.desiredResults !== "current" ||
    project.alignmentAudit.evidencePlan !== "current" ||
    project.alignmentAudit.unitBlueprint !== "current" ||
    !project.evidencePlanConfirmedAt ||
    !project.unitBlueprintConfirmedAt ||
    !project.alignment ||
    !project.desiredResults ||
    !project.evidencePlan ||
    !project.unitBlueprint
  ) {
    throw new Error("學習終點、評量證據與單元藍圖必須完成校準後才能產生提示詞。");
  }
  const lesson = project.unitBlueprint.lessons.find(
    (candidate) => candidate.id === lessonId,
  );
  if (!lesson) throw new Error("找不到指定節次。");
  const context = buildAssessmentDesignContext(project);
  if (!context) throw new Error("學習設計專案缺少必要脈絡。");
  const indicator = getIndicatorById(project.selectedIndicatorId);
  const linkedEvidence = project.evidencePlan.evidenceItems.filter((item) =>
    lesson.evidenceItemIds.includes(item.id),
  );
  const linkedCriteria = project.desiredResults.successCriteria.filter(
    (criterion) => lesson.criterionIds.includes(criterion.id),
  );
  const linkedOutcomes = project.desiredResults.outcomes.filter((outcome) =>
    lesson.outcomeIds.includes(outcome.id),
  );
  const lessonTaskPrompt = `【本節任務資料】
${JSON.stringify(
  {
    course: project.input,
    lesson,
    constraints: project.unitConstraints,
    labContext: buildTaiwanHighSchoolLabPrompt(project.input.subject),
    curriculum: context.curriculum,
    transferGoals: context.transferGoals,
    enduringUnderstandings: context.enduringUnderstandings,
    essentialQuestions: context.essentialQuestions,
    linkedOutcomes,
    linkedCriteria,
    primaryCompetency: indicator
      ? {
          id: indicator.id,
          dimension: indicator.dimension,
          name: indicator.name,
          levels: indicator.levels,
        }
      : { id: project.selectedIndicatorId },
    fourElementDesign: project.alignment.fourElements.filter((element) =>
      lesson.fourElementNames.includes(element.name),
    ),
    performanceTask: project.evidencePlan.performanceTask,
    assessmentQuestionMaps: context.questionMaps,
    linkedEvidence,
  },
  null,
  2,
)}

請依固定格式直接在 Canvas 產生「第 ${lesson.lessonNumber} 節｜${lesson.title}」完整教案。`;
  return {
    version: LESSON_PROMPT_PACKAGE_VERSION,
    projectId: project.id,
    lessonId,
    target: "gemini_canvas",
    generatedAt: now,
    gemInstructions: GEM_INSTRUCTIONS,
    lessonTaskPrompt,
    fullPrompt: `${GEM_INSTRUCTIONS}\n\n${lessonTaskPrompt}`,
  };
}

export function buildUnitPromptPackage(
  project: LearningDesignProjectV1,
  now = Date.now(),
): LessonPromptPackage {
  assertUnitPromptProjectReady(project);
  const context = buildAssessmentDesignContext(project);
  if (!context) throw new Error("學習設計專案缺少必要脈絡。");
  const indicator = getIndicatorById(project.selectedIndicatorId);
  const unitTaskPrompt = `【教師備課／完整單元教案任務資料】
${JSON.stringify(
  {
    course: project.input,
    constraints: project.unitConstraints,
    labContext: buildTaiwanHighSchoolLabPrompt(project.input.subject),
    unitBlueprint: project.unitBlueprint!,
    curriculum: context.curriculum,
    transferGoals: context.transferGoals,
    enduringUnderstandings: context.enduringUnderstandings,
    essentialQuestions: context.essentialQuestions,
    outcomes: context.outcomes,
    successCriteria: context.successCriteria,
    primaryCompetency: indicator
      ? {
          id: indicator.id,
          dimension: indicator.dimension,
          name: indicator.name,
          levels: indicator.levels,
        }
      : { id: project.selectedIndicatorId },
    fourElementDesign: project.alignment!.fourElements,
    performanceTask: project.evidencePlan!.performanceTask,
    assessmentQuestionMaps: context.questionMaps,
    evidenceItems: context.evidenceItems,
    academicRubric: project.evidencePlan!.rubric,
  },
  null,
  2,
)}

請依固定格式，直接在 Canvas 一次產生「${project.input.unitName}」共 ${project.unitBlueprint!.lessons.length} 節的完整單元逐節教案（教師備課用）；不要產生學生學習單。`;
  return {
    version: LESSON_PROMPT_PACKAGE_VERSION,
    projectId: project.id,
    lessonId: "unit-all",
    target: "gemini_canvas",
    generatedAt: now,
    gemInstructions: UNIT_TEACHER_PREP_GEM_INSTRUCTIONS,
    lessonTaskPrompt: unitTaskPrompt,
    fullPrompt: `${UNIT_TEACHER_PREP_GEM_INSTRUCTIONS}\n\n${unitTaskPrompt}`,
  };
}

function assertUnitPromptProjectReady(project: LearningDesignProjectV1): void {
  if (
    project.alignmentAudit.desiredResults !== "current" ||
    project.alignmentAudit.evidencePlan !== "current" ||
    project.alignmentAudit.unitBlueprint !== "current" ||
    !project.evidencePlanConfirmedAt ||
    !project.unitBlueprintConfirmedAt ||
    !project.alignment ||
    !project.desiredResults ||
    !project.evidencePlan ||
    !project.unitBlueprint
  ) {
    throw new Error("學習終點、評量證據與單元藍圖必須完成校準後才能產生提示詞。");
  }
}

export function buildUnitWorksheetPromptPackage(
  project: LearningDesignProjectV1,
  now = Date.now(),
): LessonPromptPackage {
  assertUnitPromptProjectReady(project);
  const context = buildAssessmentDesignContext(project);
  if (!context) throw new Error("學習設計專案缺少必要脈絡。");
  const indicator = getIndicatorById(project.selectedIndicatorId);
  const lessonWorksheetBriefs = buildLessonWorksheetBriefs(project);
  const worksheetTaskPrompt = `【全部節次學習單任務資料】
${JSON.stringify(
  {
    course: project.input,
    constraints: project.unitConstraints,
    labContext: buildTaiwanHighSchoolLabPrompt(project.input.subject),
    unitArc: project.unitBlueprint!.unitArc,
    lessons: project.unitBlueprint!.lessons.map((lesson) => ({
      id: lesson.id,
      lessonNumber: lesson.lessonNumber,
      title: lesson.title,
      minutes: lesson.minutes,
      learningIntention: lesson.learningIntention,
      milestone: lesson.milestone,
      coreTask: lesson.coreTask,
      formativeCheck: lesson.formativeCheck,
      criterionIds: lesson.criterionIds,
      outcomeIds: lesson.outcomeIds,
      evidenceItemIds: lesson.evidenceItemIds,
    })),
    curriculum: context.curriculum,
    outcomes: context.outcomes,
    successCriteria: context.successCriteria,
    primaryCompetency: indicator
      ? {
          id: indicator.id,
          dimension: indicator.dimension,
          name: indicator.name,
          levels: indicator.levels,
        }
      : { id: project.selectedIndicatorId },
    fourElementDesign: project.alignment!.fourElements,
    evidenceItems: context.evidenceItems,
    lessonWorksheetBriefs,
  },
  null,
  2,
)}

請依固定格式，直接在 Canvas 一次產生「${project.input.unitName}」共 ${project.unitBlueprint!.lessons.length} 節學習單：先產出「第一部分｜學生版」（可直接列印），再產出「第二部分｜教師參考解答版」；表格都必須有完整標題與表頭；不要產生教案流程表。`;
  return {
    version: LESSON_PROMPT_PACKAGE_VERSION,
    projectId: project.id,
    lessonId: "unit-worksheets",
    target: "gemini_canvas",
    generatedAt: now,
    gemInstructions: UNIT_WORKSHEET_GEM_INSTRUCTIONS,
    lessonTaskPrompt: worksheetTaskPrompt,
    fullPrompt: `${UNIT_WORKSHEET_GEM_INSTRUCTIONS}\n\n${worksheetTaskPrompt}`,
  };
}

export function buildUnitPrepCoachGemPackage(
  project: LearningDesignProjectV1,
  now = Date.now(),
): LessonPromptPackage {
  assertUnitPromptProjectReady(project);
  const context = buildAssessmentDesignContext(project);
  if (!context) throw new Error("學習設計專案缺少必要脈絡。");
  const indicator = getIndicatorById(project.selectedIndicatorId);
  const designAnchors = {
    purpose:
      "本物件是備課諮詢 Gem 的唯一知識邊界。課堂實施建議必須引用其中的校準、學習終點、評量證據與節次藍圖，不得另起無關終點。",
    course: project.input,
    constraints: project.unitConstraints,
    labContext: buildTaiwanHighSchoolLabPrompt(project.input.subject),
    alignment: {
      curriculumSelection: project.alignment!.curriculumSelection,
      curriculum: context.curriculum,
      fourElements: project.alignment!.fourElements,
      primaryCompetency: indicator
        ? {
            id: indicator.id,
            dimension: indicator.dimension,
            name: indicator.name,
            levels: indicator.levels,
          }
        : { id: project.selectedIndicatorId },
    },
    desiredResults: {
      transferGoals: context.transferGoals,
      enduringUnderstandings: context.enduringUnderstandings,
      essentialQuestions: context.essentialQuestions,
      outcomes: context.outcomes,
      successCriteria: context.successCriteria,
    },
    evidencePlan: {
      performanceTask: project.evidencePlan!.performanceTask,
      questionMaps: context.questionMaps,
      evidenceItems: context.evidenceItems,
      academicRubric: project.evidencePlan!.rubric,
    },
    unitBlueprint: project.unitBlueprint!,
    privacyRule: "不得要求或輸出學生姓名；僅可用班級代號與座號討論個案。",
  };
  const designAnchorText = JSON.stringify(designAnchors, null, 2);
  const setupPrompt = `【建立「NPDL 備課諮詢 Gem」操作說明】
單元：${project.input.unitName}
建議 Gem 名稱：NPDL備課諮詢｜${project.input.unitName}

請依下列步驟在 Gemini 建立私人 Gem：
1. 開啟 Gemini → Gem manager（Gem 管理）→ 新增 Gem。
2. 將下方「Gem 自訂指令」完整貼入 Gem 的 Instructions／自訂指令欄。
3. 將「本單元設計錨點」貼入知識／檔案區，或另存為 Markdown 後上傳；若介面只支援對話，請在建立後的第一則訊息貼上全部錨點並要求 Gem 記住為唯一依據。
4. 儲存後，課堂中遇到實施問題即可直接問此 Gem（例如時間不夠、學生卡關、證據不足、分組失衡、設備故障、差異化調整）。
5. 若你之後改了學習終點、評量證據或節次藍圖，請回到本工作室重新複製最新錨點並更新 Gem。

可用提問示例：
- 第 2 節還剩 10 分鐘，如何保留最關鍵的形成性證據？
- 學生在知識基礎第 3 題卡住，如何在不偏離成功指標的前提下給鷹架？
- 分組討論偏離真實任務，如何拉回本節 milestone？
- 出口單顯示多數學生未達某成功指標，下一節最小調整是什麼？

【本單元設計錨點｜請貼入或上傳給 Gem】
${designAnchorText}`;

  return {
    version: LESSON_PROMPT_PACKAGE_VERSION,
    projectId: project.id,
    lessonId: "unit-prep-coach-gem",
    target: "gemini_canvas",
    generatedAt: now,
    gemInstructions: UNIT_PREP_COACH_GEM_INSTRUCTIONS,
    lessonTaskPrompt: setupPrompt,
    fullPrompt: `【NPDL 備課諮詢 Gem｜完整建立包】

${setupPrompt}

────────────────
【請貼入 Gem 的自訂指令】
${UNIT_PREP_COACH_GEM_INSTRUCTIONS}
`,
  };
}
