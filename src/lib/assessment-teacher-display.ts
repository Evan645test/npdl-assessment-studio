const SCORING_SECTION_MARKER = "【統計規格與總分落點標準】";

export function stripQ4RubricTail(text: string): string {
  const idx = text.search(SCORING_SECTION_MARKER);
  return (idx >= 0 ? text.slice(0, idx) : text).trim();
}

export const RUBRIC_LEVEL_ORDER = [
  "證據有限",
  "萌芽",
  "發展",
  "精熟",
] as const;

export type RubricLevel = (typeof RUBRIC_LEVEL_ORDER)[number];

export interface ParsedRubricItem {
  level: RubricLevel;
  body: string;
  example?: string;
  missing: boolean;
}

export interface ParsedTransitionItem {
  label: "萌芽 → 發展" | "發展 → 精熟";
  achieved?: string;
  notYet?: string;
}

export interface ParsedTeacherNote {
  label: string;
  body: string;
}

export interface ParsedTeacherQ4Content {
  rubrics: ParsedRubricItem[];
  transitions: ParsedTransitionItem[];
  conceptNotes: ParsedTeacherNote[];
  transferNotes: ParsedTeacherNote[];
}

const TECHNICAL_LINE_PATTERNS = [
  /^Q4情境要素｜/,
  /^共用情境藍圖｜/,
  /^```/,
  /^\{/,
  /^\s*"[^"]+"\s*:/,
  /^\*\*Q4\.\s*\[/,
  /^\*\*情境核對資料\*\*/,
  /^-\s*\*\*情境核對資料\*\*/,
  /^\*\*教師系統判讀建議\*\*/,
  /^\*\*教師進程判定標準\*\*/,
  /^-\s*\*\*教師進程判定標準\*\*/,
  /^【統計規格與總分落點標準】/,
];

const TECHNICAL_INLINE_PATTERNS = [
  /\*\*情境核對資料\*\*[:：]\s*\{[\s\S]*?\}/g,
  /\{[\s\S]*?"strategyId"[\s\S]*?\}/g,
];

export function cleanAssessmentDisplayText(value: string): string {
  let cleaned = value.replace(/\r\n/g, "\n");
  for (const pattern of TECHNICAL_INLINE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned
    .replace(/^>\s?/gm, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/💡\s*回答引導：?/g, "")
    .replace(/（每題請用\s*1-2\s*句話回答。?）/g, "")
    .replace(/[「」]/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\(\s*Evidence Limited\s*\)/gi, "")
    .replace(/\(\s*Emerging\s*\)/gi, "")
    .replace(/\(\s*Developing\s*\)/gi, "")
    .replace(/\(\s*Mastering\s*\)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function stripTechnicalAssessmentLines(value: string): string {
  const marker = value.search(/【統計規格與總分落點標準】/);
  const withoutScoring = marker >= 0 ? value.slice(0, marker) : value;
  return withoutScoring
    .split("\n")
    .filter((line) => {
      const trimmed = line.replace(/^>\s?/, "").trim();
      if (!trimmed) return true;
      if (TECHNICAL_LINE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
        return false;
      }
      if (/^\{[\s\S]*\}$/.test(trimmed)) return false;
      if (/^".+":/.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export function cleanGuidedQ4Stem(stem: string): string {
  const cleaned = cleanAssessmentDisplayText(
    stripTechnicalAssessmentLines(stem.replace(/\r\n/g, "\n")),
  );
  return cleaned.replace(/^[：:\s]+/, "").trim();
}

export function humanizeQuestionTypeSuffix(rawTitle: string): string {
  const match = rawTitle.match(/\[([^\]]+)\]/);
  if (!match) return "";
  return match[1]
    .replace(/簡答鑑別題\s*-\s*發展\s*vs\s*精熟/i, "引導式整合回應")
    .replace(/引導式簡答題/i, "引導式整合回應")
    .trim();
}

export function getQuestionPreviewSummary(text: string, _rawTitle?: string): string {
  const cleaned = cleanAssessmentDisplayText(stripTechnicalAssessmentLines(text));
  if (!cleaned) return "（尚未解析題幹）";
  const firstParagraph = cleaned
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("①") && !line.startsWith("②") && !line.startsWith("③"));
  return firstParagraph ?? cleaned.split("\n")[0] ?? "（尚未解析題幹）";
}

export function mapRubricLevel(label: string): RubricLevel | null {
  const text = label.replace(/\*\*/g, "").trim();
  const lower = text.toLowerCase();
  if (text.includes("證據有限") || lower.includes("evidence")) return "證據有限";
  if (text.includes("萌芽") || lower.includes("emerging")) return "萌芽";
  if (text.includes("精熟") || lower.includes("mastering") || lower.includes("mastery")) {
    return "精熟";
  }
  if (text.includes("發展") || lower.includes("developing")) return "發展";
  return null;
}

export function parseTeacherQ4Content(explanation: string): ParsedTeacherQ4Content {
  const normalized = stripQ4RubricTail(
    stripTechnicalAssessmentLines(explanation.replace(/\r\n/g, "\n")),
  ).trim();
  const rubricMap = new Map<RubricLevel, { body: string; example?: string }>();
  const transitionMap = new Map<ParsedTransitionItem["label"], ParsedTransitionItem>();
  const conceptMap = new Map<string, string>();
  const transferMap = new Map<string, string>();
  let currentLevel: RubricLevel | null = null;

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.replace(/^>\s?/, "").trim();
    if (!line || line.startsWith("【")) continue;
    if (/^教師(系統判讀建議|進程判定標準|解析)[:：]?$/.test(line)) continue;
    if (/^-\s*\*\*教師(系統判讀建議|進程判定標準)\*\*[:：]?$/.test(line)) {
      continue;
    }
    if (/情境核對資料/.test(line) && /\{/.test(line)) continue;

    const transition = line.match(
      /^-?\s*(?:\*\*)?(萌芽\s*→\s*發展|發展\s*→\s*精熟)(?:\*\*)?(?:\s*\([^)]+\))?\s*｜(已跨界證據|尚未跨界訊號)(?:\*\*)?[:：]\s*(.+)$/,
    );
    if (transition) {
      const label = transition[1].replace(/\s*→\s*/, " → ").trim() as ParsedTransitionItem["label"];
      const current = transitionMap.get(label) ?? { label };
      if (transition[2] === "已跨界證據") current.achieved = cleanAssessmentDisplayText(transition[3]);
      else current.notYet = cleanAssessmentDisplayText(transition[3]);
      transitionMap.set(label, current);
      currentLevel = null;
      continue;
    }

    const teacherNote = line.match(
      /^-?\s*(?:\*\*)?(概念正確|部分正確|有迷思|尚未遷移|開始遷移|能調整遷移)(?:\*\*)?[:：]\s*(.+)$/,
    );
    if (teacherNote) {
      const body = cleanAssessmentDisplayText(teacherNote[2]);
      if (["概念正確", "部分正確", "有迷思"].includes(teacherNote[1])) {
        conceptMap.set(teacherNote[1], body);
      } else {
        transferMap.set(teacherNote[1], body);
      }
      currentLevel = null;
      continue;
    }

    const rubric = line.match(/^-?\s*(?:\*\*)?(.+?)(?:\*\*)?(?:\s*\([^)]+\))?\s*[:：]\s*(.+)$/);
    if (rubric) {
      const label = rubric[1].trim();
      if (!label.includes("→") && !label.includes("｜")) {
        const level = mapRubricLevel(label);
        if (level) {
          rubricMap.set(level, { body: cleanAssessmentDisplayText(rubric[2]) });
          currentLevel = level;
          continue;
        }
      }
    }

    const example = line.match(/^-?\s*(?:\*\*)?學生可能回答(?:\*\*)?[:：]\s*[「"]?(.+?)[」"]?$/);
    if (example && currentLevel) {
      const current = rubricMap.get(currentLevel);
      if (current) current.example = cleanAssessmentDisplayText(example[1]);
    }
  }

  return {
    rubrics: RUBRIC_LEVEL_ORDER.map((level) => ({
      level,
      body:
        rubricMap.get(level)?.body ??
        "此層級尚未提供判定標準，建議重新生成或微調此題。",
      example: rubricMap.get(level)?.example,
      missing: !rubricMap.has(level),
    })),
    transitions: (["萌芽 → 發展", "發展 → 精熟"] as const).map(
      (label) => transitionMap.get(label) ?? { label },
    ),
    conceptNotes: ["概念正確", "部分正確", "有迷思"]
      .filter((label) => conceptMap.has(label))
      .map((label) => ({ label, body: conceptMap.get(label) ?? "" })),
    transferNotes: ["尚未遷移", "開始遷移", "能調整遷移"]
      .filter((label) => transferMap.has(label))
      .map((label) => ({ label, body: transferMap.get(label) ?? "" })),
  };
}

export function buildStudentResponseExample(level: string, body: string): string {
  const cleaned = cleanAssessmentDisplayText(body);
  const hint = cleaned.split(/[。；]/)[0]?.trim() ?? "";
  if (!hint) return "我會先說清楚問題，再排出行動並檢查結果。";

  if (level === "證據有限") {
    return `我覺得這樣做就可以了，先照自己的想法試試看。${hint}`;
  }
  if (level === "萌芽") {
    return `我知道問題大概在哪裡，也想到一個做法，但還沒有排出完整步驟。${hint}`;
  }
  if (level === "發展") {
    return `我會把想法排成具體步驟，說明理由，完成後再檢查結果。${hint}`;
  }
  return `我會依新限制調整做法，把方法用到另一個生活情況，再用結果或回饋確認。${hint}`;
}

export function formatTeacherExplanationFallback(explanation: string): string[] {
  const normalized = stripQ4RubricTail(
    stripTechnicalAssessmentLines(explanation.replace(/\r\n/g, "\n")),
  );
  return normalized
    .split("\n")
    .map((line) => cleanAssessmentDisplayText(line.replace(/^>\s?/, "").trim()))
    .filter(
      (line) =>
        line &&
        !/^(教師解析|教師系統判讀建議|教師進程判定標準|情境核對資料)[:：]?$/.test(
          line,
        ) &&
        !/^Q4[.．]?\s*\[/.test(line),
    );
}
