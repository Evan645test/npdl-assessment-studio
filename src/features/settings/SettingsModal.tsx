import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Settings2, X } from "lucide-react";
import { useState } from "react";
import { MODEL_OPTIONS } from "@/data/constants";
import { t } from "@/locales/zh-Hant";

interface SettingsModalProps {
  open: boolean;
  geminiKey: string;
  openaiKey: string;
  xaiKey: string;
  googleClientId: string;
  googleClientIdManaged: boolean;
  model: string;
  testing: boolean;
  connectionStatus: string | null;
  required?: boolean;
  requiredProvider?: string;
  onClose: () => void;
  onChange: (patch: {
    geminiKey?: string;
    openaiKey?: string;
    xaiKey?: string;
    googleClientId?: string;
    model?: string;
  }) => void;
  onTest: () => void;
}

export function SettingsModal({
  open,
  geminiKey,
  openaiKey,
  xaiKey,
  googleClientId,
  googleClientIdManaged,
  model,
  testing,
  connectionStatus,
  required = false,
  requiredProvider = "Gemini",
  onClose,
  onChange,
  onTest,
}: SettingsModalProps) {
  const [showGemini, setShowGemini] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  const [showXai, setShowXai] = useState(false);
  const selectedGroup = MODEL_OPTIONS.find((option) => option.value === model)?.group;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-sm"
          onClick={required ? undefined : onClose}
          role="presentation"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            className="flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl shadow-emerald-950/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#dfe8e2] p-5">
              <div>
                <h2 id="settings-title" className="text-lg font-black text-zinc-900">{t.settings}</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {t.settingsSubtitle}
                </p>
              </div>
              {!required && (
                <button type="button" onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-[#eef4f0]">
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto bg-[#f7faf8] p-5 custom-scrollbar">
              {required && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-relaxed text-amber-900">
                  {t.apiKeyRequired(requiredProvider)}
                </div>
              )}
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-black text-zinc-600">Gemini API Key</span>
                <div className="relative">
                  <input
                    type={showGemini ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => onChange({ geminiKey: e.target.value })}
                    className="w-full rounded-xl border border-[#dfe8e2] bg-white px-3 py-3 pr-10 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGemini((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"
                    aria-label={showGemini ? "隱藏 Gemini API Key" : "顯示 Gemini API Key"}
                  >
                    {showGemini ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-black text-zinc-600">OpenAI API Key</span>
                <div className="relative">
                  <input
                    type={showOpenai ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => onChange({ openaiKey: e.target.value })}
                    className="w-full rounded-xl border border-[#dfe8e2] bg-white px-3 py-3 pr-10 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenai((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"
                    aria-label={showOpenai ? "隱藏 OpenAI API Key" : "顯示 OpenAI API Key"}
                  >
                    {showOpenai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="mb-4 block">
                <span className="mb-1 block text-xs font-black text-zinc-600">Grok（xAI）API Key</span>
                <div className="relative">
                  <input
                    type={showXai ? "text" : "password"}
                    value={xaiKey}
                    onChange={(e) => onChange({ xaiKey: e.target.value })}
                    className="w-full rounded-xl border border-[#dfe8e2] bg-white px-3 py-3 pr-10 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowXai((value) => !value)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500"
                    aria-label={showXai ? "隱藏 Grok API Key" : "顯示 Grok API Key"}
                  >
                    {showXai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <label className="mb-4 block">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-zinc-600">模型</span>
                  <span className="rounded-full bg-[#fff4db] px-2 py-0.5 text-[10px] font-black text-[#7a4d0b]">
                    目前：{MODEL_OPTIONS.find((m) => m.value === model)?.label.split("（")[0] ?? model}
                  </span>
                </div>
                <select
                  value={model}
                  onChange={(e) => onChange({ model: e.target.value })}
                  className="min-h-12 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm font-bold text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                >
                  <optgroup label="免費模型（Puter 使用者免費額度）">
                    {MODEL_OPTIONS.filter((m) => m.group === "free").map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Gemini（Google）">
                    {MODEL_OPTIONS.filter((m) => m.group === "gemini").map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="ChatGPT（OpenAI）">
                    {MODEL_OPTIONS.filter((m) => m.group === "openai").map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Grok（xAI）">
                    {MODEL_OPTIONS.filter((m) => m.group === "xai").map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {selectedGroup === "free" && (
                <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-relaxed text-emerald-900">
                  免費模式不需要 API Key。首次生成時會由 Puter 開啟登入授權；每位使用者使用自己的免費月額度，額度用完後可等待重置或自行升級。
                </div>
              )}
              <div className="mb-4 rounded-xl border border-[#cfe0d7] bg-white p-4">
                <div className="mb-3">
                  <p className="text-xs font-black text-zinc-800">Google Forms</p>
                  <p className="mt-1 text-[11px] font-medium leading-relaxed text-zinc-500">
                    填入 Google Cloud 的「網頁應用程式 OAuth Client ID」。Client ID 不是密碼，系統只保存在目前瀏覽器；不會保存 Google access token。
                  </p>
                </div>
                {googleClientIdManaged ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-relaxed text-emerald-900">
                    Google Forms 已由系統管理者完成設定。建立問卷時，使用者只需登入 Google 並確認授權。
                  </div>
                ) : (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-black text-zinc-600">
                        Google OAuth Web Client ID
                      </span>
                      <input
                        type="text"
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        value={googleClientId}
                        placeholder="123456789-abc.apps.googleusercontent.com"
                        onChange={(event) => onChange({ googleClientId: event.target.value })}
                        className="w-full rounded-xl border border-[#dfe8e2] bg-white px-3 py-3 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                      />
                    </label>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-zinc-500">
                      Google Cloud 需啟用 Forms API，並將目前網址
                      <span className="mx-1 break-all font-black text-[#175247]">
                        {typeof window === "undefined" ? "" : window.location.origin}
                      </span>
                      加入「已授權的 JavaScript 來源」。
                    </p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={onTest}
                disabled={testing}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe8e2] bg-white py-3 text-sm font-black text-zinc-700 hover:border-[#b9ccc2] hover:bg-[#f7faf8]"
              >
                <Settings2 className="h-4 w-4" />
                {testing ? t.testingConnection : t.testConnection}
              </button>
              {connectionStatus && (
                <p className="mt-3 text-center text-xs font-bold text-[#9a6617]">{connectionStatus}</p>
              )}
            </div>
            <div className="border-t border-[#dfe8e2] bg-white p-4">
              <button
                type="button"
                onClick={onClose}
                disabled={required}
                className={`w-full rounded-xl py-3 text-sm font-black ${
                  required
                    ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                    : "bg-[#173f36] text-white shadow-sm hover:bg-[#0f312a]"
                }`}
              >
                {required ? t.apiKeyRequiredButton(requiredProvider) : t.closeSettings}
              </button>
              <p className="mt-2 text-center text-[11px] font-medium leading-relaxed text-zinc-500">
                {t.apiKeyPrivacyNote}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
