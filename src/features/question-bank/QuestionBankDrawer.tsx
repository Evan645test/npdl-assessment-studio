import { AnimatePresence, motion } from "framer-motion";
import { Copy, Trash2, X } from "lucide-react";
import { t } from "@/locales/zh-Hant";
import type { SavedQuestion } from "@/types";

interface QuestionBankDrawerProps {
  open: boolean;
  items: SavedQuestion[];
  onClose: () => void;
  onRemove: (id: string) => void;
}

export function QuestionBankDrawer({ open, items, onClose, onRemove }: QuestionBankDrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex justify-end bg-zinc-950/25 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="flex h-full w-full max-w-lg flex-col border-l border-[#dfe8e2] bg-white shadow-2xl shadow-emerald-950/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dfe8e2] p-6">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">{t.questionBank}</h2>
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                  {t.savedCount(items.length)}
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-[#eef4f0]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {items.length === 0 ? (
                <p className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-6 text-sm font-bold text-zinc-500">尚無收藏題目</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="mb-3 rounded-xl border border-[#dfe8e2] bg-white p-4 shadow-sm shadow-emerald-950/5">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-[#b7791f]">
                          {item.type === "pre" ? "課前" : "課後"}
                        </p>
                        <h3 className="font-black text-zinc-900">{item.rawTitle}</h3>
                      </div>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(item.rawBlock)}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-[#fff8e8] hover:text-[#b7791f]"
                          title={t.copyQuestion}
                          aria-label={t.copyQuestion}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-500"
                          aria-label="移除收藏題目"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="line-clamp-3 text-sm font-medium text-zinc-700">{item.text}</p>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
