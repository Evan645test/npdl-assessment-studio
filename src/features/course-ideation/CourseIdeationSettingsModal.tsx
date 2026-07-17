import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { useState } from "react";
import {
  COURSE_IDEATION_MODEL_OPTIONS,
  getCourseIdeationProvider,
} from "@/lib/course-ideation-ai";

interface CourseIdeationSettingsModalProps {
  open: boolean;
  geminiKey: string;
  openaiKey: string;
  xaiKey: string;
  model: string;
  testing: boolean;
  connectionStatus: string | null;
  onClose: () => void;
  onChange: (patch: {
    geminiKey?: string;
    openaiKey?: string;
    xaiKey?: string;
    model?: string;
  }) => void;
  onTest: () => void;
  onClearProvider: () => void;
  onClearAll: () => void;
}

interface SecretFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

function SecretField({
  id,
  label,
  value,
  onChange,
  onClear,
}: SecretFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="block">
      <span className="mb-1 flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-black text-zinc-600">
          {label}
        </label>
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-black text-red-700 hover:text-red-900"
          >
            清除此金鑰
          </button>
        )}
      </span>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete="off"
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-[#dfe8e2] bg-white px-3 py-3 pr-10 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 hover:bg-[#eef4f0]"
          aria-label={visible ? `隱藏 ${label}` : `顯示 ${label}`}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function CourseIdeationSettingsModal({
  open,
  geminiKey,
  openaiKey,
  xaiKey,
  model,
  testing,
  connectionStatus,
  onClose,
  onChange,
  onTest,
  onClearProvider,
  onClearAll,
}: CourseIdeationSettingsModalProps) {
  const selectedGroup = getCourseIdeationProvider(model);
  const selectedKey = {
    gemini: {
      label: "Gemini API Key",
      value: geminiKey,
      patch: (value: string) => ({ geminiKey: value }),
    },
    openai: {
      label: "OpenAI API Key",
      value: openaiKey,
      patch: (value: string) => ({ openaiKey: value }),
    },
    xai: {
      label: "Grok（xAI）API Key",
      value: xaiKey,
      patch: (value: string) => ({ xaiKey: value }),
    },
  }[selectedGroup];
  const hasAnyKey = Boolean(geminiKey || openaiKey || xaiKey);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-zinc-950/40 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-ideation-settings-title"
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dfe8e2] p-5">
              <div>
                <h2 id="course-ideation-settings-title" className="text-lg font-black">
                  課程發想 AI 設定
                </h2>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  課程發想一律使用你自己的 API Key
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-zinc-500 hover:bg-[#eef4f0]"
                aria-label="關閉 AI 設定"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7faf8] p-5 custom-scrollbar">
              <label className="block">
                <span className="mb-1 block text-xs font-black text-zinc-600">模型</span>
                <select
                  value={model}
                  onChange={(event) => onChange({ model: event.target.value })}
                  className="min-h-12 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                >
                  <optgroup label="Gemini（Google）">
                    {COURSE_IDEATION_MODEL_OPTIONS.filter(
                      (option) => option.group === "gemini",
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="ChatGPT（OpenAI）">
                    {COURSE_IDEATION_MODEL_OPTIONS.filter(
                      (option) => option.group === "openai",
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Grok（xAI）">
                    {COURSE_IDEATION_MODEL_OPTIONS.filter(
                      (option) => option.group === "xai",
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>

              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-950">
                API Key 會以未加密文字保存在目前瀏覽器。若使用學校或其他共用電腦，完成後請清除金鑰；金鑰不會加入課程提示詞、草稿或評量交接資料。
              </div>

              <SecretField
                id={`course-ideation-${selectedGroup}-api-key`}
                label={selectedKey.label}
                value={selectedKey.value}
                onChange={(value) => onChange(selectedKey.patch(value))}
                onClear={onClearProvider}
              />

              <button
                type="button"
                onClick={onClearAll}
                disabled={!hasAnyKey}
                className="w-full rounded-xl border border-red-200 bg-white py-3 text-sm font-black text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                清除所有 API Key
              </button>

              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe8e2] bg-white py-3 text-sm font-black text-zinc-700 hover:border-[#b9ccc2] hover:bg-[#f7faf8] disabled:opacity-50"
              >
                <Settings2 className="h-4 w-4" />
                {testing ? "測試中…" : "測試 AI 連線"}
              </button>
              {connectionStatus && (
                <p className="rounded-xl border border-[#dfe8e2] bg-white p-3 text-center text-xs font-bold text-[#7a4d0b]">
                  {connectionStatus}
                </p>
              )}

            </div>
            <div className="border-t border-[#dfe8e2] p-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-xl bg-[#173f36] py-3 text-sm font-black text-white hover:bg-[#0f312a]"
              >
                完成設定
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
