import {
  buildAssessmentPatchSchema,
  parseAssessmentPatch,
  renderAssessmentMarkdown,
  renderAssessmentModuleMarkdown,
  renderNarrativeMarkdown,
} from "@/lib/assessment-document";
import { getIndicatorById } from "@/data/indicators";
import type {
  AssessmentDocument,
  AssessmentModuleDocument,
  AssessmentPatch,
  AssessmentTarget,
  CourseForm,
} from "@/types";
import type {
  AssessmentDesignContext,
  AssessmentQuestionAlignment,
  CourseAssessmentSeedV1,
  CourseIdeationInput,
  DesiredResults,
  EvidencePlanResult,
  UnitBlueprintResult,
} from "@/types/course-ideation";

export const COURSE_ASSESSMENT_SEED_VERSION = 1 as const;

export const COURSE_ASSESSMENT_SEED_TARGETS: AssessmentTarget[] = [
  "narrative",
  "pre.scenario",
  "pre.q1",
  "pre.q2",
  "pre.q3",
  "pre.q4",
  "pre.statistics",
];

export const POST_ASSESSMENT_TARGETS: AssessmentTarget[] = [
  "post.scenario",
  "post.q1",
  "post.q2",
  "post.q3",
  "post.q4",
  "post.statistics",
];

export const COURSE_ASSESSMENT_SEED_SCHEMA = buildAssessmentPatchSchema(
  COURSE_ASSESSMENT_SEED_TARGETS,
);

export const POST_ASSESSMENT_SCHEMA = buildAssessmentPatchSchema(
  POST_ASSESSMENT_TARGETS,
);

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function fingerprintPayload(input: {
  course: CourseIdeationInput;
  selectedIndicatorId: string;
  desiredResults: DesiredResults;
  evidencePlan: EvidencePlanResult;
}) {
  const { assessmentDocument: _assessmentDocument, ...evidencePlan } =
    input.evidencePlan;
  return {
    course: input.course,
    selectedIndicatorId: input.selectedIndicatorId,
    desiredResults: input.desiredResults,
    evidencePlan,
  };
}

export function buildCourseAssessmentSourceFingerprint(input: {
  course: CourseIdeationInput;
  selectedIndicatorId: string;
  desiredResults: DesiredResults;
  evidencePlan: EvidencePlanResult;
}): string {
  return `course-assessment-v1-${fnv1a(
    JSON.stringify(fingerprintPayload(input)),
  )}`;
}

export function buildAssessmentDesignSourceFingerprint(input: {
  assessmentSeedSourceFingerprint: string;
  unitBlueprint: UnitBlueprintResult | null;
}): string {
  return `assessment-design-v1-${fnv1a(
    JSON.stringify({
      assessmentSeedSourceFingerprint:
        input.assessmentSeedSourceFingerprint,
      unitBlueprint: input.unitBlueprint,
    }),
  )}`;
}

export function buildAssessmentQuestionAlignments(
  evidencePlan: EvidencePlanResult,
): {
  preMappings: AssessmentQuestionAlignment[];
  plannedPostMappings: AssessmentQuestionAlignment[];
} {
  const mapPhase = (
    phase: "pre" | "post",
  ): AssessmentQuestionAlignment[] => {
    const map = evidencePlan.questionMaps.find((item) => item.phase === phase);
    if (!map || map.questions.length !== 4) {
      throw new Error(
        `${phase === "pre" ? "診斷性" : "遷移性"}四階參照不完整。`,
      );
    }
    const expectedIds = ["Q1", "Q2", "Q3", "Q4"] as const;
    return expectedIds.map((id) => {
      const question = map.questions.find((item) => item.id === id);
      if (!question) {
        throw new Error(
          `${phase === "pre" ? "課前" : "課後"}缺少 ${id} 證據目的。`,
        );
      }
      return {
        questionKey:
          `${phase}.${id.toLowerCase()}` as AssessmentQuestionAlignment["questionKey"],
        purpose: question.purpose,
        focus: question.focus,
        criterionIds: [...question.criterionIds],
        observableEvidence: question.observableEvidence,
      };
    });
  };
  return {
    preMappings: mapPhase("pre"),
    plannedPostMappings: mapPhase("post"),
  };
}

function requireSeedPatch(
  raw: string,
): {
  narrative: CourseAssessmentSeedV1["narrative"];
  pre: CourseAssessmentSeedV1["pre"];
} {
  const patch = parseAssessmentPatch(
    raw,
    COURSE_ASSESSMENT_SEED_TARGETS,
  ) as AssessmentPatch;
  if (!patch.narrative || !patch.pre) {
    throw new Error("AI 回應缺少課程敘述語或診斷題組。");
  }
  const pre = patch.pre as Partial<AssessmentModuleDocument>;
  if (
    !pre.scenarioBlueprint ||
    !pre.q1 ||
    !pre.q2 ||
    !pre.q3 ||
    !pre.q4 ||
    !pre.statistics
  ) {
    throw new Error("AI 回應的課前題組欄位不完整。");
  }
  return {
    narrative: patch.narrative,
    pre: pre as AssessmentModuleDocument,
  };
}

