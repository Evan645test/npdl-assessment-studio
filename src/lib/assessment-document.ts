import type {
  AssessmentChoiceDocument,
  AssessmentDocument,
  AssessmentModuleDocument,
  AssessmentOpenQuestionDocument,
  AssessmentPatch,
  AssessmentQuestionDocument,
  AssessmentSection,
  AssessmentTarget,
  CourseForm,
  NarrativeDocument,
  NarrativeLevelDocument,
  ScenarioBlueprintDocument,
} from "@/types";
import {
  normalizeDecisionTask,
  renderGuidedQ4Markdown,
  renderScenarioFromBlueprint,
} from "@/lib/q4-guidance";
import {
  normalizeAssessmentQuestionStems,
  QUESTION_ABILITY_CONTRACTS,
  type AssessmentQuestionNumber,
} from "@/lib/question-contracts";

type JsonSchema = Record<string, unknown>;

const stringSchema = (description: string): JsonSchema => ({ type: "string", description });

function strictObject(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function questionSchema(number: AssessmentQuestionNumber): JsonSchema {
  const contract = QUESTION_ABILITY_CONTRACTS[number];
  const choiceSchema = strictObject({
    text: stringSchema(
      `學生看到的${contract.label}選項文字；不得含分數標記，長度需與其他選項相近。`,
    ),
    rationale: stringSchema(`教師解析；${contract.rationaleDescription}`),
  });
  return strictObject({
    stem: stringSchema(contract.stemDescription),
    options: {
      type: "array",
      description: contract.optionsDescription,
      items: choiceSchema,
      minItems: 4,
      maxItems: 4,
    },
  });
}

const q1QuestionSchema = questionSchema(1);
const q2QuestionSchema = questionSchema(2);
const q3QuestionSchema = questionSchema(3);

const studentExamplesSchema = strictObject({
  evidenceLimited: stringSchema("符合情境、第一人稱、1 至 2 句的證據有限層學生回答。"),
  emerging: stringSchema("符合情境、第一人稱、1 至 2 句的萌芽層學生回答。"),
  developing: stringSchema("符合情境、第一人稱、1 至 2 句的發展層學生回答。"),
  mastering: stringSchema("符合情境、第一人稱、1 至 2 句的精熟層學生回答。"),
});

const scenarioEvidenceSchema = strictObject({
  label: stringSchema("情境中可查看的資訊、紀錄、觀點、角色需求或行動線索短名稱。"),
  detail: stringSchema("該項資訊的具體內容，須能支持學生理解問題與選擇行動。"),
});

const scenarioBlueprintSchema = strictObject({
  setting: stringSchema("學生面對任務的簡短生活或遷移場景；不得重複證據、限制或活動名稱。"),
  contextFacts: {
    type: "array",
    description: "與判斷直接相關的 2 至 5 項背景事實。每項可完整說明必要資訊，不設字數上限。",
    items: { type: "string" },
    minItems: 2,
    maxItems: 5,
  },
  evidenceA: scenarioEvidenceSchema,
  evidenceB: scenarioEvidenceSchema,
  conflict: stringSchema("兩項資訊、觀點、需要或做法之間的具體分歧，以可直接接在「兩份資訊在」之後的片語撰寫。"),
  decisionTask: stringSchema("以判斷、決定、比較、確認或選擇開頭的短動詞片語，說明學生要完成的判斷。"),
  observationFocus: {
    type: "array",
    description: "共用情境中 2 至 3 個學生可直接查看、安排或檢查的重點，只寫名詞短語。",
    items: { type: "string" },
    minItems: 2,
    maxItems: 3,
  },
  constraint: stringSchema("共用情境中的新限制或工具失效條件，不要以如果、假如或若開頭。"),
});

const openQuestionSchema = strictObject({
  evidenceLimited: stringSchema("證據有限層的實質判定句。"),
  emerging: stringSchema("萌芽層的實質判定句。"),
  developing: stringSchema("發展層判定句，必須包含本次策略可操作的步驟、理由與檢查方式。"),
  mastering: stringSchema("精熟層判定句，必須包含新限制、方法調整、生活遷移與結果確認。"),
  studentExamples: studentExamplesSchema,
});

const conceptAnnotationsSchema = strictObject({
  correct: stringSchema("概念正確：指出學生回答中應出現的正確課程概念及其關係。"),
  partial: stringSchema("部分正確：指出已理解部分與仍缺少的關鍵連結。"),
  misconception: stringSchema("有迷思：指出常見但具體可辨識的錯誤概念，不可只寫『答錯』。"),
});

const transferAnnotationsSchema = strictObject({
  notYet: stringSchema("尚未遷移：只重述課堂做法，未連結生活情境的可辨識訊號。"),
  emerging: stringSchema("開始遷移：能套用部分方法，但尚未處理新條件或確認結果的訊號。"),
  adaptive: stringSchema("能調整遷移：能因生活限制調整方法並確認成效的可辨識訊號。"),
});

const postOpenQuestionSchema = strictObject({
  evidenceLimited: stringSchema("證據有限層的實質判定句。"),
  emerging: stringSchema("萌芽層的實質判定句。"),
  developing: stringSchema("發展層判定句，必須包含本次策略可操作的步驟、理由與檢查方式。"),
  mastering: stringSchema("精熟層判定句，必須包含新限制、方法調整、生活遷移與結果確認。"),
  studentExamples: studentExamplesSchema,
  conceptAnnotations: conceptAnnotationsSchema,
  transferAnnotations: transferAnnotationsSchema,
});

const narrativeLevelSchema = strictObject({
  classroomBehavior: stringSchema("可觀察的課堂行為特徵。"),
  verbalExpression: stringSchema("典型言語表達。"),
  lifeProjection: stringSchema("生活情境中的反應。"),
  motivationMonologue: stringSchema("第一人稱的學習動機或價值觀獨白。"),
  emotionalPain: stringSchema("客觀描述情緒、痛點或期待。"),
  keyActivity: stringSchema("突破此進程的微型任務。"),
  scaffold: stringSchema("可直接使用的工具、表單或步驟卡。"),
  teacherDialogue: stringSchema("老師可直接對學生說的一句引導話。"),
});

const narrativeSchema = strictObject({
  evidenceLimited: narrativeLevelSchema,
  emerging: narrativeLevelSchema,
  developing: narrativeLevelSchema,
  mastering: narrativeLevelSchema,
});

const preModuleSchema = strictObject({
  scenarioBlueprint: scenarioBlueprintSchema,
  q1: q1QuestionSchema,
  q2: q2QuestionSchema,
  q3: q3QuestionSchema,
  q4: openQuestionSchema,
  statistics: stringSchema("Q1 至 Q3 加總分的四級落點與判讀方式。"),
});

const postModuleSchema = strictObject({
  scenarioBlueprint: scenarioBlueprintSchema,
  q1: q1QuestionSchema,
  q2: q2QuestionSchema,
  q3: q3QuestionSchema,
  q4: postOpenQuestionSchema,
  statistics: stringSchema("Q1 至 Q3 加總分的四級落點，以及概念理解與生活遷移的人工對照方式。"),
});

export const ASSESSMENT_DOCUMENT_SCHEMA: JsonSchema = strictObject({
  narrative: narrativeSchema,
  pre: preModuleSchema,
  post: postModuleSchema,
});

export class AssessmentDocumentParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssessmentDocumentParseError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new AssessmentDocumentParseError(`${path} 必須是物件`);
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AssessmentDocumentParseError(`${path} 必須是非空字串`);
  }
  return value.trim();
}

