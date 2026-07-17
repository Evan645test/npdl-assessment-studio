interface ModuleHeaderProps {
  title: string;
  subtitle: string;
  editHint: string;
  accent: "amber" | "teal" | "violet";
}

const accentMap = {
  amber: "border-[#e1bf69] bg-[#fff8e8] text-[#7a4d0b]",
  teal: "border-teal-300 bg-teal-50 text-teal-800",
  violet: "border-indigo-300 bg-indigo-50 text-indigo-800",
};

export function ModuleHeader({ title, subtitle, editHint, accent }: ModuleHeaderProps) {
  return (
    <div className="mb-4 rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-[0_1px_12px_rgba(15,45,38,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-zinc-900">{title}</h2>
          <p className="mt-1 text-xs font-bold leading-relaxed text-zinc-600">{subtitle}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${accentMap[accent]}`}>
          {editHint}
        </span>
      </div>
    </div>
  );
}