export function parseCourseAssessmentSeed(
  raw: string,
  input: {
    model: string;
    sourceFingerprint: string;
    evidencePlan: EvidencePlanResult;
  },
): CourseAssessmentSeedV1 {
  const parsed = requireSeedPatch(raw);
  const mappings = buildAssessmentQuestionAlignments(input.evidencePlan);
  return {
    version: COURSE_ASSESSMENT_SEED_VERSION,
    generatedAt: Date.now(),
    model: input.model,
    sourceFingerprint: input.sourceFingerprint,
    narrative: parsed.narrative,
    pre: parsed.pre,
    preMappings: mappings.preMappings,
    plannedPostMappings: mappings.plannedPostMappings,
    mode: "ai_generated",
  };
}

export function parsePostAssessmentModule(raw: string): AssessmentModuleDocument {
  const patch = parseAssessmentPatch(raw, POST_ASSESSMENT_TARGETS) as AssessmentPatch;
  const post = patch.post as Partial<AssessmentModuleDocument> | undefined;
  if (
    !post?.scenarioBlueprint ||
    !post.q1 ||
    !post.q2 ||
    !post.q3 ||
    !post.q4 ||
    !post.statistics
  ) {
    throw new Error("AI 回應的課後題組欄位不完整。");
  }
  return post as AssessmentModuleDocument;
}

function normalizedComparisonText(value: string): string {
  return value.replace(/\s+/g, "").toLocaleLowerCase("zh-Hant");
}

export function assertPostAssessmentDiffersFromPre(
  pre: AssessmentModuleDocument,
  post: AssessmentModuleDocument,
): void {
  const sameScenarioParts = [
    [
      pre.scenarioBlueprint.setting,
      post.scenarioBlueprint.setting,
    ],
    [
      `${pre.scenarioBlueprint.evidenceA.label}${pre.scenarioBlueprint.evidenceA.detail}${pre.scenarioBlueprint.evidenceB.label}${pre.scenarioBlueprint.evidenceB.detail}`,
      `${post.scenarioBlueprint.evidenceA.label}${post.scenarioBlueprint.evidenceA.detail}${post.scenarioBlueprint.evidenceB.label}${post.scenarioBlueprint.evidenceB.detail}`,
    ],
    [
      pre.scenarioBlueprint.constraint,
      post.scenarioBlueprint.constraint,
    ],
  ].filter(
    ([before, after]) =>
      normalizedComparisonText(before) === normalizedComparisonText(after),
  ).length;
  if (sameScenarioParts === 3) {
    throw new Error(
      "課後評量必須使用新的情境、資料或限制，不可直接重複課前情境。",
    );
  }
}

export function isCourseAssessmentSeedCurrent(
  seed: CourseAssessmentSeedV1 | null | undefined,
  sourceFingerprint: string,
): seed is CourseAssessmentSeedV1 {
  return Boolean(
    seed &&
      seed.version === COURSE_ASSESSMENT_SEED_VERSION &&
      seed.sourceFingerprint === sourceFingerprint &&
      seed.preMappings.length === 4 &&
      seed.plannedPostMappings.length === 4,
  );
}

export function validateCourseAssessmentSeed(
  seed: CourseAssessmentSeedV1,
  sourceFingerprint: string,
): string[] {
  const errors: string[] = [];
  if (seed.version !== COURSE_ASSESSMENT_SEED_VERSION) {
    errors.push("課程評量種子版本不支援。");
  }
  if (seed.sourceFingerprint !== sourceFingerprint) {
    errors.push("學習終點或評量證據已變更，診斷題組需要重新產生。");
  }
  for (const [level, content] of Object.entries(seed.narrative)) {
    if (
      !content ||
      Object.values(content).some(
        (value) => typeof value !== "string" || !value.trim(),
      )
    ) {
      errors.push(`課程敘述語 ${level} 欄位不完整。`);
    }
  }
  try {
    requireSeedPatch(
      JSON.stringify({
        narrative: seed.narrative,
        pre: seed.pre,
      }),
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? `課前題組結構不完整：${error.message}`
        : "課前題組結構不完整。",
    );
  }
  try {
    const expected: AssessmentQuestionAlignment["questionKey"][] = [
      "pre.q1",
      "pre.q2",
      "pre.q3",
      "pre.q4",
      "post.q1",
      "post.q2",
      "post.q3",
      "post.q4",
    ];
    const actual = [
      ...seed.preMappings,
      ...seed.plannedPostMappings,
    ].map((item) => item.questionKey);
    if (
      actual.length !== expected.length ||
      expected.some((key) => !actual.includes(key))
    ) {
      errors.push("診斷／遷移四階參照對齊映射不完整。");
    }
  } catch {
    errors.push("診斷／遷移四階參照對齊映射無法驗證。");
  }
  return errors;
}