function parseNarrativeLevel(value: unknown, path: string): NarrativeLevelDocument {
  const data = requireRecord(value, path);
  return {
    classroomBehavior: requireString(data.classroomBehavior, `${path}.classroomBehavior`),
    verbalExpression: requireString(data.verbalExpression, `${path}.verbalExpression`),
    lifeProjection: requireString(data.lifeProjection, `${path}.lifeProjection`),
    motivationMonologue: requireString(data.motivationMonologue, `${path}.motivationMonologue`),
    emotionalPain: requireString(data.emotionalPain, `${path}.emotionalPain`),
    keyActivity: requireString(data.keyActivity, `${path}.keyActivity`),
    scaffold: requireString(data.scaffold, `${path}.scaffold`),
    teacherDialogue: requireString(data.teacherDialogue, `${path}.teacherDialogue`),
  };
}

function parseNarrative(value: unknown, path = "narrative"): NarrativeDocument {
  const data = requireRecord(value, path);
  return {
    evidenceLimited: parseNarrativeLevel(data.evidenceLimited, `${path}.evidenceLimited`),
    emerging: parseNarrativeLevel(data.emerging, `${path}.emerging`),
    developing: parseNarrativeLevel(data.developing, `${path}.developing`),
    mastering: parseNarrativeLevel(data.mastering, `${path}.mastering`),
  };
}

