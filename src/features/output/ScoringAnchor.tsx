import { getTierStyle, parseScoringBlock } from "@/lib/parse-scoring";
import { IMPLEMENTATION_ITEM_LABELS } from "@/lib/assessment-terminology";
import { t } from "@/locales/zh-Hant";

interface ScoringAnchorProps {
  raw: string;
  accent: "teal" | "violet";
  phase?: "pre" | "post";
}

function splitTierDescription(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return { primary: "", secondary: "" };

  const bySemicolon = normalized.split(/[；;]\s*/).filter(Boolean);
  if (bySemicolon.length >= 2) {
    return {
      primary: `${bySemicolon[0].trim()}。`,
      secondary: bySemicolon.slice(1).join("；").trim(),
    };
  }

  const bySentence = normalized.split(/。(?=\S)/).filter(Boolean);
  if (bySentence.length >= 2) {
    return {
      primary: `${bySentence[0].trim()}。`,
      secondary: bySentence.slice(1).join("。").trim(),
    };
  }

  return { primary: normalized, secondary: "" };
}

function parseGrowthGuide(text: string) {
  if (!text.includes("提升")) return { title: "", items: [] as string[], remainder: text };
  const cleaned = text.replace(/\s+/g, " ").trim();
  const introMatch = cleaned.match(/^(.*?(?:淨成長|提升|比較)[^：:]*[:：])\s*/);
  const title = introMatch?.[1]?.trim() ?? "";
  const afterTitle = title ? cleaned.slice(introMatch![0].length).trim() : cleaned;
  const rangeRe = /提升\s*\d+\s*[–-]\s*\d+\s*分[^，。；;]*/g;
  const items = afterTitle.match(rangeRe)?.map((item) => item.trim()) ?? [];
  if (items.length === 0) return { title: "", items: [] as string[], remainder: text };
  const remainder = afterTitle.replace(rangeRe, "").replace(/^[，、；;\s]+|[，、；;\s]+$/g, "").trim();
  return { title: title || "淨成長解讀：", items, remainder };
}

export function ScoringAnchor({ raw, accent, phase = "pre" }: ScoringAnchorProps) {
  const parsed = parseScoringBlock(raw);
  const accentRing = accent === "teal" ? "ring-teal-100" : "ring-indigo-100";
  const accentBadge = accent === "teal" ? "bg-teal-100 text-teal-800" : "bg-indigo-100 text-indigo-800";

  return (
    <section
      className={`mt-6 rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4 ring-1 ${accentRing}`}
      aria-label={t.scoringAnchor}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">{t.scoringAnchor}</p>
          <p className="mt-0.5 text-xs font-bold text-zinc-500">{t.scoringDesc}</p>
        </div>
        {parsed.totalMin !== undefined && parsed.totalMax !== undefined && (
          <span className={`rounded-full px-3 py-1 text-xs font-black ${accentBadge}`}>
            {IMPLEMENTATION_ITEM_LABELS[phase].slice(0, 3).join("、")} 總分{" "}
            {parsed.totalMin}–{parsed.totalMax} 分
          </span>
        )}
      </div>

      {parsed.tiers.length > 0 ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            {parsed.tiers.map((tier) => {
              const style = getTierStyle(tier.label);
              const { primary, secondary } = splitTierDescription(tier.description);
              return (
                <div
                  key={`${tier.label}-${tier.min}`}
                  className={`rounded-xl border p-3 ${style.border} ${style.bg}`}
                >
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className={`text-sm font-black ${style.text}`}>{tier.label}</span>
                    {tier.min > 0 || tier.max > 0 ? (
                      <span className="rounded-md bg-white/90 px-2 py-0.5 text-[10px] font-black text-zinc-600">
                        {tier.min}–{tier.max} 分
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs leading-relaxed text-zinc-700">{primary}</p>
                  {secondary &&
                    (() => {
                      const growth = parseGrowthGuide(secondary);
                      if (growth.items.length === 0) {
                        return (
                          <p className="mt-1.5 border-t border-white/80 pt-1.5 text-[11px] leading-relaxed text-zinc-600">
                            {secondary}
                          </p>
                        );
                      }
                      return (
                        <div className="mt-1.5 border-t border-white/80 pt-1.5 text-[11px] leading-relaxed text-zinc-600">
                          <p className="font-bold text-zinc-700">{growth.title}</p>
                          <ul className="mt-1 space-y-1">
                            {growth.items.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                          {growth.remainder && <p className="mt-1">{growth.remainder}</p>}
                        </div>
                      );
                    })()}
                </div>
              );
            })}
          </div>
          {parsed.notes.length > 0 && (
            <div className="mt-3 rounded-xl border border-indigo-100 bg-white px-3 py-2.5 text-xs leading-relaxed text-zinc-600">
              {parsed.notes.join(" ")}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">{parsed.remainder}</p>
      )}
    </section>
  );
}
