export interface ScoringTier {
  min: number;
  max: number;
  label: string;
  description: string;
}

export interface ParsedScoring {
  totalMin?: number;
  totalMax?: number;
  tiers: ScoringTier[];
  remainder: string;
  notes: string[];
}

const TIER_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  證據有限: { border: "border-zinc-300", bg: "bg-white", text: "text-zinc-700" },
  萌芽: { border: "border-[#e1bf69]", bg: "bg-[#fff8e8]", text: "text-[#7a4d0b]" },
  發展: { border: "border-teal-300", bg: "bg-teal-50", text: "text-teal-900" },
  精熟: { border: "border-indigo-300", bg: "bg-indigo-50", text: "text-indigo-900" },
};

export function getTierStyle(label: string) {
  const key = Object.keys(TIER_STYLES).find((k) => label.includes(k));
  return key ? TIER_STYLES[key] : TIER_STYLES["萌芽"];
}

export function parseScoringBlock(raw: string): ParsedScoring {
  const text = raw
    .replace(/^【統計規格與總分落點標準】\s*/i, "")
    .replace(/\*\*/g, "")
    .trim();

  const totalMatch =
    text.match(/(?:總分範圍|總分區間|累計得分範圍|得分範圍|範圍)[^。；;\n]*?([+-]?\d+)\s*(?:至|到|[–-])\s*([+-]?\d+)\s*分/) ??
    text.match(/Q1[–-]Q3\s*總分[^。；;\n]*?([+-]?\d+)\s*(?:至|到|[–-])\s*([+-]?\d+)\s*分/);
  const totalMin = totalMatch ? Number(totalMatch[1]) : undefined;
  const totalMax = totalMatch ? Number(totalMatch[2]) : undefined;

  const tiers: ScoringTier[] = [];
  const notes: string[] = [];
  const tierStartRe =
    /(?:^|[\n\r\s；;。-])([+-]?\d+)\s*(?:至|到|[–-])\s*([+-]?\d+)\s*分\s*(?:為\s*)?(?:【([^】]+)】|([^，,：:。；;\s]+))\s*[：:，,]?\s*/g;
  const starts: Array<{
    min: number;
    max: number;
    label: string;
    bodyStart: number;
    start: number;
  }> = [];

  let m: RegExpExecArray | null;
  while ((m = tierStartRe.exec(text)) !== null) {
    const label = (m[3] ?? m[4] ?? "").trim();
    if (!/(證據有限|萌芽|發展|精熟)/.test(label)) continue;
    const rangeStart = m.index + m[0].indexOf(m[1]);
    starts.push({
      min: Number(m[1]),
      max: Number(m[2]),
      label,
      start: rangeStart,
      bodyStart: tierStartRe.lastIndex,
    });
  }

  for (let i = 0; i < starts.length; i += 1) {
    const current = starts[i];
    const next = starts[i + 1];
    const rawDesc = text.slice(current.bodyStart, next ? next.start : text.length);
    let description = rawDesc
      .replace(/^[，,；;\s-]+|[，,；;\s-]+$/g, "")
      .trim();
    if (i === starts.length - 1) {
      const segments = description
        .split(/(?<=。)\s*/)
        .map((segment) => segment.trim())
        .filter(Boolean);
      if (segments.length > 1) {
        const keep: string[] = [];
        segments.forEach((segment) => {
          if (/^(若|如果|另|另外|提醒|建議)/.test(segment) || /Q4/i.test(segment)) {
            notes.push(segment);
          } else {
            keep.push(segment);
          }
        });
        description = keep.join(" ").trim() || description;
      }
    }
    tiers.push({
      min: current.min,
      max: current.max,
      label: current.label,
      description,
    });
  }

  return { totalMin, totalMax, tiers, remainder: text, notes };
}
