import {
  formatTeacherExplanationFallback,
  getQuestionPreviewSummary,
  parseTeacherQ4Content,
} from "@/lib/assessment-teacher-display";
import {
  implementationGroupLabel,
  implementationItemLabel,
  implementationItemWithFocus,
  questionKeyToIndex,
} from "@/lib/assessment-terminology";
import { parseAssessmentModule, parseGuidedQ4Text } from "@/lib/parse-assessment";
import type { CourseForm, ParsedQuestion } from "@/types";
import type {
  AssessmentQuestionAlignment,
  CourseAssessmentSeedV1,
} from "@/types/course-ideation";
import { renderNarrativeMarkdown } from "@/lib/assessment-document";

function documentHeader(input: {
  title: string;
  form: CourseForm;
  unitName?: string;
  indicatorName?: string;
  note: string;
}): string[] {
  const indicatorLine = input.indicatorName?.trim()
    ? `- NPDL 子向度：${input.indicatorName.trim()}`
    : "";
  return [
    `# ${input.title}`,
    "",
    `- 年級：${input.form.grade}`,
    `- 科目：${input.form.subject}`,
    `- 單元：${input.unitName?.trim() || input.form.activityName}`,
    indicatorLine,
    "",
    `> ${input.note}`,
    "",
  ].filter(Boolean);
}

function cleanOptionLine(option: string): string {
  return option.replace(/^>\s?/, "").replace(/\*\*/g, "").trim();
}

function renderStudentQuestionBlock(
  question: ParsedQuestion,
  index: number,
  mapping?: AssessmentQuestionAlignment,
): string[] {
  const label = mapping?.focus
    ? implementationItemWithFocus("pre", index, mapping.focus)
    : implementationItemLabel("pre", index);
  const lines = [`## ${label}`, ""];

  if (question.rawTitle.includes("Q4")) {
    const guided = parseGuidedQ4Text(question.text);
    if (guided.stem) {
      lines.push(guided.stem, "");
    }
    for (const step of guided.steps) {
      lines.push(`### 步驟 ${step.number}｜${step.label}`, "", step.prompt, "");
      if (step.focusHint) {
        lines.push(`- 先看哪裡：${step.focusHint}`, "");
      }
      if (step.sentenceStarter) {
        lines.push(`- 可以這樣開始：${step.sentenceStarter}`, "");
      }
      lines.push("（請用 1–2 句話回答）", "");
    }
    return lines;
  }

  const stem = getQuestionPreviewSummary(question.text, question.rawTitle);
  if (stem) lines.push(stem, "");
  if (question.options.length > 0) {
    lines.push("**選項**", "");
    for (const option of question.options) {
      lines.push(`- ${cleanOptionLine(option)}`, "");
    }
  }
  return lines;
}

function renderTeacherQuestionBlock(
  question: ParsedQuestion,
  index: number,
  mapping?: AssessmentQuestionAlignment,
): string[] {
  const label = mapping?.focus
    ? implementationItemWithFocus("pre", index, mapping.focus)
    : implementationItemLabel("pre", index);
  const lines = [`### ${label}｜教師判讀`, ""];

  if (mapping) {
    lines.push(
      `- **評量目的**：${mapping.purpose}`,
      `- **成功指標**：${mapping.criterionIds.join("、")}`,
      `- **預期證據**：${mapping.observableEvidence}`,
      "",
    );
  }

  if (question.rawTitle.includes("Q4")) {
    const parsed = parseTeacherQ4Content(question.explanation);
    if (parsed.rubrics.some((item) => !item.missing)) {
      lines.push("**四層進程判定**", "");
      for (const item of parsed.rubrics) {
        if (item.missing) continue;
        lines.push(`- **${item.level}**：${item.body}`, "");
        if (item.example) {
          lines.push(`  - 學生可能回答：${item.example}`, "");
        }
      }
    }
    if (parsed.transitions.some((item) => item.achieved || item.notYet)) {
      lines.push("**進程跨界線索**", "");
      for (const item of parsed.transitions) {
        lines.push(`- ${item.label}`, "");
        if (item.achieved) lines.push(`  - 已跨界：${item.achieved}`, "");
        if (item.notYet) lines.push(`  - 尚未跨界：${item.notYet}`, "");
        lines.push("");
      }
    }
    const fallback = formatTeacherExplanationFallback(question.explanation);
    if (lines.length <= (mapping ? 5 : 2) && fallback.length > 0) {
      lines.push(...fallback, "");
    }
    return lines;
  }

  const explanation = formatTeacherExplanationFallback(question.explanation);
  if (explanation.length > 0) {
    lines.push("**選項進程說明**", "");
    lines.push(...explanation.map((line) => `- ${line}`), "");
  }
  return lines;
}

function extractScoringBlock(content: string): string {
  const marker = "【統計規格與總分落點標準】";
  const index = content.indexOf(marker);
  return index >= 0 ? content.slice(index).trim() : "";
}

function diagnosticGuideMappingsMarkdown(
  mappings: AssessmentQuestionAlignment[],
): string {
  return mappings
    .map(
      (mapping) =>
        `- **${implementationItemLabel("pre", questionKeyToIndex(mapping.questionKey))}**｜${mapping.purpose}｜成功指標：${mapping.criterionIds.join(
          "、",
        )}｜預期證據：${mapping.observableEvidence}`,
    )
    .join("\n");
}

export function renderDiagnosticQuestionsMarkdown(input: {
  form: CourseForm;
  unitName?: string;
  indicatorName?: string;
  preContent: string;
}): string {
  const parsed = parseAssessmentModule(input.preContent, "pre");
  return [
    ...documentHeader({
      title: "診斷題組（題目卷）",
      form: input.form,
      unitName: input.unitName,
      indicatorName: input.indicatorName,
      note: "本文件只含共用情境與診斷一～四題目，供課前診斷使用；教師判讀請另下載《診斷指南》。",
    }),
    "## 共用情境",
    "",
    parsed.scenario || "（尚未解析共用情境）",
    "",
    ...parsed.questions.flatMap((question, index) =>
      renderStudentQuestionBlock(question, index),
    ),
  ].join("\n");
}

export function renderDiagnosticTeacherGuideMarkdown(
  seed: CourseAssessmentSeedV1,
  form: CourseForm,
  input: {
    unitName?: string;
    indicatorName?: string;
    preContent: string;
  },
): string {
  const parsed = parseAssessmentModule(input.preContent, "pre");
  const scoringBlock = extractScoringBlock(input.preContent);
  return [
    ...documentHeader({
      title: "診斷指南（教師用）",
      form,
      unitName: input.unitName,
      indicatorName: input.indicatorName,
      note: "本文件供教師備課、判讀與課前實施使用；學生題目請另下載《診斷題組（題目卷）》，線上填答請用 Google Form。",
    }),
    "## 使用方式",
    "",
    "1. 先閱讀四級課程敘述語，掌握本課進程期待。",
    `2. 依${implementationGroupLabel("pre")}（診斷一～四）的評量目的、教師判讀與落點標準準備課前實施。`,
    "3. 學生題目與教師判讀分開輸出；請勿把本指南直接發給學生。",
    "",
    "## 四階參照對齊",
    "",
    diagnosticGuideMappingsMarkdown(seed.preMappings),
    "",
    renderNarrativeMarkdown(seed.narrative),
    "",
    "## 教師判讀與規準",
    "",
    ...parsed.questions.flatMap((question, index) =>
      renderTeacherQuestionBlock(question, index, seed.preMappings[index]),
    ),
    scoringBlock ? `## 落點計分標準\n\n${scoringBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