function parseChoice(value: unknown, path: string): AssessmentChoiceDocument {
  const data = requireRecord(value, path);
  return {
    text: requireString(data.text, `${path}.text`),
    rationale: requireString(data.rationale, `${path}.rationale`),
  };
}

function parseQuestion(value: unknown, path: string): AssessmentQuestionDocument {
  const data = requireRecord(value, path);
  if (!Array.isArray(data.options) || data.options.length !== 4) {
    throw new AssessmentDocumentParseError(`${path}.options 必須剛好有四個選項`);
  }
  return {
    stem: requireString(data.stem, `${path}.stem`),
    options: [
      parseChoice(data.options[0], `${path}.options[0]`),
      parseChoice(data.options[1], `${path}.options[1]`),
      parseChoice(data.options[2], `${path}.options[2]`),
      parseChoice(data.options[3], `${path}.options[3]`),
    ],
  };
}

function parseScenarioBlueprint(value: unknown, path: string): ScenarioBlueprintDocument {
  const data = requireRecord(value, path);
  const evidenceA = requireRecord(data.evidenceA, `${path}.evidenceA`);
  const evidenceB = requireRecord(data.evidenceB, `${path}.evidenceB`);
  if (!Array.isArray(data.contextFacts) || data.contextFacts.length < 2 || data.contextFacts.length > 5) {
    throw new AssessmentDocumentParseError(`${path}.contextFacts 必須有二至五項`);
  }
  const contextFacts = data.contextFacts.map((item, index) =>
    requireString(item, `${path}.contextFacts[${index}]`),
  );
  if (
    !Array.isArray(data.observationFocus) ||
    data.observationFocus.length < 2 ||
    data.observationFocus.length > 3
  ) {
    throw new AssessmentDocumentParseError(`${path}.observationFocus 必須有二至三項`);
  }
  const observationFocus = data.observationFocus.map((item, index) =>
    requireString(item, `${path}.observationFocus[${index}]`),
  );
  const decisionTask = normalizeDecisionTask(
    requireString(data.decisionTask, `${path}.decisionTask`),
  );
  if (!decisionTask) {
    throw new AssessmentDocumentParseError(`${path}.decisionTask 正規化後不可為空`);
  }
  return {
    setting: requireString(data.setting, `${path}.setting`),
    contextFacts: contextFacts as ScenarioBlueprintDocument["contextFacts"],
    evidenceA: {
      label: requireString(evidenceA.label, `${path}.evidenceA.label`),
      detail: requireString(evidenceA.detail, `${path}.evidenceA.detail`),
    },
    evidenceB: {
      label: requireString(evidenceB.label, `${path}.evidenceB.label`),
      detail: requireString(evidenceB.detail, `${path}.evidenceB.detail`),
    },
    conflict: requireString(data.conflict, `${path}.conflict`),
    decisionTask,
    observationFocus: observationFocus as [string, string] | [string, string, string],
    constraint: requireString(data.constraint, `${path}.constraint`),
  };
}

