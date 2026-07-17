import type { ParsedQuestion } from "@/types";
import {
  GUIDED_Q4_LABELS,
  type GuidedQ4Step,
} from "@/lib/q4-guidance";

export { GUIDED_Q4_LABELS } from "@/lib/q4-guidance";

const SCORING_SECTION_MARKER = "【統計規格與總分落點標準】";

export interface GuidedQ4Content {
  stem: string;
  steps: [GuidedQ4Step, GuidedQ4Step, GuidedQ4Step] | [];
  scaffolded: boolean;
}

function cleanQ4Text(value: string): string {
  return value
    .replace(/^>\s?/gm, "")
    .replace(/\*\*/g, "")
    .replace(/[「」]/g, "")
    .replace(/^\s*[:：]\s*/, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractScaffoldField(segment: string, field: "問題" | "先看哪裡" | "可以這樣開始"): string {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = segment.match(
    new RegExp(
      `(?:\\*\\*)?${escaped}(?:\\*\\*)?\\s*[:：]\\s*([\\s\\S]*?)(?=(?:\\n|\\s)+(?:\\*\\*)?(?:問題|先看哪裡|可以這樣開始)(?:\\*\\*)?\\s*[:：]|$)`,
    ),
  );
  return cleanQ4Text(match?.[1] ?? "");
}

export function parseGuidedQ4Text(text: string): GuidedQ4Content {
  const normalized = normalizeBlockText(text);
  const symbols = ["①", "②", "③"] as const;
  const markers = symbols.map((symbol, index) => {
    const match = new RegExp(
      `(?:^|\\n)\\s*(?:\\*\\*)?${symbol}\\s*([^\\n*：:]+?)(?:\\*\\*)?\\s*(?=[:：]|\\n|$)`,
      "i",
    ).exec(normalized);
    return {
      label: cleanQ4Text(match?.[1] ?? "") || GUIDED_Q4_LABELS[index],
      symbol,
      match,
    };
  });
  if (markers.some((marker) => !marker.match || marker.match.index < 0)) {
    return { stem: cleanQ4Text(normalized), steps: [], scaffolded: false };
  }

  const firstMarker = markers[0].match?.index ?? 0;
  const stem = cleanQ4Text(normalized.slice(0, firstMarker));
  const parsed = markers.map((marker, index) => {
    const start = (marker.match?.index ?? 0) + (marker.match?.[0].length ?? 0);
    const end = index < 2 ? markers[index + 1].match?.index ?? normalized.length : normalized.length;
    const segment = normalized
      .slice(start, end)
      .replace(/（每題請用\s*1-2\s*句話回答。?）/g, "")
      .trim();
    const promptField = extractScaffoldField(segment, "問題");
    const focusHint = extractScaffoldField(segment, "先看哪裡");
    const sentenceStarter = extractScaffoldField(segment, "可以這樣開始");
    const prompt = promptField || cleanQ4Text(segment);
    return {
      number: (index + 1) as 1 | 2 | 3,
      label: marker.label,
      prompt,
      focusHint,
      sentenceStarter,
    };
  });
  if (parsed.some((step) => !step.prompt)) {
    return { stem: cleanQ4Text(normalized), steps: [], scaffolded: false };
  }
  const steps = parsed as [GuidedQ4Step, GuidedQ4Step, GuidedQ4Step];
  return {
    stem,
    steps,
    scaffolded: steps.every((step) => Boolean(step.focusHint && step.sentenceStarter)),
  };
}

export function stripQ4RubricTail(text: string): string {
  const idx = text.search(SCORING_SECTION_MARKER);
  return (idx >= 0 ? text.slice(0, idx) : text).trim();
}

function normalizeBlockText(text: string): string {
  return text.replace(/^>\s?/gm, "").replace(/\r\n/g, "\n").trim();
}

function countScoreMarkers(text: string): number {
  return (text.match(/[A-DＡ-Ｄ]\s*[:：]\s*[+-]?\d+/gi) ?? []).length;
}

export function extractTeacherParse(rawBlock: string): string {
  const normalized = normalizeBlockText(rawBlock);
  const idx = normalized.search(/\*\*教師解析\*\*/);
  if (idx < 0) return "";

  const after = normalized.slice(idx).replace(/^\*\*教師解析\*\*[:：]?\s*/, "");
  const endIdx = after.search(
    /\n\s*(?:>\s*)?(?:\*\*Q\d|💡\s*回答引導|-\s*\*\*(?:證據有限|萌芽|發展|精熟)|\*\*【統計)/,
  );
  return (endIdx >= 0 ? after.slice(0, endIdx) : after).trim();
}

export function resolveTeacherParse(explanation: string, rawBlock: string): string {
  const fromField = explanation.trim();
  const fromBlock = extractTeacherParse(rawBlock);
  if (!fromBlock) return fromField;
  if (!fromField) return fromBlock;
  return countScoreMarkers(fromBlock) >= countScoreMarkers(fromField) ? fromBlock : fromField;
}

export function parseAssessmentModule(content: string, type: "pre" | "post"): {
  scenario: string;
  questions: ParsedQuestion[];
  preamble: string;
} {
  const lines = content.split("\n");
  const questions: ParsedQuestion[] = [];
  let scenario = "";
  let capturingScenario = false;
  let current: ParsedQuestion | null = null;
  const preamble: string[] = [];
  let afterScoring = false;
  let capturingTeacherParse = false;

  for (const raw of lines) {
    const line = raw.replace(/^>\s*/, "").trim();
    if (line.match(/^\*\*Q\d+/)) {
      capturingScenario = false;
      capturingTeacherParse = false;
      if (current) questions.push(current);
      const match = line.match(/^(\*\*Q\d+.*?\*\*)(?:[:：\s]*「?(.*?)」?)?$/);
      current = {
        id: "",
        type,
        rawTitle: match ? match[1].replace(/\*\*/g, "") : line.replace(/\*\*/g, ""),
        text: match?.[2] ?? "",
        options: [],
        explanation: "",
        rawBlock: raw,
      };
      continue;
    }

    if (line.includes("【課前共用情境】") || line.includes("【課後共用情境】")) {
      capturingScenario = true;
      continue;
    }

    if (capturingScenario && !line.includes("【") && line) {
      scenario += `${line}\n`;
      continue;
    }

    if (current) {
      current.rawBlock += `\n${raw}`;
      if (line.includes(SCORING_SECTION_MARKER)) {
        afterScoring = true;
        capturingTeacherParse = false;
        continue;
      }
      if (afterScoring) continue;

      if (line.match(/^\([A-D]\)/)) {
        current.options.push(line);
        capturingTeacherParse = false;
      } else if (line.match(/^\*\*(教師解析|教師系統判讀建議|教師進程判定標準)\*\*/)) {
        const isQ4 = current.rawTitle.includes("Q4");
        capturingTeacherParse = !isQ4 && line.includes("教師解析");
        if (isQ4) {
          current.explanation += (current.explanation ? "\n" : "") + line;
        }
        const inline = line.replace(/^\*\*(教師解析|教師系統判讀建議|教師進程判定標準)\*\*(?:[:：\s]*)/, "").trim();
        if (inline) {
          current.explanation = inline;
        } else if (capturingTeacherParse) {
          current.explanation = current.explanation || "";
        }
      } else if (capturingTeacherParse && !current.rawTitle.includes("Q4")) {
        current.explanation += (current.explanation ? "\n" : "") + line;
      } else if (line.match(/^-\s*\*\*/) && current.rawTitle.includes("Q4")) {
        capturingTeacherParse = false;
        current.explanation += (current.explanation ? "\n" : "") + line;
      } else if (line && !current.explanation && current.options.length === 0) {
        current.text += (current.text ? "\n" : "") + line;
      } else if (current.explanation && current.rawTitle.includes("Q4")) {
        current.explanation += (current.explanation ? "\n" : "") + line;
      } else if (/^[A-DＡ-Ｄ]\s*[:：]/.test(line) && current.options.length > 0 && !current.rawTitle.includes("Q4")) {
        capturingTeacherParse = true;
        current.explanation += (current.explanation ? "\n" : "") + line;
      }
      continue;
    }

    if (line.includes(SCORING_SECTION_MARKER)) {
      afterScoring = true;
      continue;
    }
    if (!afterScoring && !line.match(/^##\s*(課前|課後)/)) {
      preamble.push(raw);
    }
  }

  if (current) questions.push(current);
  questions.forEach((q) => {
    if (q.rawTitle.includes("Q4") && q.explanation) {
      q.explanation = stripQ4RubricTail(q.explanation);
    } else if (!q.rawTitle.includes("Q4")) {
      q.explanation = resolveTeacherParse(q.explanation, q.rawBlock);
    }
    q.id = btoa(encodeURIComponent(q.rawTitle + q.text)).slice(0, 20);
  });

  return { scenario: scenario.trim(), questions, preamble: preamble.join("\n").trim() };
}

function normalizeOptionLetter(letter: string): string {
  const map: Record<string, string> = { Ａ: "A", Ｂ: "B", Ｃ: "C", Ｄ: "D" };
  return map[letter] ?? letter.toUpperCase();
}

export function parseOptionScores(explanation: string): Record<string, { score: string; desc: string }> {
  const result: Record<string, { score: string; desc: string }> = {};
  const normalized = normalizeBlockText(explanation).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return result;

  const chunks = normalized.split(/(?=[A-DＡ-Ｄ]\s*[:：]\s*[+-]?\d+)/i).filter(Boolean);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    const match = trimmed.match(
      /^([A-DＡ-Ｄ])\s*[:：]\s*([+-]?\d+)\s*(?:分)?\s*(?:[（(]([^）)]*)[）)]|(?:[，,、]\s*)?(.+?))(?:[；;]\s*)?$/,
    );
    if (!match) {
      const simple = trimmed.match(/^([A-DＡ-Ｄ])\s*[:：]\s*([+-]?\d+)/);
      if (simple) {
        result[normalizeOptionLetter(simple[1])] = { score: simple[2], desc: "" };
      }
      continue;
    }
    const letter = normalizeOptionLetter(match[1]);
    const desc = (match[3] ?? match[4] ?? "")
      .trim()
      .replace(/[；;]\s*$/, "")
      .trim();
    result[letter] = { score: match[2], desc };
  }

  return result;
}

export function getChoiceQuestionScores(
  question: Pick<ParsedQuestion, "explanation" | "rawBlock" | "rawTitle">,
): Record<string, { score: string; desc: string }> {
  if (question.rawTitle.includes("Q4")) return {};
  const teacherParse = resolveTeacherParse(question.explanation, question.rawBlock);
  return parseOptionScores(teacherParse);
}

export function formatOptionScore(score: string): string {
  const value = Number(score);
  if (Number.isNaN(value)) return score;
  return value > 0 ? `+${value}` : `${value}`;
}
