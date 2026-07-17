import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { t } from "@/locales/zh-Hant";

interface RefineDrawerProps {
  open: boolean;
  target: { title: string; currentContent: string } | null;
  instruction: string;
  loading: boolean;
  onClose: () => void;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
}

export function RefineDrawer({
  open,
  target,
  instruction,
  loading,
  onClose,
  onInstructionChange,
  onSubmit,
}: RefineDrawerProps) {
  return (
    <AnimatePresence>
      {open && target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex justify-end bg-zinc-950/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="refine-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220 }}
            className="flex h-full w-full max-w-lg flex-col border-l border-[#dfe8e2] bg-white shadow-2xl shadow-emerald-950/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dfe8e2] p-5">
              <div>
                <h2 id="refine-title" className="text-lg font-black text-zinc-900">{t.refineTitle}</h2>
                <p className="text-xs font-bold text-zinc-500">{target.title}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-[#eef4f0]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <pre className="mb-4 whitespace-pre-wrap rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4 text-xs leading-relaxed text-zinc-700">
                {target.currentContent.slice(0, 1200)}
              </pre>
              <div className="mb-3 flex flex-wrap gap-2">
                {t.refineHints.map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    onClick={() => onInstructionChange(hint)}
                    className="rounded-full border border-[#dfe8e2] bg-white px-3 py-1 text-xs font-bold text-zinc-700 hover:border-[#e1bf69] hover:bg-[#fff8e8] hover:text-[#7a4d0b]"
                  >
                    {hint}
                  </button>
                ))}
              </div>
              <textarea
                value={instruction}
                onChange={(e) => onInstructionChange(e.target.value)}
                placeholder={t.refinePlaceholder}
                className="min-h-32 w-full rounded-xl border border-[#dfe8e2] bg-white p-4 text-sm font-medium text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <div className="border-t border-[#dfe8e2] p-5">
              <button
                type="button"
                disabled={loading || !instruction.trim()}
                onClick={onSubmit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173f36] py-3.5 text-sm font-black text-white shadow-lg shadow-emerald-950/15 hover:bg-[#0f312a] disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                {loading ? "微調中…" : t.refineSubmit}
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