function parseOpenQuestion(
  value: unknown,
  path: string,
  requirePostAnnotations = false,
): AssessmentOpenQuestionDocument {
  const data = requireRecord(value, path);
  const examples = requireRecord(data.studentExamples, `${path}.studentExamples`);
  const question: AssessmentOpenQuestionDocument = {
    evidenceLimited: requireString(data.evidenceLimited, `${path}.evidenceLimited`),
    emerging: requireString(data.emerging, `${path}.emerging`),
    developing: requireString(data.developing, `${path}.developing`),
    mastering: requireString(data.mastering, `${path}.mastering`),
    studentExamples: {
      evidenceLimited: requireString(examples.evidenceLimited, `${path}.studentExamples.evidenceLimited`),
      emerging: requireString(examples.emerging, `${path}.studentExamples.emerging`),
      developing: requireString(examples.developing, `${path}.studentExamples.developing`),
      mastering: requireString(examples.mastering, `${path}.studentExamples.mastering`),
    },
  };
  if (data.conceptAnnotations !== undefined) {
    const annotations = requireRecord(data.conceptAnnotations, `${path}.conceptAnnotations`);
    question.conceptAnnotations = {
      correct: requireString(annotations.correct, `${path}.conceptAnnotations.correct`),
      partial: requireString(annotations.partial, `${path}.conceptAnnotations.partial`),
      misconception: requireString(annotations.misconception, `${path}.conceptAnnotations.misconception`),
    };
  }
  if (data.transferAnnotations !== undefined) {
    const annotations = requireRecord(data.transferAnnotations, `${path}.transferAnnotations`);
    question.transferAnnotations = {
      notYet: requireString(annotations.notYet, `${path}.transferAnnotations.notYet`),
      emerging: requireString(annotations.emerging, `${path}.transferAnnotations.emerging`),
      adaptive: requireString(annotations.adaptive, `${path}.transferAnnotations.adaptive`),
    };
  }
  if (requirePostAnnotations && !question.conceptAnnotations) {
    throw new AssessmentDocumentParseError(`${path}.conceptAnnotations 必須完整提供`);
  }
  if (requirePostAnnotations && !question.transferAnnotations) {
    throw new AssessmentDocumentParseError(`${path}.transferAnnotations 必須完整提供`);
  }
  return question;
}

function parseModule(
  value: unknown,
  path: string,
  requirePostAnnotations = false,
): AssessmentModuleDocument {
  const data = requireRecord(value, path);
  return {
    scenarioBlueprint: parseScenarioBlueprint(data.scenarioBlueprint, `${path}.scenarioBlueprint`),
    q1: parseQuestion(data.q1, `${path}.q1`),
    q2: parseQuestion(data.q2, `${path}.q2`),
    q3: parseQuestion(data.q3, `${path}.q3`),
    q4: parseOpenQuestion(data.q4, `${path}.q4`, requirePostAnnotations),
    statistics: requireString(data.statistics, `${path}.statistics`),
  };
}

function unwrapJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    throw new AssessmentDocumentParseError(
      `結構化評量 JSON 無法解析：${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function parseAssessmentDocument(
  raw: string,
  options: { allowLegacyPostAnnotations?: boolean } = {},
): AssessmentDocument {
  const data = requireRecord(unwrapJson(raw), "assessment");
  return {
    narrative: parseNarrative(data.narrative),
    pre: parseModule(data.pre, "pre"),
    post: parseModule(data.post, "post", !options.allowLegacyPostAnnotations),
  };
}

function clean(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/```/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function renderNarrativeLevel(name: string, level: NarrativeLevelDocument): string {
  return `### 【${name}】

**進程辨識線索**：
- **👀 課堂行為特徵**：${clean(level.classroomBehavior)}
- **🗣️ 言語表達特徵**：${clean(level.verbalExpression)}
- **🏠 生活情境投射**：${clean(level.lifeProjection)}

**學生內在思考**：
- **🧠 學習動機與價值觀**：${clean(level.motivationMonologue)}
- **🌧️ 情緒與痛點**：${clean(level.emotionalPain)}

**教學引導與鷹架**：
- **🔑 關鍵活動設計**：${clean(level.keyActivity)}
- **🧰 輔助鷹架**：${clean(level.scaffold)}
- **💬 引導對話**：${clean(level.teacherDialogue)}`;
}

const QUESTION_TITLES = {
  pre: ["概念理解題", "行動應用題", "生活遷移題"],
  post: ["概念理解題", "行動應用題", "生活遷移題"],
} as const;

const QUESTION_SCORES = [
  [-1, 1, 2, 3],
  [1, 2, 3, 4],
  [1, 3, 5, 6],
] as const;

function signed(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

function renderQuestion(
  question: AssessmentQuestionDocument,
  number: 1 | 2 | 3,
  type: "pre" | "post",
): string {
  const labels = ["A", "B", "C", "D"] as const;
  const scores = QUESTION_SCORES[number - 1];
  const options = question.options
    .map((option, index) => `> (${labels[index]}) ${clean(option.text)}`)
    .join("\n");
  const rationales = question.options
    .map(
      (option, index) =>
        `${labels[index]}: ${signed(scores[index])} (${clean(option.rationale)})`,
    )
    .join("；");
  return `> **Q${number}. [${QUESTION_TITLES[type][number - 1]}]**：「${clean(question.stem)}」
${options}
> **教師解析**：${rationales}。`;
}

function renderModule(
  module: AssessmentModuleDocument,
  type: "pre" | "post",
  form: CourseForm,
): string {
  const heading = type === "pre" ? "課前：思維診斷" : "課後：轉折遷移";
  const scenario = type === "pre" ? "課前" : "課後";
  return `## ${heading}

**【${scenario}共用情境】**
${renderScenarioFromBlueprint(module.scenarioBlueprint, type, form)}

${renderQuestion(module.q1, 1, type)}

${renderQuestion(module.q2, 2, type)}

${renderQuestion(module.q3, 3, type)}

${renderGuidedQ4Markdown(module.q4, module.scenarioBlueprint, type, form)}

**【統計規格與總分落點標準】**
${clean(module.statistics)}`;
}

export function renderNarrativeMarkdown(narrative: NarrativeDocument): string {
  return `## 課程敘述語

${renderNarrativeLevel("證據有限", narrative.evidenceLimited)}

${renderNarrativeLevel("萌芽", narrative.emerging)}

${renderNarrativeLevel("發展", narrative.developing)}

${renderNarrativeLevel("精熟", narrative.mastering)}`;
}

export function renderAssessmentModuleMarkdown(
  module: AssessmentModuleDocument,
  type: "pre" | "post",
  form: CourseForm,
): string {
  return renderModule(module, type, form);
}

export function renderAssessmentMarkdown(document: AssessmentDocument, form: CourseForm): string {
  const normalizedDocument = normalizeAssessmentQuestionStems(document);
  return [
    renderNarrativeMarkdown(normalizedDocument.narrative),
    renderModule(normalizedDocument.pre, "pre", form),
    renderModule(normalizedDocument.post, "post", form),
  ].join("\n\n");
}

export function inferCompletedSections(raw: string): AssessmentSection[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && parsed.narrative && parsed.pre && parsed.post) {
      return ["narrative", "pre", "post"];
    }
  } catch {
    // 串流尚未完整時 JSON 解析失敗是預期狀態。
  }
  const preStarted = /"pre"\s*:/.test(raw) || /^## 課前/m.test(raw);
  const postStarted = /"post"\s*:/.test(raw) || /^## 課後/m.test(raw);
  if (postStarted) return ["narrative", "pre"];
  if (preStarted) return ["narrative"];
  return [];
}

export function inferGenerationSection(raw: string): AssessmentSection {
  const positions = [
    { section: "narrative" as const, index: Math.max(raw.lastIndexOf('"narrative"'), raw.lastIndexOf("## 課程敘述語")) },
    { section: "pre" as const, index: Math.max(raw.lastIndexOf('"pre"'), raw.lastIndexOf("## 課前")) },
    { section: "post" as const, index: Math.max(raw.lastIndexOf('"post"'), raw.lastIndexOf("## 課後")) },
  ];
  return positions.sort((a, b) => b.index - a.index)[0]?.section ?? "narrative";
}

function schemaForTarget(target: AssessmentTarget): JsonSchema {
  if (target === "narrative") return narrativeSchema;
  if (target.endsWith(".scenario")) return scenarioBlueprintSchema;
  if (target.endsWith(".statistics")) return { type: "string" };
  if (target.endsWith(".q1")) return q1QuestionSchema;
  if (target.endsWith(".q2")) return q2QuestionSchema;
  if (target.endsWith(".q3")) return q3QuestionSchema;
  if (target === "post.q4") return postOpenQuestionSchema;
  if (target === "pre.q4") return openQuestionSchema;
  return ASSESSMENT_DOCUMENT_SCHEMA;
}

