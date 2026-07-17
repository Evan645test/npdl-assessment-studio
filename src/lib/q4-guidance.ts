import type {
  AssessmentOpenQuestionDocument,
  CourseForm,
  ScenarioBlueprintDocument,
} from "@/types";
import {
  getAssessmentStrategy,
  getGradeBand,
} from "@/lib/assessment-strategies";

export const GUIDED_Q4_LABELS = [
  "概念理解",
  "行動應用",
  "生活遷移",
] as const;

export interface GuidedQ4Step {
  number: 1 | 2 | 3;
  label: string;
  prompt: string;
  focusHint: string;
  sentenceStarter: string;
}

export interface BuiltGuidedQ4 {
  stem: string;
  steps: [GuidedQ4Step, GuidedQ4Step, GuidedQ4Step];
}

const CONTEXT_MARKERS = {
  setting: "共用情境藍圖｜場景",
  decisionTask: "Q4情境要素｜判斷任務",
  evidenceA: "Q4情境要素｜證據A",
  evidenceADetail: "共用情境藍圖｜證據A內容",
  evidenceB: "Q4情境要素｜證據B",
  evidenceBDetail: "共用情境藍圖｜證據B內容",
  conflict: "共用情境藍圖｜分歧",
  observationFocus: "Q4情境要素｜比較重點",
  constraint: "Q4情境要素｜新限制",
} as const;

