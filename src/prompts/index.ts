import type { AssessmentTarget, CourseForm, Indicator } from "@/types";
import { ASSESSMENT_DOCUMENT_SCHEMA, buildAssessmentPatchSchema } from "@/lib/assessment-document";
import { buildStrategyPromptBlock } from "@/lib/assessment-strategies";
import { buildQuestionContractPromptBlock } from "@/lib/question-contracts";
import structuredGenerateSystem from "./generate/structured.txt?raw";
import ideationTemplate from "./ideation.txt?raw";

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

function indicatorBlock(indicator: Indicator | null, form: CourseForm): string {
  if (form.source === "自訂") {
    return `【自訂子指標】\n${form.customIndicator}`;
  }
  if (!indicator) return "";
  return `【子指標】${indicator.dimension}：${indicator.name}

【四進程官方敘述】
- 證據有限：${indicator.levels.evidence_limited}
- 萌芽：${indicator.levels.emerging}
- 發展：${indicator.levels.developing}
- 精熟：${indicator.levels.mastering}`;
}

export interface StructuredGenerationPrompt {
  stable: string;
  dynamic: string;
}

export function buildStructuredGeneratePrompt(
  form: CourseForm,
  indicator: Indicator | null,
  pdfExcerpt?: string,
): StructuredGenerationPrompt {
  const context = `【課程基本資料】
- 年級：${form.grade}
- 科目：${form.subject}
- 活動名稱：${form.activityName}
- 生活現象關鍵字：${form.lifeKeywords}
- 工具與證據：${form.tools.trim() || "課程工具"}

${indicatorBlock(indicator, form)}`;
  const pdfBlock = pdfExcerpt
    ? `\n【PDF 教案參考內容（只作背景；不得讓課前內容洩漏課程詞彙）】\n${pdfExcerpt.substring(0, 4000)}`
    : "";
  return {
    stable: `${structuredGenerateSystem.trim()}

${buildQuestionContractPromptBlock()}

【輸出資料契約】
只可輸出一個符合下列 JSON Schema 的 JSON 物件，不得輸出 Markdown、HTML、CSS、程式碼圍欄、題號、配分或版面標記：
${JSON.stringify(ASSESSMENT_DOCUMENT_SCHEMA)}`,
    dynamic: `${context}

${buildStrategyPromptBlock(form)}${pdfBlock}

請依上述課程資料完成 JSON Schema 的每個欄位。`,
  };
}

export function buildStructuredRepairPrompt(
  source: unknown,
  errors: string[],
  form: CourseForm,
  fullDocument: boolean,
  scenarioContext?: unknown,
  schema?: Record<string, unknown>,
): StructuredGenerationPrompt {
  const task = fullDocument
    ? "原始資料無法解析或包含全域結構錯誤，請輸出完整修正版。"
    : "只輸出 JSON Schema 要求的受影響欄位；不得改寫未提供的欄位。";
  return {
    stable: `${structuredGenerateSystem.trim()}\n\n${buildQuestionContractPromptBlock()}\n\n【修復模式】\n${task}\n\n【本次輸出 JSON Schema】\n${JSON.stringify(schema ?? ASSESSMENT_DOCUMENT_SCHEMA)}`,
    dynamic: `【必須修正的問題】
${errors.map((error, index) => `${index + 1}. ${error}`).join("\n")}

【課程資料】
- 年級：${form.grade}
- 科目：${form.subject}
- 活動名稱：${form.activityName}
- 生活現象關鍵字：${form.lifeKeywords}
- 工具與證據：${form.tools.trim() || "課程工具"}

${buildStrategyPromptBlock(form)}

【待修資料】
${JSON.stringify(source)}

【唯讀共用情境藍圖】
${JSON.stringify(scenarioContext ?? {})}
修復 Q1–Q4 時只能使用這份藍圖中的場景、證據、分歧、比較重點與限制；除非本次 Schema 明確要求 scenarioBlueprint，否則不得改寫藍圖。

直接輸出符合本次 JSON Schema 的修正版資料。`,
  };
}

export function buildStructuredRecoveryPrompt(
  raw: string,
  parseError: string,
  form: CourseForm,
): StructuredGenerationPrompt {
  return {
    stable: `${structuredGenerateSystem.trim()}\n\n${buildQuestionContractPromptBlock()}\n\n【JSON 修復模式】\n請保持原有教學內容品質，輸出完整且符合 JSON Schema 的評量資料。\n\n【本次輸出 JSON Schema】\n${JSON.stringify(ASSESSMENT_DOCUMENT_SCHEMA)}`,
    dynamic: `【解析錯誤】\n${parseError}\n\n【課程資料】\n年級：${form.grade}\n科目：${form.subject}\n活動：${form.activityName}\n生活關鍵字：${form.lifeKeywords}\n工具：${form.tools}\n\n${buildStrategyPromptBlock(form)}\n\n【原始回應】\n${raw.slice(0, 30000)}`,
  };
}

export function buildStructuredRefinePrompt(
  source: unknown,
  target: AssessmentTarget,
  instruction: string,
  form: CourseForm,
): StructuredGenerationPrompt {
  return {
    stable: `${structuredGenerateSystem.trim()}\n\n${buildQuestionContractPromptBlock()}\n\n【結構化微調模式】\n只輸出本次 JSON Schema 要求的 AssessmentPatch，不得輸出 Markdown、HTML、CSS、題號或版面程式碼。\n\n【本次輸出 JSON Schema】\n${JSON.stringify(buildAssessmentPatchSchema([target]))}`,
    dynamic: `【微調範圍】\n${target}\n\n【教師指令】\n${instruction}\n\n【課程資料】\n- 年級：${form.grade}\n- 科目：${form.subject}\n- 活動名稱：${form.activityName}\n- 生活現象關鍵字：${form.lifeKeywords}\n- 工具與證據：${form.tools}\n\n${buildStrategyPromptBlock(form)}\n\n【目前資料】\n${JSON.stringify(source)}\n\n只能改寫 Schema 內提供的欄位，其他欄位必須保持不變。直接輸出 JSON 物件。`,
  };
}

export function buildIdeationPrompt(form: CourseForm): string {
  return fillTemplate(ideationTemplate, {
    grade: form.grade || "未提供",
    subject: form.subject || "未提供",
    activityName: form.activityName,
    lifeKeywords: form.lifeKeywords || "未提供",
    tools: form.tools || "未提供",
  });
}

export function buildConnectionTestPrompt(): string {
  return "請只回覆一個字：「好」。";
}
