import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookMarked,
  Layers,
  Menu,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Smartphone,
  Tablet,
  X,
} from "lucide-react";
import { Sidebar } from "@/features/input/Sidebar";
import { OutputWorkspace } from "@/features/output/OutputWorkspace";
import { QuestionBankDrawer } from "@/features/question-bank/QuestionBankDrawer";
import { RefineDrawer } from "@/features/refine/RefineDrawer";
import { SettingsModal } from "@/features/settings/SettingsModal";
import { useAppState } from "@/hooks/useAppState";
import { extractPdfText } from "@/lib/pdf";
import { t } from "@/locales/zh-Hant";

const previewWidths: Record<string, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export default function App() {
  const state = useAppState();
  const outputRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [pdfMeta, setPdfMeta] = useState("");
  const [validationBannerDismissed, setValidationBannerDismissed] = useState(false);

  const indicatorName =
    state.form.source === "自訂"
      ? state.form.customIndicator
      : state.indicator?.name ?? "";
  const requiresApiKey = !state.hasSelectedModelKey;
  const requiredKeyProvider =
    state.selectedModelProvider === "openai"
      ? "OpenAI"
      : state.selectedModelProvider === "xai"
        ? "Grok"
        : "Gemini";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (requiresApiKey) {
      state.setSettingsOpen(true);
    }
  }, [requiresApiKey, state.setSettingsOpen]);

  useEffect(() => {
    if (!state.generating && state.generatedMarkdown && outputRef.current) {
      outputRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [state.generating, state.generatedMarkdown]);

  useEffect(() => {
    setValidationBannerDismissed(false);
  }, [state.validation]);

  const handlePdfSelect = useCallback(
    async (file: File | null) => {
      if (!file) {
        state.setPdfExcerpt("");
        state.setPdfName("");
        setPdfMeta("");
        return;
      }
      state.setPdfName(file.name);
      try {
        const { text, pageCount, wordCount } = await extractPdfText(file);
        state.setPdfExcerpt(text);
        setPdfMeta(`${pageCount} 頁 · ${wordCount} 字`);
      } catch {
        state.setError("無法讀取 PDF 內容，請嘗試其他檔案。");
        state.setPdfExcerpt("");
        setPdfMeta("");
      }
    },
    [state],
  );

  const handleJumpStep = (step: number) => {
    if (isMobile) state.setMobileStep(Math.min(3, Math.max(1, step)));
  };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f3f7f4] text-zinc-900">
      <header className="relative z-30 flex shrink-0 items-center justify-between border-b border-[#dfe8e2] bg-white/90 px-4 py-3 shadow-[0_1px_12px_rgba(15,45,38,0.06)] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-xl border border-[#dbe7e0] bg-white p-2 shadow-sm lg:hidden"
            onClick={() => state.setSidebarOpen((v) => !v)}
            aria-label="開啟輸入面板"
          >
            {state.sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#173f36] text-white shadow-sm shadow-emerald-900/20">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight text-zinc-900">{t.appTitle}</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{t.appSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => state.setSidebarOpen((v) => !v)}
            className="hidden items-center gap-2 rounded-xl border border-[#dbe7e0] bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm hover:border-[#b9ccc2] hover:bg-[#f7faf8] lg:flex"
            aria-expanded={state.sidebarOpen}
            aria-controls="desktop-input-drawer"
            title={state.sidebarOpen ? "收合輸入面板" : "開啟輸入面板"}
          >
            {state.sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            {state.sidebarOpen ? "收合輸入" : "開啟輸入"}
          </button>
          <div className="hidden items-center gap-1 rounded-xl border border-[#dbe7e0] bg-[#eef4f0] p-1 sm:flex" aria-label={t.previewDevice}>
            {([
              ["desktop", Monitor],
              ["tablet", Tablet],
              ["mobile", Smartphone],
            ] as const).map(([device, Icon]) => (
              <button
                key={device}
                type="button"
                title={device === "desktop" ? "桌面寬度預覽" : device === "tablet" ? "平板寬度預覽" : "手機寬度預覽"}
                aria-label={device === "desktop" ? "桌面寬度預覽" : device === "tablet" ? "平板寬度預覽" : "手機寬度預覽"}
                onClick={() => state.setPreviewDevice(device)}
                className={`rounded-lg p-2 ${
                  state.previewDevice === device ? "bg-white text-[#173f36] shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => state.setBankOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-[#dbe7e0] bg-white px-3 py-2 text-xs font-black text-zinc-700 shadow-sm hover:border-[#b9ccc2] hover:bg-[#f7faf8] sm:flex"
          >
            <BookMarked className="h-4 w-4" />
            {t.savedCount(state.bank.length)}
          </button>
          <button
            type="button"
            onClick={() => state.setSettingsOpen(true)}
            className="rounded-xl border border-[#dbe7e0] bg-white p-2 text-zinc-600 shadow-sm hover:border-[#b9ccc2] hover:bg-[#f7faf8]"
            aria-label={t.settings}
          >
            <Settings2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      {state.draftPrompt && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-2 text-sm">
          <span className="font-bold text-amber-800">{t.draftRestore}</span>
          <div className="flex gap-2">
            <button type="button" onClick={state.restoreDraft} className="rounded-lg bg-[#173f36] px-3 py-1 text-xs font-black text-white">
              {t.draftRestoreYes}
            </button>
            <button type="button" onClick={state.dismissDraft} className="rounded-lg border border-[#dbe7e0] bg-white px-3 py-1 text-xs font-black text-zinc-700">
              {t.draftRestoreNo}
            </button>
          </div>
        </div>
      )}

      {state.error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-center text-xs font-bold text-red-700">
          {state.error}
          <button type="button" className="ml-3 underline" onClick={() => state.setError(null)}>
            關閉
          </button>
        </div>
      )}

      {state.validation &&
        !validationBannerDismissed &&
        !state.validation.ok &&
        (state.validation.errors.length > 0 || state.validation.warnings.length > 0) && (
        <div
          className={`border-b px-4 py-3 text-xs ${
            state.validation.errors.length > 0
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-[#dfe8e2] bg-[#f7faf8] text-zinc-700"
          }`}
        >
          <p className="font-black">
            {state.validation.ok
              ? t.validationFormatOk
              : t.validationErrors(state.validation.errors.length, state.repairStatus)}
            {state.validation.warnings.length > 0 &&
              ` · ${t.validationWarnings(state.validation.warnings.length)}`}
          </p>
          <ul className="mt-2 max-h-24 list-inside list-disc space-y-0.5 overflow-y-auto font-medium">
            {[...state.validation.errors, ...state.validation.warnings].map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 underline"
            onClick={() => setValidationBannerDismissed(true)}
          >
            關閉
          </button>
        </div>
      )}

      {state.validation?.ok && state.generatedMarkdown && (
        <div className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-1.5 text-center text-[10px] font-bold text-emerald-700">
          {t.validationFormatOk}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {!isMobile && (
          <>
            <aside
              id="desktop-input-drawer"
            className={`relative z-10 flex shrink-0 flex-col overflow-hidden border-r border-[#dfe8e2] bg-white transition-[width,opacity,transform] duration-300 ease-out ${
                state.sidebarOpen
                  ? "w-full max-w-md opacity-100 lg:max-w-lg"
                  : "w-0 translate-x-[-0.5rem] opacity-0"
              }`}
              aria-hidden={!state.sidebarOpen}
              inert={!state.sidebarOpen}
            >
              <div className="h-full w-screen max-w-md lg:max-w-lg">
                <Sidebar
                  form={state.form}
                  updateForm={state.updateForm}
                  indicatorName={indicatorName}
                  hasIndicator={state.hasIndicator}
                  hasActivity={state.hasActivity}
                  hasContext={state.hasContext}
                  canGenerate={state.canGenerate}
                  generating={state.generating}
                  ideation={state.ideation}
                  ideating={state.ideating}
                  ideationNotice={state.ideationNotice}
                  onIdeate={state.runIdeation}
                  onGenerate={state.runGenerate}
                  onJumpStep={handleJumpStep}
                  mobileStep={state.mobileStep}
                  setMobileStep={state.setMobileStep}
                  pdfName={state.pdfName ? `${state.pdfName}${pdfMeta ? `（${pdfMeta}）` : ""}` : ""}
                  onPdfSelect={handlePdfSelect}
                  appendKeyword={state.appendKeyword}
                  isMobile={false}
                />
              </div>
            </aside>
          </>
        )}

        <AnimatePresence>
          {isMobile && state.sidebarOpen && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-zinc-950/30"
                aria-label="關閉側欄"
                onClick={() => state.setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="fixed inset-x-0 bottom-0 top-auto z-50 flex h-[88dvh] flex-col rounded-t-2xl border-t border-[#dfe8e2] bg-white shadow-2xl shadow-emerald-950/10"
              >
                <Sidebar
                  form={state.form}
                  updateForm={state.updateForm}
                  indicatorName={indicatorName}
                  hasIndicator={state.hasIndicator}
                  hasActivity={state.hasActivity}
                  hasContext={state.hasContext}
                  canGenerate={state.canGenerate}
                  generating={state.generating}
                  ideation={state.ideation}
                  ideating={state.ideating}
                  ideationNotice={state.ideationNotice}
                  onIdeate={state.runIdeation}
                  onGenerate={state.runGenerate}
                  onJumpStep={handleJumpStep}
                  mobileStep={state.mobileStep}
                  setMobileStep={state.setMobileStep}
                  pdfName={state.pdfName ? `${state.pdfName}${pdfMeta ? `（${pdfMeta}）` : ""}` : ""}
                  onPdfSelect={handlePdfSelect}
                  appendKeyword={state.appendKeyword}
                  isMobile
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <main ref={outputRef} className="min-w-0 flex-1">
          <div
            className="mx-auto h-full transition-all duration-300"
            style={{ maxWidth: previewWidths[state.previewDevice] }}
          >
            <OutputWorkspace
              modules={state.modules}
              activeTab={state.activeModuleTab}
              onTabChange={state.setActiveModuleTab}
              generating={state.generating}
              generationProgress={state.generationProgress}
              hasIndicator={state.hasIndicator}
              hasAnyKey={state.hasAnyKey}
              indicator={state.indicator}
              indicatorName={indicatorName}
              form={state.form}
              googleClientId={state.settings.googleClientId}
              highlightKey={state.highlightKey}
              bank={state.bank}
              validation={state.validation}
              onRefine={state.canRefine ? (target) => {
                state.setRefineTarget(target);
                if (target.type === "scenario") {
                  state.setRefineInstruction(
                    target.id === "課前"
                      ? "請維持零課程詞彙，只用生活現象與日常物件描述。"
                      : "請嵌入本堂課活動名稱、核心概念與科目專業詞彙。",
                  );
                } else {
                  state.setRefineInstruction("");
                }
              } : undefined}
              onSaveQuestion={state.saveQuestion}
              onOpenSettings={() => state.setSettingsOpen(true)}
            />
          </div>
        </main>
      </div>

      <SettingsModal
        open={state.settingsOpen || requiresApiKey}
        geminiKey={state.settings.geminiKey}
        openaiKey={state.settings.openaiKey}
        xaiKey={state.settings.xaiKey}
        googleClientId={state.settings.googleClientId}
        googleClientIdManaged={state.googleClientIdManaged}
        model={state.settings.model}
        testing={state.testingConnection}
        connectionStatus={state.connectionStatus}
        required={requiresApiKey}
        requiredProvider={requiredKeyProvider}
        onClose={() => {
          if (!requiresApiKey) state.setSettingsOpen(false);
        }}
        onChange={(patch) => state.setSettings((prev) => ({ ...prev, ...patch }))}
        onTest={state.testConnection}
      />

      <QuestionBankDrawer
        open={state.bankOpen}
        items={state.bank}
        onClose={() => state.setBankOpen(false)}
        onRemove={state.removeQuestion}
      />

      <RefineDrawer
        open={Boolean(state.refineTarget)}
        target={state.refineTarget}
        instruction={state.refineInstruction}
        loading={state.refining}
        onClose={() => {
          state.setRefineTarget(null);
          state.setRefineInstruction("");
        }}
        onInstructionChange={state.setRefineInstruction}
        onSubmit={state.runRefine}
      />
    </div>
  );
}
