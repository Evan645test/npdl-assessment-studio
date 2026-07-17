import { splitModules } from "@/lib/markdown";
import { parseAssessmentModule, parseGuidedQ4Text } from "@/lib/parse-assessment";
import { GUIDED_Q4_LABELS } from "@/lib/q4-guidance";
import {
  QUESTION_ABILITY_CONTRACTS,
  questionStemSatisfiesContract,
} from "@/lib/question-contracts";
import type { AssessmentTarget, CourseForm } from "@/types";

export interface ValidationIssue {
  severity: "error" | "warning";
  message: string;
  targets: AssessmentTarget[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

function inferIssueTargets(message: string): AssessmentTarget[] {
  if (message === "產出為空" || message.includes("code fence") || message.includes("## 標題")) {
    return ["global"];
  }
  if (message.includes("課程敘述語") || message.includes("進程「")) return ["narrative"];

  for (const [label, section] of [["課前", "pre"], ["課後", "post"]] as const) {
    if (!message.includes(label)) continue;
    const question = message.match(/Q([1-4])/i)?.[1];
    if (question) return [`${section}.q${question}` as AssessmentTarget];
    if (message.includes("情境")) return [`${section}.scenario`];
    if (message.includes("統計") || message.includes("總分落點")) return [`${section}.statistics`];
    return ["global"];
  }
  return ["global"];
}

function buildValidationResult(errors: string[], warnings: string[]): ValidationResult {
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    issues: [
      ...errors.map((message) => ({
        severity: "error" as const,
        message,
        targets: inferIssueTargets(message),
      })),
      ...warnings.map((message) => ({
        severity: "warning" as const,
        message,
        targets: inferIssueTargets(message),
      })),
    ],
  };
}

export function getErrorTargets(result: ValidationResult): AssessmentTarget[] {
  const targets = new Set<AssessmentTarget>();
  for (const issue of result.issues) {
    if (issue.severity === "error") issue.targets.forEach((target) => targets.add(target));
  }
  return targets.has("global") ? ["global"] : [...targets];
}

const PROGRESSION_NAMES = ["證據有限", "萌芽", "發展", "精熟"] as const;

const NARRATIVE_SECTIONS = ["進程辨識線索", "學生內在思考", "教學引導與鷹架"] as const;

const PREVIEW_FORBIDDEN_TERMS = [
  "等一下要做",
  "實驗前",
  "上課會學到",
  "本堂課",
  "課程目標",
  "學習目標",
  "實驗室",
  "探究活動",
  "公式",
  "定理",
  "反應速率",
  "化學反應",
  "濃度",
  "催化",
  "活化能",
] as const;

const Q4_STUDENT_JARGON = [
  "原理內化",
  "高階遷移",
  "進程判定",
  "規準",
  "查核精神",
  "認知策略",
] as const;

const Q4_STEP_ONE_CUES = ["問題", "概念", "學到", "理解", "線索", "關係", "告訴"] as const;
const Q4_STEP_TWO_ACTION_CUES = [
  "步驟",
  "行動",
  "做法",
  "安排",
  "選擇",
  "比較",
  "負責",
  "表達",
  "判斷",
  "分工",
  "溝通",
] as const;
const Q4_STEP_TWO_REASON_CUES = ["理由", "為什麼", "因為", "如何", "怎麼", "用什麼", "說明", "解釋"] as const;
const Q4_STEP_THREE_TRANSFER_CUES = ["生活", "另一個", "新的", "新情況", "新情境"] as const;
const Q4_STEP_THREE_LIMIT_CUES = ["如果", "假如", "不能", "無法", "缺漏", "缺少", "不足", "限制", "失效", "情況", "換成"] as const;
const Q4_STEP_THREE_ACTION_CUES = ["調整", "改變", "改用", "替代", "補充", "重新", "換"] as const;
const Q4_STEP_THREE_VERIFY_CUES = ["確認", "驗證", "檢查", "比對", "結果", "回饋", "有效"] as const;
const Q4_ANSWERISH_PROMPT_CUES = ["我會", "我會先", "因此我選", "所以我選", "我較相信", "我的答案"] as const;
const Q4_DECISION_VERBS = ["判斷", "決定", "比較", "確認", "選擇"] as const;

const ESCAPE_OPTION_PATTERNS = [
  /以上皆是/,
  /以上皆非/,
  /都可以/,
  /看情況/,
  /無法判斷/,
  /不需要處理/,
] as const;

const EXPECTED_SCORES: Record<1 | 2 | 3, number[]> = {
  1: [-1, 1, 2, 3],
  2: [1, 2, 3, 4],
  3: [1, 3, 5, 6],
};

function tokenizeForOverlap(text: string): Set<string> {
  const cleaned = text.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "");
  const tokens = new Set<string>();
  for (let size = 2; size <= 4; size += 1) {
    for (let index = 0; index <= cleaned.length - size; index += 1) {
      tokens.add(cleaned.slice(index, index + size));
    }
  }
  return tokens;
}