export {
  renderDiagnosticQuestionsMarkdown,
  renderDiagnosticTeacherGuideMarkdown,
} from "@/lib/diagnostic-export-documents";

export function renderCourseAssessmentSeedMarkdown(
  seed: CourseAssessmentSeedV1,
  form: CourseForm,
): string {
  return [
    renderNarrativeMarkdown(seed.narrative),
    renderAssessmentModuleMarkdown(seed.pre, "pre", form),
  ].join("\n\n");
}

export function assembleAssessmentDocument(
  seed: CourseAssessmentSeedV1,
  post: AssessmentModuleDocument,
): AssessmentDocument {
  return {
    narrative: structuredClone(seed.narrative),
    pre: structuredClone(seed.pre),
    post,
  };
}

function list(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function mappingsMarkdown(
  mappings: AssessmentQuestionAlignment[],
): string {
  return mappings
    .map(
      (mapping) =>
        `- **${mapping.questionKey.toUpperCase()}**｜${mapping.purpose}｜成功指標：${mapping.criterionIds.join(
          "、",
        )}｜預期證據：${mapping.observableEvidence}`,
    )
    .join("\n");
}

export function buildAssessmentEvidencePackageMarkdown(input: {
  context: AssessmentDesignContext;
  document: AssessmentDocument;
  form: CourseForm;
  implementationNotes?: string;
}): string {
  const { context, document, form } = input;
  const curriculum = context.curriculum.map(
    (entry) =>
      `- ${entry.code}｜${
        entry.kind === "learning_performance" ? "學習表現" : "學習內容"
      }｜${entry.text}`,
  );
  const rubric = context.academicRubric.flatMap((criterion) => [
    `### ${criterion.criterionId}`,
    `- 證據有限：${criterion.levels.evidenceLimited}`,
    `- 萌芽：${criterion.levels.emerging}`,
    `- 發展：${criterion.levels.developing}`,
    `- 精熟：${criterion.levels.mastering}`,
  ]);
  const task = context.performanceTask;
  const indicator = getIndicatorById(context.selectedIndicatorId);
  const officialProgression = indicator
    ? [
        `- 證據有限：${indicator.levels.evidence_limited}`,
        `- 萌芽：${indicator.levels.emerging}`,
        `- 發展：${indicator.levels.developing}`,
        `- 精熟：${indicator.levels.mastering}`,
      ]
    : ["- 本專案使用自訂子向度，無內建官方進程文字。"];
  const summary = [
    "# NPDL 課程與評量證據包",
    "",
    `- 年級：${form.grade}`,
    `- 科目：${form.subject}`,
    `- 課程：${form.activityName}`,
    `- 主要 NPDL 子向度：${context.selectedIndicatorId}`,
    "",
    "## 課綱依據",
    "",
    curriculum.join("\n"),
    "",
    "## 學習終點與成功指標",
    "",
    "### 遷移目標",
    list(context.transferGoals),
    "",
    "### 核心理解",
    list(context.enduringUnderstandings),
    "",
    "### 核心問題",
    list(context.essentialQuestions),
    "",
    "### 成功指標",
    list(
      context.successCriteria.map(
        (criterion) => `${criterion.id}｜${criterion.text}`,
      ),
    ),
    "",
    "## 真實總結任務",
    "",
    task
      ? list([
          `目標：${task.goal}`,
          `角色：${task.role}`,
          `受眾：${task.audience}`,
          `情境：${task.situation}`,
          `成果：${task.product}`,
          `對應成功指標：${task.criterionIds.join("、")}`,
        ])
      : "- 尚未建立",
    "",
    "## 四階參照對齊表",
    "",
    "### 課前",
    mappingsMarkdown(context.courseAssessmentSeed?.preMappings ?? []),
    "",
    "### 課後",
    mappingsMarkdown(
      context.courseAssessmentSeed?.plannedPostMappings ?? [],
    ),
    "",
    "## 學科成功指標四級規準",
    "",
    rubric.join("\n"),
    "",
    "## NPDL 子向度官方四級進程",
    "",
    indicator
      ? `### ${indicator.dimension}｜${indicator.name}`
      : `### ${context.selectedIndicatorId || "自訂子向度"}`,
    officialProgression.join("\n"),
  ];
  const notes = input.implementationNotes?.trim()
    ? [
        "",
        "## 設計差異說明（課後改寫依據）",
        "",
        input.implementationNotes.trim(),
      ]
    : [];
  return [...summary, ...notes, "", renderAssessmentMarkdown(document, form)]
    .join("\n")
    .trim();
}
