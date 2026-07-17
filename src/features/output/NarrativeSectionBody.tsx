import { useMemo } from "react";
import { parseNarrativeBullets } from "@/lib/parse-narrative";

interface NarrativeSectionBodyProps {
  text: string;
}

export function NarrativeSectionBody({ text }: NarrativeSectionBodyProps) {
  const bullets = useMemo(() => parseNarrativeBullets(text), [text]);

  if (bullets.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
        {text || "（尚無內容）"}
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {bullets.map((item, index) => (
        <li
          key={`${item.label}-${index}`}
          className="rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5 shadow-sm shadow-emerald-950/5"
        >
          <div className="flex gap-3">
            {item.emoji ? (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff8e8] text-base"
                aria-hidden
              >
                {item.emoji}
              </span>
            ) : (
              <span className="mt-0.5 flex h-2 w-2 shrink-0 rounded-full bg-[#d7a72f]" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-zinc-900">{item.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">{item.body}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
