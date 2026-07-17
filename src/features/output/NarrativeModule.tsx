import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { ACCORDION_SECTIONS, parseNarrativeModule } from "@/lib/parse-narrative";
import type { Indicator, RefineTarget } from "@/types";
import { NarrativeSectionBody } from "./NarrativeSectionBody";

interface NarrativeModuleProps {
  content: string;
  indicator: Indicator | null;
  highlightKey: string | null;
  onRefine?: (target: RefineTarget) => void;
}

export function NarrativeModule({ content, indicator, highlightKey, onRefine }: NarrativeModuleProps) {
  const { intro, slices } = useMemo(() => parseNarrativeModule(content, indicator), [content, indicator]);
  const [activeLevel, setActiveLevel] = useState(0);
  const [openAccordion, setOpenAccordion] = useState<string>("clues");
  const [compareOpen, setCompareOpen] = useState(false);
  const slice = slices[activeLevel];

  return (
    <div className="rounded-xl border border-[#dfe8e2] bg-white shadow-[0_1px_14px_rgba(15,45,38,0.06)]">
      <div className="h-1 rounded-t-xl bg-[#d7a72f]" />
      <div className="p-5">
        {intro && <p className="mb-4 text-sm font-medium leading-relaxed text-zinc-700">{intro}</p>}

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="四進程">
          {slices.map((item, index) => (
            <button
              key={item.levelName}
              type="button"
              role="tab"
              aria-selected={activeLevel === index}
              onClick={() => setActiveLevel(index)}
              className={`min-h-11 rounded-xl px-4 py-2 text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 ${
                activeLevel === index
                  ? "bg-[#173f36] text-white shadow-sm shadow-emerald-950/15"
                  : "bg-[#eef4f0] text-zinc-600 hover:bg-[#e2ebe5] hover:text-zinc-800"
              }`}
            >
              {item.levelName}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-zinc-900">{slice.levelName} · 本課改寫</h3>
              <button
                type="button"
                disabled={!onRefine}
                onClick={() =>
                  onRefine?.({
                    type: "progression",
                    id: slice.levelName,
                    title: `課程敘述語 · ${slice.levelName}`,
                    currentContent: slice.behavior,
                  })
                }
                className="inline-flex items-center gap-1 rounded-xl border border-[#dfe8e2] bg-white px-3 py-1.5 text-xs font-black text-zinc-700 hover:border-[#e1bf69] hover:bg-[#fff8e8] hover:text-[#7a4d0b] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-3.5 w-3.5" />
                微調此段
              </button>
            </div>

            <div className="space-y-2">
              {ACCORDION_SECTIONS.map((section) => {
                const text = section.keys.map((key) => slice.sub[key]).filter(Boolean).join("\n\n") || slice.behavior;
                const open = openAccordion === section.id;
                return (
                  <details
                    key={section.id}
                    open={open}
                    onToggle={(e) => {
                      if ((e.target as HTMLDetailsElement).open) setOpenAccordion(section.id);
                    }}
                    className={`rounded-xl border border-[#dfe8e2] bg-[#f7faf8] ${
                      highlightKey?.includes(slice.levelName) ? "npdl-highlight-flash" : ""
                    }`}
                  >
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-zinc-800 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center justify-between gap-2">
                        {section.label}
                        <span className="text-[10px] font-bold text-zinc-500">
                          {open ? "收合" : "展開"}
                        </span>
                      </span>
                    </summary>
                    <div className="border-t border-[#dfe8e2] px-4 py-3">
                      <NarrativeSectionBody text={text} />
                    </div>
                  </details>
                );
              })}
            </div>
          </div>

          <aside className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8]">
            <button
              type="button"
              onClick={() => setCompareOpen((v) => !v)}
              className="w-full px-4 py-3 text-left text-xs font-black text-zinc-700"
            >
              {compareOpen ? "收合" : "展開"} NPDL 指標原文對照
            </button>
            {compareOpen && (
              <div className="border-t border-[#dfe8e2] px-4 py-3 text-xs leading-relaxed text-zinc-600">
                {slice.originalText || "（無資料庫指標原文）"}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
