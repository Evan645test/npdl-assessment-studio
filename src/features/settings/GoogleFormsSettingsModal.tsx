import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

interface GoogleFormsSettingsModalProps {
  open: boolean;
  clientId: string;
  managed: boolean;
  onClose: () => void;
  onChange: (clientId: string) => void;
}

export function GoogleFormsSettingsModal({
  open,
  clientId,
  managed,
  onClose,
  onChange,
}: GoogleFormsSettingsModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/35 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-forms-settings-title"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#dfe8e2] p-5">
              <div>
                <h2
                  id="google-forms-settings-title"
                  className="text-lg font-black text-zinc-900"
                >
                  Google Forms 設定
                </h2>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                  此設定只供評量工作區建立 Google 表單使用。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉 Google Forms 設定"
                className="rounded-xl p-2 text-zinc-500 hover:bg-[#eef4f0]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="bg-[#f7faf8] p-5">
              {managed ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold leading-6 text-emerald-900">
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
                      value={clientId}
                      placeholder="123456789-abc.apps.googleusercontent.com"
                      onChange={(event) => onChange(event.target.value)}
                      className="w-full rounded-xl border border-[#dfe8e2] bg-white px-3 py-3 text-sm text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>
                  <p className="mt-3 text-[11px] font-medium leading-6 text-zinc-500">
                    Google Cloud 需啟用 Forms API，並將目前網址
                    <span className="mx-1 break-all font-black text-[#175247]">
                      {typeof window === "undefined"
                        ? ""
                        : window.location.origin}
                    </span>
                    加入「已授權的 JavaScript 來源」。Client ID 不是密碼，只保存在目前瀏覽器。
                  </p>
                </>
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
