import { useEffect, useMemo, useState } from "react";
import { MODULES } from "@/data/constants";
import {
  assessmentExportFingerprint,
  createGoogleFormsFromAssessment,
  getGoogleFormsExportIssue,
  getGoogleOAuthClientIdIssue,
  isGoogleFormExportEntryComplete,
  type GoogleFormsExportRecord,
} from "@/lib/google-forms";
import { getAssessmentStrategy } from "@/lib/assessment-strategies";
import { KEYS, readJson, writeJson } from "@/lib/storage";
import { t } from "@/locales/zh-Hant";
import type {
  CourseForm,
  AssessmentDocument,
  GenerationPhase,
  GenerationProgress,
  Indicator,
  ModuleTab,
  RefineTarget,
  SavedQuestion,
} from "@/types";
import type { AssessmentDesignContext } from "@/types/course-ideation";
import { buildAssessmentEvidencePackageMarkdown } from "@/lib/course-assessment";
import type { ValidationResult } from "@/lib/validate-output";
import { AssessmentModule } from "./AssessmentModule";
import { ContextStrip } from "./ContextStrip";
import { ModuleHeader } from "./ModuleHeader";
import { NarrativeModule } from "./NarrativeModule";

interface OutputWorkspaceProps {
  modules: string[];
  activeTab: ModuleTab;
  onTabChange: (tab: ModuleTab) => void;
  generating: boolean;
  generationProgress: GenerationProgress | null;
  hasIndicator: boolean;
  hasAnyKey: boolean;
  indicator: Indicator | null;
  indicatorName: string;
  form: CourseForm;
  googleClientId: string;
  highlightKey: string | null;
  bank: SavedQuestion[];
  validation: ValidationResult | null;
  assessmentDesignContext: AssessmentDesignContext | null;
  assessmentDocument: AssessmentDocument | null;
  implementationNotes: string;
  onRefine?: (target: RefineTarget) => void;
  onSaveQuestion: (question: SavedQuestion) => void;
  onOpenAiSettings: () => void;
  onOpenGoogleFormsSettings: () => void;
}

const TAB_LABELS = ["課程敘述語", "課前診斷", "課後遷移"] as const;

const GENERATION_STAGES: Array<{ phase: GenerationPhase; label: string }> = [
  { phase: "connecting", label: "連線" },
  { phase: "narrative", label: "生成進程描述" },
  { phase: "pre", label: "生成課前" },
  { phase: "post", label: "生成課後" },
  { phase: "rendering", label: "格式組裝" },
  { phase: "validating", label: "品質檢查" },
  { phase: "repairing", label: "局部修復" },
];

