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
  GenerationPhase,
  GenerationProgress,
  Indicator,
  ModuleTab,
  RefineTarget,
  SavedQuestion,
} from "@/types";
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
  onRefine?: (target: RefineTarget) => void;
  onSaveQuestion: (question: SavedQuestion) => void;
  onOpenSettings: () => void;
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
  onOpenSettings,
}: {
  hasIndicator: boolean;
  hasAnyKey: boolean;
  indicator: Indicator | null;
  isCustom?: boolean;
  customText?: string;
  onOpenSettings: () => void;
}) {
  if (!hasAnyKey) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-dashed border-[#e1bf69] bg-white p-8 text-center shadow-[0_1px_14px_rgba(15,45,38,0.06)]">
        <h2 className="text-lg font-black text-zinc-900">{t.emptyTitle}</h2>
        <p className="mt-2 text-sm font-medium text-zinc-600">{t.noApiKey}</p>
        <button
          type="button"
          onClick={onOpenSettings}
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
  onRefine,
  onSaveQuestion,
  onOpenSettings,
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
    setFormsExportRecord(records[formsFingerprint] ?? null);
    setFormsExportStatus(null);
  }, [formsFingerprint]);

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
  const formsExportIssue = validationQ4Issue ?? (modules[1] && modules[2]
    ? getGoogleFormsExportIssue(modules[1], modules[2])
    : null);
  const googleClientIdIssue = getGoogleOAuthClientIdIssue(googleClientId);

  const handleExportGoogleForm = async () => {
    if (formsExportIssue) {
      setFormsExportStatus(formsExportIssue);
      return;
    }
    if (googleClientIdIssue) {
      onOpenSettings();
      return;
    }
    setFormsExporting(true);
    setFormsExportStatus("正在登入 Google，授權後會依序建立課前與課後兩份問卷。");
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
      const complete = [result.pre, result.post].filter(isGoogleFormExportEntryComplete).length;
      setFormsExportStatus(complete === 2
        ? "課前與課後問卷均已建立。"
        : `已完成 ${complete} 份；未完成的問卷可按同一按鈕重試，已完成者不會重建。`);
    } catch (error) {
      setFormsExportStatus(error instanceof Error ? error.message : "Google 問卷建立失敗。");
    } finally {
      setFormsExporting(false);
    }
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
            onOpenSettings={onOpenSettings}
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
            {modules[1] && modules[2] && (
              <div className="mb-4 rounded-xl border border-[#dfe8e2] bg-white p-3 shadow-sm shadow-emerald-950/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-zinc-900">Google 問卷匯出</p>
                    <p className="mt-1 text-xs font-bold text-zinc-500">
                      將課前診斷與課後遷移轉成 Google 表單；Q1–Q3 與 Q4 都依「概念理解、行動應用、生活遷移」排列，方便後續整批判讀。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportGoogleForm}
                    disabled={formsExporting || Boolean(formsExportIssue)}
                    title={formsExportIssue ?? googleClientIdIssue ?? undefined}
                    className="min-h-11 shrink-0 rounded-xl bg-[#173f36] px-4 py-2 text-xs font-black text-white shadow-sm shadow-emerald-950/15 hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {formsExporting
                      ? "建立中..."
                      : googleClientIdIssue
                        ? "設定 Google Forms"
                      : isGoogleFormExportEntryComplete(formsExportRecord?.pre)
                        && isGoogleFormExportEntryComplete(formsExportRecord?.post)
                        ? "兩份問卷已建立"
                        : formsExportRecord?.pre || formsExportRecord?.post
                          ? "重試未完成問卷"
                          : "登入 Google 並建立課前／課後問卷"}
                  </button>
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
                      onClick={onOpenSettings}
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
          </div>
        )}
      </div>
    </div>
  );
}
