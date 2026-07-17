import { t } from "@/locales/zh-Hant";

interface ContextStripProps {
  parts: string[];
}

export function ContextStrip({ parts }: ContextStripProps) {
  const summary = parts.filter(Boolean).join(" · ");
  if (!summary) return null;
  return (
    <div className="mb-4 rounded-xl border border-[#dfe8e2] bg-[#f7faf8] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{t.contextStrip}</p>
      <p className="mt-1 text-sm font-bold text-zinc-800">{summary}</p>
    </div>
  );
}