export function buildAssessmentPatchSchema(targets: AssessmentTarget[]): JsonSchema {
  if (targets.includes("global")) return ASSESSMENT_DOCUMENT_SCHEMA;
  const root: Record<string, JsonSchema> = {};
  if (targets.includes("narrative")) root.narrative = narrativeSchema;
  for (const section of ["pre", "post"] as const) {
    const fields = targets.filter((target) => target.startsWith(`${section}.`));
    if (fields.length === 0) continue;
    const properties: Record<string, JsonSchema> = {};
    for (const target of fields) {
      const field = target.split(".")[1];
      properties[field === "scenario" ? "scenarioBlueprint" : field] = schemaForTarget(target);
    }
    root[section] = strictObject(properties);
  }
  return strictObject(root);
}

export function parseAssessmentPatch(raw: string, targets: AssessmentTarget[]): AssessmentPatch | AssessmentDocument {
  if (targets.includes("global")) return parseAssessmentDocument(raw);
  const data = requireRecord(unwrapJson(raw), "patch");
  const patch: AssessmentPatch = {};
  if (targets.includes("narrative")) patch.narrative = parseNarrative(data.narrative, "patch.narrative");
  for (const section of ["pre", "post"] as const) {
    const sectionTargets = targets.filter((target) => target.startsWith(`${section}.`));
    if (sectionTargets.length === 0) continue;
    const source = requireRecord(data[section], `patch.${section}`);
    const modulePatch: Partial<AssessmentModuleDocument> = {};
    for (const target of sectionTargets) {
      const requestedField = target.split(".")[1];
      const field = (requestedField === "scenario" ? "scenarioBlueprint" : requestedField) as keyof AssessmentModuleDocument;
      const path = `patch.${section}.${field}`;
      if (field === "scenarioBlueprint") {
        modulePatch.scenarioBlueprint = parseScenarioBlueprint(source[field], path);
      } else if (field === "statistics") {
        modulePatch.statistics = requireString(source[field], path);
      }
      else if (field === "q4") {
        modulePatch.q4 = parseOpenQuestion(source.q4, path, section === "post");
      }
      else modulePatch[field] = parseQuestion(source[field], path);
    }
    patch[section] = modulePatch;
  }
  return patch;
}

export function mergeAssessmentPatch(
  document: AssessmentDocument,
  patch: AssessmentPatch | AssessmentDocument,
  targets: AssessmentTarget[],
): AssessmentDocument {
  if (targets.includes("global")) return patch as AssessmentDocument;
  const scoped = patch as AssessmentPatch;
  return {
    narrative: scoped.narrative ?? document.narrative,
    pre: { ...document.pre, ...(scoped.pre ?? {}) },
    post: { ...document.post, ...(scoped.post ?? {}) },
  };
}

export function selectAssessmentPatchSource(
  document: AssessmentDocument,
  targets: AssessmentTarget[],
): AssessmentPatch | AssessmentDocument {
  if (targets.includes("global")) return document;
  const patch: AssessmentPatch = {};
  if (targets.includes("narrative")) patch.narrative = document.narrative;
  for (const section of ["pre", "post"] as const) {
    const modulePatch: Partial<AssessmentModuleDocument> = {};
    for (const target of targets.filter((item) => item.startsWith(`${section}.`))) {
      const requestedField = target.split(".")[1];
      const field = (requestedField === "scenario" ? "scenarioBlueprint" : requestedField) as keyof AssessmentModuleDocument;
      Object.assign(modulePatch, { [field]: document[section][field] });
    }
    if (Object.keys(modulePatch).length > 0) patch[section] = modulePatch;
  }
  return patch;
}

export function selectAssessmentRepairContext(
  document: AssessmentDocument,
  targets: AssessmentTarget[],
): Partial<Record<"pre" | "post", ScenarioBlueprintDocument>> {
  const context: Partial<Record<"pre" | "post", ScenarioBlueprintDocument>> = {};
  for (const section of ["pre", "post"] as const) {
    if (targets.some((target) => target.startsWith(`${section}.`))) {
      context[section] = document[section].scenarioBlueprint;
    }
  }
  return context;
}