function GeneratingSkeleton({ progress }: { progress: GenerationProgress | null }) {
  const currentIndex = Math.max(
    0,
    GENERATION_STAGES.findIndex((stage) => stage.phase === progress?.phase),
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-live="polite" aria-busy="true">
      <div className="rounded-2xl border border-[#d6e4dc] bg-white p-5 shadow-[0_8px_30px_rgba(15,45,38,0.08)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9a640f]">
              評量生成中
            </p>
            <h2 className="mt-2 text-lg font-black text-zinc-900">
              {GENERATION_STAGES[currentIndex]?.label ?? "連線"}
            </h2>
          </div>
          <div className="rounded-full bg-[#f8edcf] px-3 py-1.5 text-xs font-black tabular-nums text-[#7a4d0b]">
            {progress?.receivedChars.toLocaleString() ?? 0} 字
          </div>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e8efeb]">
          <div
            className="h-full rounded-full bg-[#173f36] transition-[width] duration-300"
            style={{ width: `${Math.max(8, ((currentIndex + 1) / GENERATION_STAGES.length) * 100)}%` }}
          />
        </div>

        <ol className="mt-5 grid gap-2 sm:grid-cols-2">
          {GENERATION_STAGES.map((stage, index) => {
            const active = index === currentIndex;
            const completed = index < currentIndex;
            return (
              <li
                key={stage.phase}
                className={`flex min-h-10 items-center gap-3 rounded-xl border px-3 py-2 text-xs font-black ${
                  active
                    ? "border-[#9ebcaf] bg-[#edf5f0] text-[#173f36]"
                    : completed
                      ? "border-transparent bg-[#f5f8f6] text-zinc-600"
                      : "border-transparent text-zinc-400"
                }`}
              >
                <span
                  className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] ${
                    active
                      ? "animate-pulse bg-[#173f36] text-white"
                      : completed
                        ? "bg-[#dce9e2] text-[#173f36]"
                        : "bg-zinc-100 text-zinc-400"
                  }`}
                >
                  {completed ? "✓" : index + 1}
                </span>
                {stage.label}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs font-bold leading-relaxed text-zinc-500">
          內容會先通過完整格式與品質檢查，確認完成後才顯示。
        </p>
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-[#dfe8e2]/60" />
      ))}
    </div>
  );
}

function EmptyState({
  hasIndicator,
  hasAnyKey,
  indicator,
  isCustom,
  customText,
  onOpenAiSettings,
}: {
  hasIndicator: boolean;
  hasAnyKey: boolean;
  indicator: Indicator | null;
  isCustom?: boolean;
  customText?: string;
  onOpenAiSettings: () => void;
}) {
  if (!hasAnyKey) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-[#e1bf69] bg-white p-8 text-center shadow-[0_1px_14px_rgba(15,45,38,0.06)]">
        <h2 className="text-lg font-black text-zinc-900">{t.emptyTitle}</h2>
        <p className="mt-2 text-sm font-medium text-zinc-600">{t.noApiKey}</p>
        <button
          type="button"
          onClick={onOpenAiSettings}
          className="mt-6 rounded-xl bg-[#173f36] px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/15 hover:bg-[#0f312a]"
        >
          {t.openSettings}
        </button>
      </div>
    );
  }

  if (hasIndicator && (indicator || isCustom)) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-[#dfe8e2] bg-white p-8 shadow-[0_1px_14px_rgba(15,45,38,0.06)]">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">{t.readyBadge}</p>
        <p className="mt-2 text-sm font-bold text-zinc-600">
          {isCustom ? t.customReadyHint : t.readyHint}
        </p>
        {indicator ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {(["evidence_limited", "emerging", "developing", "mastering"] as const).map((key, i) => (
              <div key={key} className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-3">
                <p className="text-[10px] font-black text-zinc-500">
                  {["證據有限", "萌芽", "發展", "精熟"][i]}
                </p>
                <p className="mt-1 line-clamp-3 text-xs font-medium text-zinc-700">{indicator.levels[key]}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl bg-[#f7faf8] p-4 text-sm font-medium text-zinc-700">{customText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-dashed border-[#dfe8e2] bg-white p-8 text-center shadow-[0_1px_14px_rgba(15,45,38,0.06)]">
      <h2 className="text-lg font-black text-zinc-900">{t.emptyTitle}</h2>
      <p className="mt-2 text-sm font-medium leading-relaxed text-zinc-600">{t.emptyDesc}</p>
      <ol className="mt-6 space-y-2 text-left text-sm font-bold text-zinc-700">
        {t.stepLabels.map((label) => (
          <li key={label} className="rounded-xl bg-[#f7faf8] px-4 py-2">
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function OutputWorkspace({
  modules,
  activeTab,
  onTabChange,
  generating,
  generationProgress,
  hasIndicator,
  hasAnyKey,
  indicator,
  indicatorName,
  form,
  googleClientId,
  highlightKey,
  bank,
  validation,
  assessmentDesignContext,
  assessmentDocument,
  implementationNotes,
  onRefine,
  onSaveQuestion,
  onOpenAiSettings,
  onOpenGoogleFormsSettings,
}: OutputWorkspaceProps) {
  const [formsExporting, setFormsExporting] = useState(false);
  const [formsExportStatus, setFormsExportStatus] = useState<string | null>(null);
  const formsFingerprint = useMemo(
    () => assessmentExportFingerprint(form, indicatorName, modules[1] ?? "", modules[2] ?? ""),
    [form, indicatorName, modules],
  );
  const [formsExportRecord, setFormsExportRecord] = useState<GoogleFormsExportRecord | null>(null);
  useEffect(() => {
    const records = readJson<Record<string, GoogleFormsExportRecord>>(KEYS.googleFormsExports, {});
    const preFingerprint = assessmentExportFingerprint(
      form,
      indicatorName,
      modules[1] ?? "",
      "",
    );
    setFormsExportRecord(
      records[formsFingerprint] ??
        Object.values(records).find(
          (record) => record.preFingerprint === preFingerprint,
        ) ??
        null,
    );
    setFormsExportStatus(null);
  }, [form, formsFingerprint, indicatorName, modules]);

  const persistFormsRecord = (record: GoogleFormsExportRecord) => {
    const records = readJson<Record<string, GoogleFormsExportRecord>>(KEYS.googleFormsExports, {});
    records[record.fingerprint] = record;
    writeJson(KEYS.googleFormsExports, records);
    setFormsExportRecord(record);
  };
  const bankIds = new Set(bank.map((q) => q.id));
  const strategy = getAssessmentStrategy(form);
  const contextParts = [
    form.grade,
    form.subject,
    form.activityName,
    indicatorName,
    `能力階梯：${strategy.label}`,
  ];
  const meta = MODULES[activeTab];
  const preUsesNewGuidedQ4 = modules[1]?.includes("Q4. [引導式簡答題]") ?? false;
  const postUsesNewGuidedQ4 = modules[2]?.includes("Q4. [引導式簡答題]") ?? false;
  const invalidQ4Targets = new Set(
    validation?.issues
      .filter((issue) => issue.severity === "error")
      .flatMap((issue) => issue.targets)
      .filter(
        (target) =>
          (target === "pre.q4" && preUsesNewGuidedQ4) ||
          (target === "post.q4" && postUsesNewGuidedQ4),
      ) ?? [],
  );
  const validationQ4Issue = invalidQ4Targets.has("pre.q4")
    ? "課前診斷 Q4 未通過品質檢查，請重新生成評量。"
    : invalidQ4Targets.has("post.q4")
      ? "課後遷移 Q4 未通過品質檢查，請重新生成評量。"
      : null;
  const formsExportIssue =
    validationQ4Issue ??
    (modules[1]
      ? getGoogleFormsExportIssue(modules[1], modules[2] ?? "")
      : "尚未產生課前診斷。");
  const googleClientIdIssue = getGoogleOAuthClientIdIssue(googleClientId);

  const handleExportGoogleForm = async () => {
    if (formsExportIssue) {
      setFormsExportStatus(formsExportIssue);
      return;
    }
    if (googleClientIdIssue) {
      onOpenGoogleFormsSettings();
      return;
    }
    setFormsExporting(true);
    setFormsExportStatus(
      modules[2]
        ? "正在登入 Google，授權後會依序建立課前與課後兩份問卷。"
        : "正在登入 Google，授權後會建立課前診斷問卷。",
    );
    try {
      const result = await createGoogleFormsFromAssessment({
        clientId: googleClientId,
        form,
        indicatorName,
        preContent: modules[1] ?? "",
        postContent: modules[2] ?? "",
        existing: formsExportRecord,
        onProgress: persistFormsRecord,
      });
      persistFormsRecord(result);
      const expected = modules[2] ? 2 : 1;
      const complete = [result.pre, result.post]
        .slice(0, expected)
        .filter(isGoogleFormExportEntryComplete).length;
      setFormsExportStatus(complete === expected
        ? expected === 2
          ? "課前與課後問卷均已建立。"
          : "課前診斷問卷已建立；課後評量完成後可再建立課後問卷。"
        : `已完成 ${complete} 份；未完成的問卷可按同一按鈕重試，已完成者不會重建。`);
    } catch (error) {
      setFormsExportStatus(error instanceof Error ? error.message : "Google 問卷建立失敗。");
    } finally {
      setFormsExporting(false);
    }
  };
  const evidencePackageMarkdown =
    assessmentDesignContext && assessmentDocument
      ? buildAssessmentEvidencePackageMarkdown({
          context: assessmentDesignContext,
          document: assessmentDocument,
          form,
          implementationNotes,
        })
      : null;

  const downloadEvidencePackage = () => {
    if (!evidencePackageMarkdown) return;
    const blob = new Blob([evidencePackageMarkdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `NPDL-${form.activityName}-完整評量證據包.md`.replace(
      /[\\/:*?"<>|]/g,
      "-",
    );
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const printEvidencePackage = () => {
    if (!evidencePackageMarkdown) return;
    const escaped = evidencePackageMarkdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>NPDL 完整評量證據包</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:32px;color:#18181b}pre{white-space:pre-wrap;font:14px/1.75 inherit}@media print{body{margin:16mm}}</style></head><body><pre>${escaped}</pre><script>window.addEventListener("load",()=>window.print())</script></body></html>`);
    popup.document.close();
  };

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex gap-1 overflow-x-auto border-b border-[#dfe8e2] bg-white/90 p-2 backdrop-blur-md"
        role="tablist"
        aria-label="產出模組"
      >
        {TAB_LABELS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={activeTab === index}
            onClick={() => onTabChange(index as ModuleTab)}
            className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-xs font-black lg:text-sm ${
              activeTab === index
                ? "bg-[#173f36] text-white shadow-sm shadow-emerald-950/15"
                : "bg-[#eef4f0] text-zinc-600 hover:bg-[#e2ebe5] hover:text-zinc-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6">
        {generating ? (
          <GeneratingSkeleton progress={generationProgress} />
        ) : modules.length === 0 ? (
          <EmptyState
            hasIndicator={hasIndicator}
            hasAnyKey={hasAnyKey}
            indicator={indicator}
            isCustom={form.source === "自訂"}
            customText={form.customIndicator}
            onOpenAiSettings={onOpenAiSettings}
          />
        ) : (
          <div role="tabpanel">
            <ModuleHeader
              title={meta.title}
              subtitle={meta.subtitle}
              editHint={meta.editHint}
              accent={meta.accent}
            />
            <ContextStrip parts={contextParts} />
            {!onRefine && modules.some(Boolean) && (
              <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-bold leading-relaxed text-amber-900">
                這是舊版草稿，仍可查看、收藏與匯出；因缺少完整結構化資料，AI 微調已停用。請重新生成評量後再使用微調。
              </p>
            )}
            {modules[1] && (
              <div className="mb-4 rounded-xl border border-[#dfe8e2] bg-white p-3 shadow-sm shadow-emerald-950/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-zinc-900">Google 問卷匯出</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">
                      {modules[2]
                        ? "將課前診斷與課後遷移分別轉成 Google 表單；只輸出 Q1–Q4。"
                        : "課程端完整前測已可先轉成 Google 表單；課後完成後再建立第二份問卷。"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={onOpenGoogleFormsSettings}
                      className="min-h-11 rounded-xl border border-[#b9ccc2] bg-white px-4 py-2 text-xs font-black text-[#173f36] hover:bg-[#eef4f0]"
                    >
                      Google Forms 設定
                    </button>
                    <button
                      type="button"
                      onClick={handleExportGoogleForm}
                      disabled={formsExporting || Boolean(formsExportIssue)}
                      title={formsExportIssue ?? googleClientIdIssue ?? undefined}
                      className="min-h-11 rounded-xl bg-[#173f36] px-4 py-2 text-xs font-black text-white shadow-sm shadow-emerald-950/15 hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {formsExporting
                        ? "建立中..."
                        : googleClientIdIssue
                          ? "設定 Google Forms"
                        : modules[2]
                          ? isGoogleFormExportEntryComplete(
                                formsExportRecord?.pre,
                              ) &&
                              isGoogleFormExportEntryComplete(
                                formsExportRecord?.post,
                              )
                            ? "兩份問卷已建立"
                            : formsExportRecord?.pre || formsExportRecord?.post
                              ? "重試未完成問卷"
                              : "登入 Google 並建立課前／課後問卷"
                          : isGoogleFormExportEntryComplete(
                                formsExportRecord?.pre,
                              )
                            ? "課前問卷已建立"
                            : formsExportRecord?.pre
                              ? "重試課前問卷"
                              : "登入 Google 並建立課前問卷"}
                    </button>
                  </div>
                </div>
                {formsExportIssue && (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                    {formsExportIssue} Google 問卷匯出已停用。
                  </p>
                )}
                {!formsExportIssue && googleClientIdIssue && (
                  <div className="mt-2 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                    <span>尚未完成 Google Forms OAuth 設定；請先填入 Google OAuth Web Client ID。</span>
                    <button
                      type="button"
                      onClick={onOpenGoogleFormsSettings}
                      className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-black hover:bg-amber-100"
                    >
                      開啟設定
                    </button>
                  </div>
                )}
                {formsExportStatus && (
                  <p className="mt-2 rounded-lg bg-[#f7faf8] px-3 py-2 text-xs font-bold text-[#7a4d0b]">
                    {formsExportStatus}
                  </p>
                )}
                {(formsExportRecord?.pre || formsExportRecord?.post) && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(["pre", "post"] as const).map((type) => {
                      const entry = formsExportRecord[type];
                      if (!entry) return null;
                      const label = type === "pre" ? "課前診斷" : "課後遷移";
                      const statusLabel = isGoogleFormExportEntryComplete(entry)
                        ? "已發布並接受回應"
                        : entry.stage === "content_applied"
                          ? "題目已完成，等待發布"
                          : entry.stage === "created"
                            ? "表單已建立，等待填入題目"
                            : "尚未建立完成";
                      return (
                        <div key={type} className="rounded-lg border border-[#dfe8e2] bg-[#f7faf8] p-3 text-xs">
                          <p className="font-black text-zinc-800">{label}｜{statusLabel}</p>
                          {entry.error && <p className="mt-1 font-bold leading-relaxed text-red-700">{entry.error}</p>}
                          <div className="mt-2 flex flex-wrap gap-3 font-black text-[#175247]">
                            {entry.editUrl && <a href={entry.editUrl} target="_blank" rel="noreferrer">編輯連結</a>}
                            {isGoogleFormExportEntryComplete(entry) && entry.responderUri && (
                              <a href={entry.responderUri} target="_blank" rel="noreferrer">作答連結</a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {evidencePackageMarkdown && (
              <div className="mb-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-cyan-950">
                      完整課程與評量證據包
                    </p>
                    <p className="mt-1 text-xs font-bold text-cyan-800">
                      包含課綱、學習終點、真實任務、四級規準、Q1–Q4 對齊表、課程敘述語及課前／課後題組。
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={downloadEvidencePackage}
                      className="min-h-11 rounded-xl border border-cyan-300 bg-white px-4 text-xs font-black text-cyan-950 hover:bg-cyan-100"
                    >
                      下載 Markdown
                    </button>
                    <button
                      type="button"
                      onClick={printEvidencePackage}
                      className="min-h-11 rounded-xl bg-cyan-900 px-4 text-xs font-black text-white hover:bg-cyan-950"
                    >
                      列印／另存 PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 0 && modules[0] && (
              <NarrativeModule
                content={modules[0]}
                indicator={indicator}
                highlightKey={highlightKey}
                onRefine={onRefine}
              />
            )}
            {activeTab === 1 && modules[1] && (
              <AssessmentModule
                content={modules[1]}
                type="pre"
                accent="teal"
                form={form}
                indicatorName={indicatorName}
                highlightKey={highlightKey}
                bankIds={bankIds}
                q4Invalid={invalidQ4Targets.has("pre.q4")}
                onRefine={onRefine}
                onSaveQuestion={onSaveQuestion}
              />
            )}
            {activeTab === 2 && modules[2] && (
              <AssessmentModule
                content={modules[2]}
                type="post"
                accent="violet"
                form={form}
                indicatorName={indicatorName}
                highlightKey={highlightKey}
                bankIds={bankIds}
                q4Invalid={invalidQ4Targets.has("post.q4")}
                onRefine={onRefine}
                onSaveQuestion={onSaveQuestion}
              />
            )}
            {activeTab === 2 &&
              !modules[2] &&
              assessmentDesignContext?.courseAssessmentSeed && (
                <div className="rounded-xl border border-dashed border-cyan-300 bg-cyan-50 p-8 text-center">
                  <p className="text-base font-black text-cyan-950">
                    課後評量尚未產生
                  </p>
                  <p className="mt-2 text-sm font-bold leading-7 text-cyan-800">
                    課程敘述語與課前 Q1–Q4 已由課程端唯讀帶入。請在上方補充實際教學差異（可留空），再按「分析課程與前測，產生課後評量」。
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