function overlapRatio(a: string, b: string): number {
  const left = tokenizeForOverlap(a);
  const right = tokenizeForOverlap(b);
  if (left.size === 0 || right.size === 0) return 0;
  let hit = 0;
  for (const token of left) {
    if (right.has(token)) hit += 1;
  }
  return hit / Math.min(left.size, right.size);
}

function extractRubricLevelText(q4Section: string, level: string): string {
  const match = q4Section.match(
    new RegExp(`-\\s*\\*\\*${level}[^\\*]*\\*\\*[:：]?\\s*([^\\n]+)`, "i"),
  );
  return match?.[1]?.trim() ?? "";
}

function getQ4Section(block: string): string {
  return block.match(/\*\*Q4[^]*?(?=\*\*【統計|$)/s)?.[0] ?? "";
}

interface Q4ContextMetadata {
  strategyId?: string;
  decisionTask: string;
  evidenceA: string;
  evidenceB: string;
  observationFocus: string[];
  constraint: string;
}

function extractQ4ContextMetadata(q4: string): Q4ContextMetadata | null {
  const match = q4.match(/\*\*情境核對資料\*\*[:：]\s*(\{[^\n]+\})/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as Partial<Q4ContextMetadata>;
    if (
      typeof parsed.decisionTask !== "string" ||
      typeof parsed.evidenceA !== "string" ||
      typeof parsed.evidenceB !== "string" ||
      !Array.isArray(parsed.observationFocus) ||
      !parsed.observationFocus.every((item) => typeof item === "string") ||
      typeof parsed.constraint !== "string"
    ) {
      return null;
    }
    return parsed as Q4ContextMetadata;
  } catch {
    return null;
  }
}

