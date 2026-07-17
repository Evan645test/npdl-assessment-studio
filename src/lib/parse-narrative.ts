import type { Indicator } from "@/types";
import { PROGRESSION_KEYS, PROGRESSION_NAMES } from "@/data/constants";

export interface ProgressionSlice {
  levelName: string;
  levelKey: (typeof PROGRESSION_KEYS)[number];
  originalText: string;
  behavior: string;
  sub: { life: string; practice: string; emotion: string };
}

export function parseNarrativeModule(content: string, indicator: Indicator | null): {
  intro: string;
  slices: ProgressionSlice[];
} {
  const introMatch = content.match(/^([\s\S]*?)(?=###)/i);
  const intro = introMatch?.[1]?.trim().replace(/^## 課程敘述語/, "").trim() ?? "";

  const slices = PROGRESSION_NAMES.map((levelName, index) => {
    const key = PROGRESSION_KEYS[index];
    const re = new RegExp(`###.*?(?:${levelName}).*?\\n([\\s\\S]*?)(?=###|$)`, "i");
    const match = content.match(re);
    const behavior = match?.[1]?.trim() ?? "";
    const originalText = indicator?.levels[key] ?? "";
    const life = behavior.match(/\*\*.*線索.*?\*\*[:：]?\s*\n?([\s\S]*?)(?=\*\*.*思考.*?\*\*|$)/i)?.[1]?.trim() ?? "";
    const emotion = behavior.match(/\*\*.*思考.*?\*\*[:：]?\s*\n?([\s\S]*?)(?=\*\*.*引導.*?\*\*|$)/i)?.[1]?.trim() ?? "";
    const practice = behavior.match(/\*\*.*引導.*?\*\*[:：]?\s*\n?([\s\S]*?)$/i)?.[1]?.trim() ?? "";
    return { levelName, levelKey: key, originalText, behavior, sub: { life, practice, emotion } };
  });

  return { intro, slices };
}

export const ACCORDION_SECTIONS = [
  { id: "clues", label: "進程辨識線索", keys: ["life"] as const },
  { id: "thinking", label: "學生內在思考", keys: ["emotion"] as const },
  { id: "scaffold", label: "教學引導與鷹架", keys: ["practice"] as const },
] as const;

export interface NarrativeBullet {
  emoji?: string;
  label: string;
  body: string;
}

function splitEmojiLabel(raw: string): { emoji?: string; label: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\p{Extended_Pictographic})\s*(.+)$/u);
  if (match) {
    return { emoji: match[1], label: match[2].trim() };
  }
  return { label: trimmed };
}

/** 將「- **👀 標題**：內容」解析為結構化條列 */
export function parseNarrativeBullets(text: string): NarrativeBullet[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const items: NarrativeBullet[] = [];
  const chunks = normalized.split(/\n(?=-\s*\*\*)/);

  for (const chunk of chunks) {
    const line = chunk.trim();
    const match = line.match(/^-\s*\*\*(.+?)\*\*[:：]?\s*([\s\S]*)$/);
    if (!match) continue;
    const { emoji, label } = splitEmojiLabel(match[1]);
    items.push({
      emoji,
      label,
      body: match[2].trim().replace(/\n+/g, " "),
    });
  }

  if (items.length > 0) return items;

  return normalized
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      label: "說明",
      body: line.replace(/^-\s*/, "").replace(/\*\*/g, ""),
    }));
}