function cleanInline(value: string): string {
  return value
    .replace(/!\[([^\]]*)]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*/g, "")
    .replace(/[*_`#]/g, "")
    .replace(/[「」]/g, "")
    .replace(/```/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function withoutEndingPunctuation(value: string): string {
  return cleanInline(value).replace(/[。；;，,：:？！?!]+$/g, "");
}

const DECISION_TASK_VERBS = ["判斷", "決定", "比較", "確認", "選擇"] as const;
const DECISION_TASK_PREFIX = /^(?:請\s*學生|請|學生\s*(?:需要|要|應該|應)|需要|要)\s*/;

export function normalizeDecisionTask(value: string): string {
  let normalized = cleanInline(value)
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[`*_#]/g, "")
    .replace(/[？?]/g, "")
    .replace(/^[\s：:]+|[\s。；;，,：:！!]+$/g, "")
    .trim();

  let previous = "";
  while (normalized && normalized !== previous) {
    previous = normalized;
    normalized = normalized
      .replace(DECISION_TASK_PREFIX, "")
      .replace(/^[\s：:]+/, "")
      .trim();
  }

  if (!normalized) return "";
  return DECISION_TASK_VERBS.some((verb) => normalized.startsWith(verb))
    ? normalized
    : `判斷${normalized}`;
}

function actionApplicationPrompt(
  strategyId: ReturnType<typeof getAssessmentStrategy>["id"],
  decisionTask: string,
  focusText: string,
  junior: boolean,
): string {
  if (junior) {
    switch (strategyId) {
      case "learning_reflection":
        return `要${decisionTask}，你會先做什麼、再做什麼？請說明最後要看哪個結果。`;
      case "perspective_impact":
        return `要${decisionTask}，誰會受到影響？請寫出你的做法，並說明為什麼。`;
      case "stakeholder_action":
        return `要${decisionTask}，可以由誰先做什麼？請說明這個做法照顧了哪些需要。`;
      case "role_collaboration":
        return `要${decisionTask}，大家要怎麼分工？請寫出第一步和一起確認的時間。`;
      case "audience_communication":
        return `要${decisionTask}，你想對誰說、要說什麼？請選一種表達方式並說明理由。`;
      case "idea_action_check":
        return `要${decisionTask}，你會怎麼開始？請寫出第一步、需要的幫手或工具，以及要看哪個結果。`;
      case "evidence_reason_revise":
        return `要${decisionTask}，你會用哪個相同條件比較？請從${focusText}中找出內容說明理由。`;
    }
  }

  switch (strategyId) {
    case "learning_reflection":
      return `為了${decisionTask}，你會怎麼做？請排出第一步和下一步，並說明何時查看${focusText}來知道自己有沒有繼續前進。`;
    case "perspective_impact":
      return `為了${decisionTask}，你會怎麼做？請先說出誰會受到影響，再提出一個可以做到的選擇，並用${focusText}說明理由。`;
    case "stakeholder_action":
      return `為了${decisionTask}，你會怎麼做？請提出一個能照顧不同需要的做法，說明由誰先做什麼，並用${focusText}解釋取捨。`;
    case "role_collaboration":
      return `為了${decisionTask}，你會怎麼安排合作？請寫出角色、第一個步驟和確認時間，並說明大家如何用${focusText}互相配合。`;
    case "audience_communication":
      return `為了${decisionTask}，你會怎麼表達？請選定溝通對象、最重要的訊息和表達方式，並用${focusText}說明為什麼適合。`;
    case "idea_action_check":
      return `為了${decisionTask}，你會怎麼開始？請把想法排成步驟，寫出先做什麼、需要誰或什麼資源，以及如何查看${focusText}。`;
    case "evidence_reason_revise":
      return `為了${decisionTask}，你會用哪一個相同條件比較兩份資料？請再用${focusText}中的具體內容說明判斷理由。`;
  }
}

function actionFocusHint(
  strategyId: ReturnType<typeof getAssessmentStrategy>["id"],
): string {
  switch (strategyId) {
    case "learning_reflection":
      return "不要只寫「更努力」；要有可以開始的步驟和看得到的結果。";
    case "perspective_impact":
      return "同時看看自己和別人的需要，再說明選擇可能帶來的影響。";
    case "stakeholder_action":
      return "說清楚誰先做什麼，也要交代這個做法照顧了哪些需要。";
    case "role_collaboration":
      return "分工之外，還要寫出何時互相確認，以及遇到問題怎麼支援。";
    case "audience_communication":
      return "先想受眾需要知道什麼，再選內容、說法或媒介。";
    case "idea_action_check":
      return "把想法變成有先後順序的步驟，並寫出需要的角色或資源。";
    case "evidence_reason_revise":
      return "把兩份資料放在同一條件下比較，理由要引用看得到的內容。";
  }
}

function actionSentenceStarter(
  strategyId: ReturnType<typeof getAssessmentStrategy>["id"],
): string {
  switch (strategyId) {
    case "learning_reflection":
      return "我會先＿＿，接著＿＿；完成後看＿＿，就能知道＿＿。";
    case "perspective_impact":
      return "我會先考慮＿＿和＿＿的需要，再選擇＿＿，因為＿＿。";
    case "stakeholder_action":
      return "我建議由＿＿先做＿＿，同時照顧＿＿，因為＿＿。";
    case "role_collaboration":
      return "我會請＿＿負責＿＿，我負責＿＿；我們在＿＿一起確認。";
    case "audience_communication":
      return "我要對＿＿說＿＿，會用＿＿方式，因為這樣能＿＿。";
    case "idea_action_check":
      return "我想完成＿＿；第一步先＿＿，接著＿＿，並用＿＿查看效果。";
    case "evidence_reason_revise":
      return "我會用＿＿作為相同條件；照這個條件看，我判斷＿＿，因為資料中＿＿。";
  }
}

export function buildGuidedQ4(
  blueprint: ScenarioBlueprintDocument,
  type: "pre" | "post",
  form: CourseForm,
): BuiltGuidedQ4 {
  const strategy = getAssessmentStrategy(form);
  const junior = getGradeBand(form.grade) === "junior";
  const decisionTask = normalizeDecisionTask(blueprint.decisionTask);
  const evidenceA = withoutEndingPunctuation(blueprint.evidenceA.label);
  const evidenceB = withoutEndingPunctuation(blueprint.evidenceB.label);
  const focus = blueprint.observationFocus.map(withoutEndingPunctuation);
  const constraint = withoutEndingPunctuation(blueprint.constraint).replace(/^(?:如果|假如|若)\s*/, "");
  const focusText = focus.join("、");
  const lifeTheme = withoutEndingPunctuation(form.lifeKeywords) || "相近的生活問題";
  const conceptPrompt = type === "post"
    ? junior
      ? `完成「${withoutEndingPunctuation(form.activityName)}」後，你學到哪一個方法能幫你${decisionTask}？請用自己的話說明。`
      : `完成「${withoutEndingPunctuation(form.activityName)}」後，哪一個課堂方法或概念能幫你${decisionTask}？請用自己的話說明它和「${evidenceA}」或「${evidenceB}」有什麼關係？`
    : junior
      ? `這個情況要解決什麼問題？「${evidenceA}」和「${evidenceB}」各告訴你什麼？`
      : `先用自己的話說明：這個情境真正要解決什麼問題？「${evidenceA}」和「${evidenceB}」各提供了什麼重要線索？`;
  const conceptHint = type === "post"
    ? "不用背課本句子；說清楚這個概念能幫你看懂或處理什麼。"
    : "先說問題和兩個重要線索，不用猜老師想要的標準答案。";
  const transferPrompt = junior
    ? `現在把同一個做法用到「${lifeTheme}」的另一個情況。遇到「${constraint}」時，要調整哪一步？還要看什麼結果，才能知道做法有用？`
    : `現在把同一個方法用到「${lifeTheme}」的另一個生活情況。遇到「${constraint}」時，你會調整哪個步驟？還要蒐集什麼結果或回饋，才能確認做法有效？`;

  return {
    stem: type === "pre"
      ? `請依序完成三個小步驟，讓老師了解你現在如何理解問題、把想法變成行動，以及能不能用到新的生活情況。`
      : `請依序完成三個小步驟，說明你從課程學懂什麼、實際會怎麼做，以及能不能把方法用到新的生活情況。`,
    steps: [
      {
        number: 1,
        label: GUIDED_Q4_LABELS[0],
        prompt: conceptPrompt,
        focusHint: conceptHint,
        sentenceStarter: type === "post"
          ? "我學到的＿＿是＿＿；它能幫我看懂／處理＿＿，因為＿＿。"
          : "我認為現在要解決的是＿＿；「＿＿」告訴我＿＿，而「＿＿」告訴我＿＿。",
      },
      {
        number: 2,
        label: GUIDED_Q4_LABELS[1],
        prompt: actionApplicationPrompt(strategy.id, decisionTask, focusText, junior),
        focusHint: actionFocusHint(strategy.id),
        sentenceStarter: actionSentenceStarter(strategy.id),
      },
      {
        number: 3,
        label: GUIDED_Q4_LABELS[2],
        prompt: transferPrompt,
        focusHint: "不要只換地點或人物；要寫出限制、調整的做法，以及確認結果的方法。",
        sentenceStarter:
          "在＿＿的生活情況中，如果遇到＿＿，我會把＿＿改成＿＿；之後用＿＿確認結果。",
      },
    ],
  };
}

function renderStep(step: GuidedQ4Step): string {
  return `> **${["①", "②", "③"][step.number - 1]} ${step.label}**
> **問題**：${step.prompt}
> **先看哪裡**：${step.focusHint}
> **可以這樣開始**：${step.sentenceStarter}`;
}

export function renderScenarioFromBlueprint(
  blueprint: ScenarioBlueprintDocument,
  type: "pre" | "post",
  form: CourseForm,
): string {
  const setting = withoutEndingPunctuation(blueprint.setting);
  const evidenceA = withoutEndingPunctuation(blueprint.evidenceA.label);
  const evidenceADetail = withoutEndingPunctuation(blueprint.evidenceA.detail)
    .replace(/^(?:顯示|記載|指出|說明)\s*/, "");
  const evidenceB = withoutEndingPunctuation(blueprint.evidenceB.label);
  const evidenceBDetail = withoutEndingPunctuation(blueprint.evidenceB.detail)
    .replace(/^(?:顯示|記載|指出|說明)\s*/, "");
  const conflict = withoutEndingPunctuation(blueprint.conflict);
  const constraint = withoutEndingPunctuation(blueprint.constraint);
  const decisionTask = normalizeDecisionTask(blueprint.decisionTask);
  const contextFacts = (blueprint.contextFacts ?? [])
    .map(withoutEndingPunctuation)
    .filter(Boolean)
    .map((fact) => `${fact}。`)
    .join("\n");
  const lifeTheme = withoutEndingPunctuation(form.lifeKeywords);
  const prefix = type === "post"
    ? `完成「${withoutEndingPunctuation(form.activityName)}」後，學生回到${lifeTheme ? `「${lifeTheme}」相關的` : "新的"}生活情境：`
    : lifeTheme
      ? `在「${lifeTheme}」相關的生活情境中，`
      : "";
  return `${prefix}${setting}。\n${contextFacts}\n「${evidenceA}」顯示${evidenceADetail}；「${evidenceB}」則顯示${evidenceBDetail}。兩份資訊在${conflict}，目前又有「${constraint}」的限制。你的任務是${decisionTask}，並說明如何把想法化為行動、檢查結果與調整做法。`;
}

export function renderGuidedQ4Markdown(
  question: AssessmentOpenQuestionDocument,
  blueprint: ScenarioBlueprintDocument,
  type: "pre" | "post",
  form: CourseForm,
): string {
  const guided = buildGuidedQ4(blueprint, type, form);
  const strategy = getAssessmentStrategy(form);
  const examples = question.studentExamples;
  const contextMetadata = JSON.stringify({
    strategyId: strategy.id,
    decisionTask: normalizeDecisionTask(blueprint.decisionTask),
    evidenceA: withoutEndingPunctuation(blueprint.evidenceA.label),
    evidenceB: withoutEndingPunctuation(blueprint.evidenceB.label),
    observationFocus: blueprint.observationFocus.map(withoutEndingPunctuation),
    constraint: withoutEndingPunctuation(blueprint.constraint).replace(/^(?:如果|假如|若)\s*/, ""),
  });
  return `> **Q4. [引導式簡答題]**：${guided.stem}
${guided.steps.map(renderStep).join("\n")}
> （每題請用 1-2 句話回答。）
> **教師系統判讀建議**：
> **情境核對資料**：${contextMetadata}
> - **萌芽 → 發展｜已跨界證據**：${strategy.emergingToDeveloping.achieved}
> - **萌芽 → 發展｜尚未跨界訊號**：${strategy.emergingToDeveloping.notYet}
> - **發展 → 精熟｜已跨界證據**：${strategy.developingToMastering.achieved}
> - **發展 → 精熟｜尚未跨界訊號**：${strategy.developingToMastering.notYet}
> **教師進程判定標準**：
> - **證據有限 (Evidence Limited)**：${cleanInline(question.evidenceLimited)}
>   - **學生可能回答**：「${cleanInline(examples.evidenceLimited)}」
> - **萌芽 (Emerging)**：${cleanInline(question.emerging)}
>   - **學生可能回答**：「${cleanInline(examples.emerging)}」
> - **發展 (Developing)**：${cleanInline(question.developing)}
>   - **學生可能回答**：「${cleanInline(examples.developing)}」
> - **精熟 (Mastering)**：${cleanInline(question.mastering)}
>   - **學生可能回答**：「${cleanInline(examples.mastering)}」${type === "post" && question.conceptAnnotations && question.transferAnnotations ? `
> **教師概念理解註記**：
> - **概念正確**：${cleanInline(question.conceptAnnotations.correct)}
> - **部分正確**：${cleanInline(question.conceptAnnotations.partial)}
> - **有迷思**：${cleanInline(question.conceptAnnotations.misconception)}
> **教師生活遷移註記**：
> - **尚未遷移**：${cleanInline(question.transferAnnotations.notYet)}
> - **開始遷移**：${cleanInline(question.transferAnnotations.emerging)}
> - **能調整遷移**：${cleanInline(question.transferAnnotations.adaptive)}` : ""}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractMarkedLine(source: string, marker: string): string {
  const match = source.match(
    new RegExp(`(?:^|\\n)\\s*>?\\s*\\*\\*${escapeRegExp(marker)}\\*\\*\\s*[:：]\\s*([^\\n]+)`, "i"),
  );
  return cleanInline(match?.[1] ?? "");
}

function extractRubric(source: string, labelPattern: string): { body: string; example: string } | null {
  const heading = source.match(
    new RegExp(`(?:^|\\n)\\s*>?\\s*-\\s*\\*\\*${labelPattern}\\*\\*\\s*[:：]\\s*([^\\n]+)`, "i"),
  );
  if (!heading || heading.index === undefined) return null;
  const tail = source.slice(heading.index + heading[0].length);
  const end = tail.search(/(?:^|\n)\s*>?\s*-\s*\*\*(?:證據有限|萌芽|發展|精熟)\s*\(/i);
  const section = end >= 0 ? tail.slice(0, end) : tail;
  const example = section.match(/\*\*學生可能回答\*\*\s*[:：]\s*[「"]?([^」"\n]+)[」"]?/i);
  const body = cleanInline(heading[1]);
  const exampleBody = cleanInline(example?.[1] ?? "");
  return body && exampleBody ? { body, example: exampleBody } : null;
}

interface ParsedLegacyModuleData {
  blueprint: ScenarioBlueprintDocument;
  question: AssessmentOpenQuestionDocument;
}

function parseLegacyQ4Document(source: string): ParsedLegacyModuleData | null {
  const setting = extractMarkedLine(source, CONTEXT_MARKERS.setting);
  const decisionTask = normalizeDecisionTask(extractMarkedLine(source, CONTEXT_MARKERS.decisionTask));
  const evidenceA = extractMarkedLine(source, CONTEXT_MARKERS.evidenceA);
  const evidenceADetail = extractMarkedLine(source, CONTEXT_MARKERS.evidenceADetail);
  const evidenceB = extractMarkedLine(source, CONTEXT_MARKERS.evidenceB);
  const evidenceBDetail = extractMarkedLine(source, CONTEXT_MARKERS.evidenceBDetail);
  const conflict = extractMarkedLine(source, CONTEXT_MARKERS.conflict);
  const focusRaw = extractMarkedLine(source, CONTEXT_MARKERS.observationFocus);
  const constraint = extractMarkedLine(source, CONTEXT_MARKERS.constraint);
  const focus = focusRaw.split(/\s*[|｜]\s*/).map(withoutEndingPunctuation).filter(Boolean);
  if (
    !setting || !decisionTask || !evidenceA || !evidenceADetail || !evidenceB ||
    !evidenceBDetail || !conflict || !constraint || focus.length < 2 || focus.length > 3
  ) {
    return null;
  }

  const evidenceLimited = extractRubric(source, "證據有限\\s*\\(Evidence Limited\\)");
  const emerging = extractRubric(source, "萌芽\\s*\\(Emerging\\)");
  const developing = extractRubric(source, "發展\\s*\\(Developing\\)");
  const mastering = extractRubric(source, "精熟\\s*\\(Mastering\\)");
  if (!evidenceLimited || !emerging || !developing || !mastering) return null;

  return {
    blueprint: {
      setting,
      // 舊版標記沒有背景事實欄位；保留空陣列只供既有 Markdown 草稿相容渲染。
      contextFacts: [] as unknown as ScenarioBlueprintDocument["contextFacts"],
      decisionTask,
      evidenceA: { label: evidenceA, detail: evidenceADetail },
      evidenceB: { label: evidenceB, detail: evidenceBDetail },
      conflict,
      observationFocus: focus as [string, string] | [string, string, string],
      constraint,
    },
    question: {
      evidenceLimited: evidenceLimited.body,
      emerging: emerging.body,
      developing: developing.body,
      mastering: mastering.body,
      studentExamples: {
        evidenceLimited: evidenceLimited.example,
        emerging: emerging.example,
        developing: developing.example,
        mastering: mastering.example,
      },
    },
  };
}

function normalizeCanonicalDecisionTasks(markdown: string): string {
  const modulePattern = /(^## (?:課前：思維診斷|課後：轉折遷移)\s*$)([\s\S]*?)(?=^## |$(?![\s\S]))/gm;
  return markdown.replace(modulePattern, (moduleText) => {
    const metadataMatch = moduleText.match(/\*\*情境核對資料\*\*[:：]\s*(\{[^\n]+\})/);
    if (!metadataMatch) return moduleText;
    try {
      const metadata = JSON.parse(metadataMatch[1]) as { decisionTask?: unknown };
      if (typeof metadata.decisionTask !== "string") return moduleText;
      const normalized = normalizeDecisionTask(metadata.decisionTask);
      if (!normalized || normalized === metadata.decisionTask) return moduleText;
      return moduleText.split(metadata.decisionTask).join(normalized);
    } catch {
      return moduleText;
    }
  });
}

export function normalizeGeneratedQ4Markdown(markdown: string, form: CourseForm): string {
  const modulePattern = /(^## (課前：思維診斷|課後：轉折遷移)\s*$)([\s\S]*?)(?=^## |$(?![\s\S]))/gm;
  return normalizeCanonicalDecisionTasks(markdown).replace(modulePattern, (moduleText, _heading, headingLabel: string) => {
    const parsed = parseLegacyQ4Document(moduleText);
    if (!parsed) return moduleText;
    const type = headingLabel.startsWith("課前") ? "pre" : "post";
    const scenarioLabel = type === "pre" ? "課前" : "課後";
    let normalized = moduleText.replace(
      new RegExp(`(\\*\\*【${scenarioLabel}共用情境】\\*\\*\\s*\\n)[\\s\\S]*?(?=\\n\\s*>\\s*\\*\\*Q1\\.)`),
      `$1${renderScenarioFromBlueprint(parsed.blueprint, type, form)}`,
    );
    const q4Pattern = /^[ \t]*>[ \t]*\*\*Q4\.[\s\S]*?(?=^\*\*【統計規格與總分落點標準】\*\*)/m;
    normalized = normalized.replace(
      q4Pattern,
      `${renderGuidedQ4Markdown(parsed.question, parsed.blueprint, type, form)}\n\n`,
    );
    return normalized;
  });
}

export function hasStructuredQ4Scaffold(questionTitle: string, steps: readonly GuidedQ4Step[]): boolean {
  if (!questionTitle.includes("[引導式簡答題]")) return false;
  return steps.length === 3 && steps.every((step) => step.prompt && step.focusHint && step.sentenceStarter);
}