function validateQ4Discrimination(
  block: string,
  label: "課前" | "課後",
  errors: string[],
  warnings: string[],
): void {
  const q4 = getQ4Section(block);
  if (!q4) return;

  if (/發展→精熟|Transitional/i.test(q4)) {
    errors.push(`${label} Q4 使用舊三層格式（發展→精熟），無法穩定鑑別四層進程`);
  }

  const developing = extractRubricLevelText(q4, "發展");
  const mastering = extractRubricLevelText(q4, "精熟");
  if (!developing || !mastering) {
    errors.push(`${label} Q4 缺少「發展」或「精熟」判定句`);
    return;
  }

  const parsed = parseAssessmentModule(block, label === "課前" ? "pre" : "post");
  const question = parsed.questions.find((item) => item.rawTitle.includes("Q4"));
  if (!question) return;
  const guided = parseGuidedQ4Text(question.text);
  if (guided.steps.length !== 3) {
    errors.push(`${label} Q4 缺少完整的三步引導式問答`);
  } else {
    if (question.rawTitle.includes("[引導式簡答題]") && !guided.scaffolded) {
      errors.push(`${label} Q4 缺少「先看哪裡」或「可以這樣開始」作答鷹架`);
    }
    if (guided.steps.some((step, index) => step.label !== GUIDED_Q4_LABELS[index])) {
      errors.push(`${label} Q4 三欄必須依序為「概念理解、行動應用、生活遷移」`);
    }
    for (const step of guided.steps) {
      const length = compactLength(step.prompt);
      if (length < 20 || length > 150 || !/[？?]/.test(step.prompt)) {
        errors.push(`${label} Q4 第 ${step.number} 步必須是 20–150 字的直接問句`);
      }
      const answerish = Q4_ANSWERISH_PROMPT_CUES.find((cue) => step.prompt.includes(cue));
      if (answerish) {
        errors.push(`${label} Q4 第 ${step.number} 步出現答案化語句「${answerish}」`);
      }
      if (guided.scaffolded) {
        if (compactLength(step.focusHint) < 12 || compactLength(step.focusHint) > 70) {
          errors.push(`${label} Q4 第 ${step.number} 步「先看哪裡」提示長度不合理`);
        }
        if (!/[＿＿_]{2,}/.test(step.sentenceStarter) || !/[我我們]/.test(step.sentenceStarter)) {
          errors.push(`${label} Q4 第 ${step.number} 步句型起點必須含第一人稱與填答空格`);
        }
      }
    }
    if (!includesAny(guided.steps[0].prompt, Q4_STEP_ONE_CUES)) {
      errors.push(`${label} Q4「概念理解」未引出學生對問題、概念或重要線索的說明`);
    }
    if (
      !includesAny(guided.steps[1].prompt, Q4_STEP_TWO_ACTION_CUES) ||
      !includesAny(guided.steps[1].prompt, Q4_STEP_TWO_REASON_CUES)
    ) {
      errors.push(`${label} Q4「行動應用」未同時引出可執行做法與理由`);
    }
    if (
      !includesAny(guided.steps[2].prompt, Q4_STEP_THREE_TRANSFER_CUES) ||
      !includesAny(guided.steps[2].prompt, Q4_STEP_THREE_LIMIT_CUES) ||
      !includesAny(guided.steps[2].prompt, Q4_STEP_THREE_ACTION_CUES) ||
      !includesAny(guided.steps[2].prompt, Q4_STEP_THREE_VERIFY_CUES)
    ) {
      errors.push(`${label} Q4「生活遷移」未同時引出新情境、限制、方法調整與結果確認`);
    }
    if (
      overlapRatio(guided.steps[0].prompt, guided.steps[1].prompt) >= 0.55 ||
      overlapRatio(guided.steps[1].prompt, guided.steps[2].prompt) >= 0.55
    ) {
        errors.push(`${label} Q4 三步內容過度重複，未形成概念理解、行動應用、生活遷移的階梯`);
    }
  }

  const studentFacingText = `${guided.stem}\n${guided.steps
    .map((step) => `${step.prompt}\n${step.focusHint}\n${step.sentenceStarter}`)
    .join("\n")}`;
  const jargon = Q4_STUDENT_JARGON.find((term) => studentFacingText.includes(term));
  if (jargon) errors.push(`${label} Q4 學生文字使用教師端抽象術語「${jargon}」`);

  if (question.rawTitle.includes("[引導式簡答題]")) {
    const context = extractQ4ContextMetadata(q4);
    if (!context) {
      errors.push(`${label} Q4 缺少可驗證的情境要素資料`);
    } else {
      if (!Q4_DECISION_VERBS.some((verb) => context.decisionTask.startsWith(verb))) {
        errors.push(`${label} Q4 判斷任務必須以判斷、決定、比較、確認或選擇開頭`);
      }
      if (compactLength(context.decisionTask) < 4 || compactLength(context.decisionTask) > 60) {
        errors.push(`${label} Q4 判斷任務內容過短或過長，必須是可直接執行的單一任務`);
      }
      if (context.evidenceA === context.evidenceB) {
        errors.push(`${label} Q4 兩份證據名稱不得相同`);
      }
      if (context.observationFocus.length < 2 || context.observationFocus.length > 3) {
        errors.push(`${label} Q4 比較重點必須有 2–3 項`);
      }
      if (
        [context.evidenceA, context.evidenceB, ...context.observationFocus].some(
          (value) => compactLength(value) < 2 || compactLength(value) > 80,
        ) ||
        compactLength(context.constraint) < 2 ||
        compactLength(context.constraint) > 160
      ) {
        errors.push(`${label} Q4 情境線索、觀察重點或限制的文字長度不合理`);
      }
      const invalidFragment = [
        context.decisionTask,
        context.evidenceA,
        context.evidenceB,
        ...context.observationFocus,
        context.constraint,
      ].find((value) => /[?？]|\*\*|^\s*(?:如果|假如|若)\b/.test(value) || /我會|我選/.test(value));
      if (invalidFragment) {
        errors.push(`${label} Q4 情境要素含問句、Markdown、第一人稱答案或不合格條件句`);
      }
    }
  }

  const transitionLines = [...q4.matchAll(
    /\*\*(萌芽\s*→\s*發展|發展\s*→\s*精熟)｜(已跨界證據|尚未跨界訊號)\*\*[:：]\s*([^\n]+)/g,
  )];
  if (transitionLines.length !== 4) {
    errors.push(`${label} Q4 必須包含兩組跨界判讀的已跨界證據與尚未跨界訊號`);
  } else {
    const emergingDeveloping = transitionLines
      .filter((match) => /萌芽\s*→\s*發展/.test(match[1]))
      .map((match) => match[3])
      .join(" ");
    const developingMastering = transitionLines
      .filter((match) => /發展\s*→\s*精熟/.test(match[1]))
      .map((match) => match[3])
      .join(" ");
    if (
      !includesAny(emergingDeveloping, Q4_STEP_TWO_ACTION_CUES) ||
      !includesAny(emergingDeveloping, Q4_STEP_TWO_REASON_CUES)
    ) {
      errors.push(`${label} Q4 萌芽→發展判讀缺少可執行行動、策略或理由`);
    }
    if (
      !includesAny(developingMastering, Q4_STEP_THREE_LIMIT_CUES) ||
      !includesAny(developingMastering, Q4_STEP_THREE_ACTION_CUES) ||
      !includesAny(developingMastering, Q4_STEP_THREE_VERIFY_CUES)
    ) {
      errors.push(`${label} Q4 發展→精熟判讀缺少限制、調整或確認／遷移線索`);
    }
  }

  if (label === "課後") {
    const conceptLabels = ["概念正確", "部分正確", "有迷思"];
    const transferLabels = ["尚未遷移", "開始遷移", "能調整遷移"];
    if (
      !q4.includes("教師概念理解註記") ||
      conceptLabels.some((item) => !new RegExp(`\\*\\*${item}\\*\\*[:：]\\s*[^\\n]+`).test(q4))
    ) {
      warnings.push("課後 Q4 缺少完整的概念理解人工對照註記；舊草稿仍可使用，新生成內容應補齊");
    }
    if (
      !q4.includes("教師生活遷移註記") ||
      transferLabels.some((item) => !new RegExp(`\\*\\*${item}\\*\\*[:：]\\s*[^\\n]+`).test(q4))
    ) {
      warnings.push("課後 Q4 缺少完整的生活遷移人工對照註記；舊草稿仍可使用，新生成內容應補齊");
    }
  }

  const examples = [...q4.matchAll(/\*\*學生可能回答\*\*[:：]\s*[「"]?([^」"\n]+)[」"]?/g)].map(
    (match) => match[1].trim(),
  );
  if (examples.length !== 4) {
    errors.push(`${label} Q4 必須提供四層各一個學生回答範例`);
  } else {
    if (examples.some((example) => !/[我我們]/.test(example))) {
      errors.push(`${label} Q4 學生回答範例必須使用第一人稱`);
    }
    const exampleJargon = Q4_STUDENT_JARGON.find((term) => examples.some((example) => example.includes(term)));
    if (exampleJargon) errors.push(`${label} Q4 學生回答範例使用抽象術語「${exampleJargon}」`);
  }
}

function moduleByKeyword(markdown: string, keyword: string): string {
  return splitModules(markdown).find((part) => part.includes(keyword)) ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compactLength(value: string): number {
  return Array.from(value.replace(/\s/g, "")).length;
}

function includesAny(value: string, terms: readonly string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function extractScenario(block: string, label: "課前" | "課後"): string {
  const marker = `【${label}共用情境】`;
  const start = block.indexOf(marker);
  if (start < 0) return "";
  const after = block.slice(start + marker.length);
  const end = after.search(/\*\*Q1\.|>\s*\*\*Q1\./);
  return (end < 0 ? after : after.slice(0, end)).replace(/\*/g, "").trim();
}

function countQuestions(block: string): number {
  const matches = block.match(/\*\*Q[1-4][^\n*]*/g);
  return matches?.length ?? 0;
}

function hasChoiceOptions(block: string, qNum: 1 | 2 | 3): boolean {
  const qRe = new RegExp(`\\*\\*Q${qNum}[^]*?(?=\\*\\*Q[1-4]|\\*\\*【統計|$)`, "s");
  const section = block.match(qRe)?.[0] ?? "";
  return /\(A\)/.test(section) && /\(B\)/.test(section) && /\(C\)/.test(section) && /\(D\)/.test(section);
}

function getQuestionSection(block: string, qNum: 1 | 2 | 3): string {
  const qRe = new RegExp(`\\*\\*Q${qNum}[^]*?(?=\\*\\*Q[1-4]|\\*\\*【統計|$)`, "s");
  return block.match(qRe)?.[0] ?? "";
}

function hasTeacherParse(block: string, qNum: 1 | 2 | 3): boolean {
  const section = getQuestionSection(block, qNum);
  if (!/教師解析/.test(section)) return false;
  return /A:\s*[+-]?\d+/i.test(section);
}

function extractOptions(section: string): string[] {
  return [...section.matchAll(/^\s*>?\s*\(([A-D])\)\s*([^\n]+)/gm)].map((match) =>
    `(${match[1]}) ${match[2].trim()}`,
  );
}

function extractQuestionStem(section: string): string {
  return section.match(/\*\*Q[1-3]\.[^*]*\*\*[:：]?\s*[「"]?([^」"\n]+)[」"]?/)?.[1]?.trim() ?? "";
}

function extractTeacherScores(section: string): Map<string, number> {
  const scores = new Map<string, number>();
  const parseStart = section.search(/教師解析/);
  const source = parseStart >= 0 ? section.slice(parseStart) : section;
  for (const match of source.matchAll(/([A-D])\s*[:：]\s*([+-]?\d+)/gi)) {
    scores.set(match[1].toUpperCase(), Number(match[2]));
  }
  return scores;
}

function hasQ4Rubric(block: string): boolean {
  const q4 = block.match(/\*\*Q4[^]*?(?=\*\*【統計|$)/s)?.[0] ?? "";
  return (
    /教師進程判定標準/.test(q4) &&
    /證據有限/.test(q4) &&
    /萌芽/.test(q4) &&
    /發展/.test(q4) &&
    (/精熟/.test(q4) || /mastering/i.test(q4))
  );
}

function optionsExposeScores(block: string): boolean {
  return /^\s*>\s*\([A-D]\)[^\n]*\(\s*[+-]?\d+\s*\)/m.test(block);
}

function validateScenarioQuality(
  block: string,
  label: "課前" | "課後",
  form: CourseForm,
  errors: string[],
): void {
  const scenario = extractScenario(block, label);
  if (!scenario) return;

  if (label === "課前") {
    const forbidden = [
      form.activityName.trim(),
      form.subject.trim(),
      ...PREVIEW_FORBIDDEN_TERMS,
    ].filter((term) => term.length >= 2);

    const leaked = forbidden.find((term) => new RegExp(escapeRegExp(term), "i").test(scenario));
    if (leaked) {
      errors.push(`課前情境出現課程洩漏詞「${leaked}」，不符合零課程詞彙`);
    }
    return;
  }

  const activity = form.activityName.trim();
  if (activity.length >= 3 && !scenario.includes(activity)) {
    errors.push("課後情境必須明確提及活動名稱，呈現已完成課堂活動後的遷移");
  }

}

function validateQuestionQuality(
  block: string,
  label: "課前" | "課後",
  errors: string[],
): void {
  for (const q of [1, 2, 3] as const) {
    const section = getQuestionSection(block, q);
    if (!section) continue;
    const expectedTitle = `${QUESTION_ABILITY_CONTRACTS[q].label}題`;
    if (!section.includes(`[${expectedTitle}]`)) {
      errors.push(`${label} Q${q} 必須對應「${expectedTitle.replace("題", "")}」能力欄位`);
    }
    const stem = extractQuestionStem(section);
    if (!questionStemSatisfiesContract(stem, q)) {
      errors.push(`${label} Q${q} 題幹未明確引出「${expectedTitle.replace("題", "")}」能力`);
    }

    const options = extractOptions(section);
    if (options.some((option) => ESCAPE_OPTION_PATTERNS.some((pattern) => pattern.test(option)))) {
      errors.push(`${label} Q${q} 含逃避型選項（例如以上皆是、都可以、無法判斷）`);
    }
    if (options.length === 4) {
      const lengths = options.map((option) =>
        compactLength(option.replace(/^\([A-D]\)\s*/, "")),
      );
      const shortest = Math.min(...lengths);
      const longest = Math.max(...lengths);
      if (shortest > 0 && longest - shortest > 18 && longest / shortest > 1.8) {
        errors.push(`${label} Q${q} 選項長度差異過大，可能洩漏高分選項`);
      }
      const high = lengths[3];
      const otherAverage = (lengths[0] + lengths[1] + lengths[2]) / 3;
      if (high - otherAverage > 10 && high > otherAverage * 1.45) {
        errors.push(`${label} Q${q} 高分選項明顯較長，可能讓答案過於明顯`);
      }
    }

    const scores = extractTeacherScores(section);
    const missingLetters = ["A", "B", "C", "D"].filter((letter) => !scores.has(letter));
    if (missingLetters.length > 0) {
      errors.push(`${label} Q${q} 教師解析缺少 ${missingLetters.join("、")} 選項分數`);
    }

    const expected = EXPECTED_SCORES[q].slice().sort((a, b) => a - b).join(",");
    const actual = [...scores.values()].sort((a, b) => a - b).join(",");
    if (scores.size === 4 && actual !== expected) {
      errors.push(`${label} Q${q} 教師解析分數組合錯誤，應為 ${EXPECTED_SCORES[q].map((score) => (score > 0 ? `+${score}` : `${score}`)).join("、")}`);
    }
  }

}

export function validateGeneratedMarkdown(
  markdown: string,
  form: CourseForm,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const trimmed = markdown.trim();

  if (!trimmed) {
    return buildValidationResult(["產出為空"], []);
  }

  if (/```/.test(trimmed)) {
    errors.push("產出包含 code fence（```），請重新生成");
  }

  const h2Matches = [...trimmed.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  const expectedH2 = ["課程敘述語", "課前：思維診斷", "課後：轉折遷移"];
  for (const title of expectedH2) {
    if (!h2Matches.includes(title)) {
      errors.push(`缺少二級標題「## ${title}」`);
    }
  }
  if (h2Matches.length !== 3) errors.push(`偵測到 ${h2Matches.length} 個 ## 標題（必須剛好 3 個）`);

  const narrative = moduleByKeyword(trimmed, "課程敘述語");
  const pre = moduleByKeyword(trimmed, "課前");
  const post = moduleByKeyword(trimmed, "課後");

  if (!narrative) errors.push("無法解析「課程敘述語」模組");
  if (!pre) errors.push("無法解析「課前：思維診斷」模組");
  if (!post) errors.push("無法解析「課後：轉折遷移」模組");

  for (const name of PROGRESSION_NAMES) {
    if (!narrative.includes(`【${name}】`)) {
      errors.push(`課程敘述語缺少進程「【${name}】」`);
    }
  }
  for (const section of NARRATIVE_SECTIONS) {
    if (!narrative.includes(section)) {
      errors.push(`課程敘述語缺少段落「${section}」`);
    }
  }

  if (!pre.includes("【課前共用情境】")) {
    errors.push("課前模組缺少「【課前共用情境】」");
  }
  if (!post.includes("【課後共用情境】")) {
    errors.push("課後模組缺少「【課後共用情境】」");
  }

  if (countQuestions(pre) < 4) {
    errors.push(`課前模組應有 Q1–Q4（目前約 ${countQuestions(pre)} 題）`);
  }
  if (countQuestions(post) < 4) {
    errors.push(`課後模組應有 Q1–Q4（目前約 ${countQuestions(post)} 題）`);
  }

  for (const q of [1, 2, 3] as const) {
    if (!hasChoiceOptions(pre, q)) errors.push(`課前 Q${q} 缺少 (A)–(D) 選項`);
    if (!hasChoiceOptions(post, q)) errors.push(`課後 Q${q} 缺少 (A)–(D) 選項`);
    if (!hasTeacherParse(pre, q)) errors.push(`課前 Q${q} 教師解析格式不完整（應含 A: 分數）`);
    if (!hasTeacherParse(post, q)) errors.push(`課後 Q${q} 教師解析格式不完整（應含 A: 分數）`);
  }

  if (!hasQ4Rubric(pre)) errors.push("課前 Q4 缺少「教師進程判定標準」四層描述（證據有限/萌芽/發展/精熟）");
  if (!hasQ4Rubric(post)) errors.push("課後 Q4 缺少「教師進程判定標準」四層描述（證據有限/萌芽/發展/精熟）");

  if (!pre.includes("【統計規格與總分落點標準】")) {
    errors.push("課前模組缺少「【統計規格與總分落點標準】」");
  }
  if (!post.includes("【統計規格與總分落點標準】")) {
    errors.push("課後模組缺少「【統計規格與總分落點標準】」");
  }

  if (optionsExposeScores(pre) || optionsExposeScores(post)) {
    errors.push("選項文字中出現 (+1) 等分數標記（分數應只寫在教師解析）");
  }

  validateScenarioQuality(pre, "課前", form, errors);
  validateScenarioQuality(post, "課後", form, errors);
  validateQuestionQuality(pre, "課前", errors);
  validateQuestionQuality(post, "課後", errors);
  validateQ4Discrimination(pre, "課前", errors, warnings);
  validateQ4Discrimination(post, "課後", errors, warnings);

  const activity = form.activityName.trim();
  if (activity.length >= 3) {
    const preScenario = extractScenario(pre, "課前");
    if (preScenario && preScenario.includes(activity)) {
      errors.push("課前共用情境不應出現活動名稱（零課程詞彙違規）");
    }
  }

  return buildValidationResult(errors, warnings);
}
