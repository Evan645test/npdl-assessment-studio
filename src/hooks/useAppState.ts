import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_FORM, DEFAULT_MODEL, MODEL_OPTIONS } from "@/data/constants";
import { getIndicatorById } from "@/data/indicators";
import { generateAssessment } from "@/lib/assessment-generation";
import {
  buildAssessmentPatchSchema,
  mergeAssessmentPatch,
  parseAssessmentDocument,
  parseAssessmentPatch,
  renderAssessmentMarkdown,
  selectAssessmentPatchSource,
} from "@/lib/assessment-document";
import { normalizeGeneratedQ4Markdown } from "@/lib/q4-guidance";
import { generateContent, generateIdeationJson, getModelProvider } from "@/lib/ai/client";
import { toUserErrorMessage } from "@/lib/errors";
import { splitModules } from "@/lib/markdown";
import {
  buildConnectionTestPrompt,
  buildIdeationPrompt,
  buildStructuredRefinePrompt,
} from "@/prompts";
import { validateGeneratedMarkdown, type ValidationResult } from "@/lib/validate-output";
import { KEYS, readJson, writeJson, writeStorage } from "@/lib/storage";
import type {
  CourseForm,
  AssessmentDocument,
  AssessmentTarget,
  DraftState,
  GenerationProgress,
  IdeationResult,
  LegacyDraftState,
  ModuleTab,
  PreviewDevice,
  RefineTarget,
  SavedQuestion,
} from "@/types";

const MANAGED_GOOGLE_OAUTH_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

function readSettings() {
  const model = readJson<string | null>(KEYS.model, null);
  const allowed = MODEL_OPTIONS.map((m) => m.value);
  return {
    geminiKey: localStorage.getItem(KEYS.geminiKey) ?? "",
    openaiKey: localStorage.getItem(KEYS.openaiKey) ?? "",
    xaiKey: localStorage.getItem(KEYS.xaiKey) ?? "",
    googleClientId:
      MANAGED_GOOGLE_OAUTH_CLIENT_ID
      || localStorage.getItem(KEYS.googleOAuthClientId)
      || "",
    model: model && allowed.includes(model as (typeof allowed)[number]) ? model : DEFAULT_MODEL,
  };
}

export function useAppState() {
  const [form, setForm] = useState<CourseForm>(DEFAULT_FORM);
  const [assessmentDocument, setAssessmentDocument] = useState<AssessmentDocument | null>(null);
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(null);
  const [activeModuleTab, setActiveModuleTab] = useState<ModuleTab>(0);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [mobileStep, setMobileStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [refineTarget, setRefineTarget] = useState<RefineTarget | null>(null);
  const [refineInstruction, setRefineInstruction] = useState("");
  const [refining, setRefining] = useState(false);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [pdfExcerpt, setPdfExcerpt] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [ideation, setIdeation] = useState<IdeationResult | null>(null);
  const [ideating, setIdeating] = useState(false);
  const [ideationNotice, setIdeationNotice] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<DraftState | LegacyDraftState | null>(null);
  const [draftStorageReady, setDraftStorageReady] = useState(false);
  const [settings, setSettings] = useState(readSettings);
  const [bank, setBank] = useState<SavedQuestion[]>(() =>
    readJson<SavedQuestion[]>(KEYS.questionBank, []),
  );
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);

  const indicator = useMemo(
    () => (form.source === "資料庫" ? getIndicatorById(form.indicatorId) ?? null : null),
    [form.source, form.indicatorId],
  );

  const modules = useMemo(() => splitModules(generatedMarkdown), [generatedMarkdown]);

  const hasIndicator = form.source === "自訂" ? form.customIndicator.trim().length > 0 : Boolean(indicator);
  const hasActivity = Boolean(form.grade && form.subject && form.activityName.trim().length >= 2);
  const hasContext = form.lifeKeywords.trim().length > 0;
  const hasTools = form.tools.trim().length > 0;
  const selectedModelProvider = getModelProvider(settings.model);
  const hasSelectedModelKey =
    selectedModelProvider === "free" ||
    (selectedModelProvider === "openai" && Boolean(settings.openaiKey.trim())) ||
    (selectedModelProvider === "xai" && Boolean(settings.xaiKey.trim())) ||
    (selectedModelProvider === "gemini" && Boolean(settings.geminiKey.trim()));
  const canGenerate = hasIndicator && hasActivity && hasContext && hasTools && hasSelectedModelKey;
  const hasAnyKey = hasSelectedModelKey;

  useEffect(() => {
    writeStorage(KEYS.geminiKey, settings.geminiKey);
    writeStorage(KEYS.openaiKey, settings.openaiKey);
    writeStorage(KEYS.xaiKey, settings.xaiKey);
    writeStorage(KEYS.googleOAuthClientId, settings.googleClientId);
    writeJson(KEYS.model, settings.model);
  }, [settings]);

  useEffect(() => {
    setConnectionStatus(null);
  }, [settings.model, settings.geminiKey, settings.openaiKey, settings.xaiKey]);

  useEffect(() => {
    writeJson(KEYS.questionBank, bank);
  }, [bank]);

  useEffect(() => {
    if (!draftStorageReady) return;
    if (!form.activityName && !generatedMarkdown) return;
    const draft: DraftState = {
      form,
      assessmentDocument,
      legacyMarkdown: assessmentDocument ? undefined : generatedMarkdown,
      activeModuleTab,
      savedAt: Date.now(),
    };
    writeJson(KEYS.draft, draft);
  }, [form, assessmentDocument, activeModuleTab, draftStorageReady]);

  useEffect(() => {
    const dismissed = localStorage.getItem(KEYS.draftDismissed);
    const draft = readJson<DraftState | null>(KEYS.draft, null)
      ?? readJson<LegacyDraftState | null>(KEYS.legacyDraft, null);
    if (draft && !dismissed && draft.savedAt > Date.now() - 1000 * 60 * 60 * 24 * 7) {
      setDraftPrompt(draft);
    }
    setDraftStorageReady(true);
  }, []);

  const updateForm = useCallback((patch: Partial<CourseForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const restoreDraft = useCallback(() => {
    if (!draftPrompt) return;
    const isV3 = "assessmentDocument" in draftPrompt;
    let restoredDocument: AssessmentDocument | null = null;
    let normalizedMarkdown: string | null = null;
    if (isV3 && draftPrompt.assessmentDocument) {
      try {
        restoredDocument = parseAssessmentDocument(
          JSON.stringify(draftPrompt.assessmentDocument),
          { allowLegacyPostAnnotations: true },
        );
        normalizedMarkdown = renderAssessmentMarkdown(restoredDocument, draftPrompt.form);
      } catch {
        restoredDocument = null;
      }
    } else if (isV3 && draftPrompt.legacyMarkdown) {
      normalizedMarkdown = normalizeGeneratedQ4Markdown(draftPrompt.legacyMarkdown, draftPrompt.form);
    } else if (!isV3 && draftPrompt.generatedMarkdown) {
      normalizedMarkdown = normalizeGeneratedQ4Markdown(draftPrompt.generatedMarkdown, draftPrompt.form);
    }
    setForm(draftPrompt.form);
    setAssessmentDocument(restoredDocument);
    setGeneratedMarkdown(normalizedMarkdown);
    setValidation(
      normalizedMarkdown
        ? validateGeneratedMarkdown(normalizedMarkdown, draftPrompt.form)
        : null,
    );
    setActiveModuleTab(draftPrompt.activeModuleTab);
    setDraftPrompt(null);
    localStorage.removeItem(KEYS.draftDismissed);
  }, [draftPrompt]);

  const dismissDraft = useCallback(() => {
    setDraftPrompt(null);
    localStorage.setItem(KEYS.draftDismissed, "1");
    writeJson(KEYS.draft, null);
    writeJson(KEYS.legacyDraft, null);
  }, []);

  const runGenerate = useCallback(async () => {
    if (!canGenerate) return;
    if (!hasSelectedModelKey) {
      setSettingsOpen(true);
      setError(
        selectedModelProvider === "openai"
          ? "請填寫 OpenAI API Key，或改選免費模型。"
          : selectedModelProvider === "xai"
            ? "請填寫 Grok API Key，或改選免費模型。"
            : "請填寫 Gemini API Key，或改選免費模型。",
      );
      return;
    }
    setGenerating(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    setError(null);
    setValidation(null);
    setGenerationProgress({ phase: "connecting", receivedChars: 0, completedSections: [] });
    const startedAt = performance.now();
    let firstDeltaMs: number | null = null;
    try {
      const result = await generateAssessment({
        form,
        indicator,
        pdfExcerpt: pdfExcerpt || undefined,
        model: settings.model,
        geminiKey: settings.geminiKey,
        openaiKey: settings.openaiKey,
        xaiKey: settings.xaiKey,
        onProgress: (progress) => {
          if (progress.receivedChars > 0 && firstDeltaMs === null) {
            firstDeltaMs = performance.now() - startedAt;
          }
          setGenerationProgress(progress);
        },
      });

      setValidation(result.validation);
      setAssessmentDocument(result.document);
      setGeneratedMarkdown(result.markdown);
      setActiveModuleTab(0);
      if (import.meta.env.DEV) {
        console.info("[assessment-performance]", {
          firstDeltaMs: firstDeltaMs === null ? null : Math.round(firstDeltaMs),
          totalMs: Math.round(performance.now() - startedAt),
          outputChars: result.outputChars,
          repairUsed: result.repairUsed,
          validationOk: result.validation.ok,
          validationErrors: result.validation.errors.length,
        });
      }
      if (window.innerWidth < 1024) setSidebarOpen(false);
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  }, [canGenerate, hasSelectedModelKey, selectedModelProvider, form, indicator, pdfExcerpt, settings]);

  const runIdeation = useCallback(async () => {
    if (!form.activityName.trim()) return;
    if (!hasSelectedModelKey) {
      setSettingsOpen(true);
      setIdeationNotice(
        selectedModelProvider === "openai"
          ? "請填寫 OpenAI API Key，或改選免費模型。"
          : selectedModelProvider === "xai"
            ? "請填寫 Grok API Key，或改選免費模型。"
            : "請填寫 Gemini API Key，或改選免費模型。",
      );
      return;
    }
    setIdeating(true);
    setError(null);
    setIdeationNotice(null);
    try {
      const data = await generateIdeationJson(
        buildIdeationPrompt(form),
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
      );
      setIdeation({ ...data, model: settings.model });
    } catch (err) {
      const message = toUserErrorMessage(err);
      setIdeation({
        lifeKeywords: ["保存方式爭論", "飲料久放變化", "窗邊與冷藏對照", "氣味與外觀判斷"],
        tools: ["手機計時", "照片對照", "共享表格", "同儕討論紀錄"],
        model: "local-fallback",
      });
      setIdeationNotice(
        message.includes("金鑰") || message.includes("API")
          ? `無 API 金鑰或金鑰無效，已改用本機備援關鍵字。`
          : message.includes("模型") || message.includes("model")
            ? `模型錯誤，已改用本機備援關鍵字。`
            : `AI 連線失敗，已改用本機備援關鍵字。`,
      );
    } finally {
      setIdeating(false);
    }
  }, [form, hasSelectedModelKey, selectedModelProvider, settings]);

  const runRefine = useCallback(async () => {
    if (!refineTarget || !assessmentDocument || !refineInstruction.trim()) return;
    setRefining(true);
    setError(null);
    try {
      const target: AssessmentTarget = refineTarget.type === "progression"
        ? "narrative"
        : refineTarget.type === "scenario"
          ? (refineTarget.id === "課前" ? "pre.scenario" : "post.scenario")
          : `${activeModuleTab === 1 ? "pre" : "post"}.${refineTarget.id.toLowerCase().replace(/[^q1-4]/g, "")}` as AssessmentTarget;
      if (refineTarget.type === "question" && activeModuleTab === 0) {
        throw new Error("無法判斷題目所屬模組，請切換至課前或課後分頁後再微調。");
      }
      const targets = [target];
      const source = selectAssessmentPatchSource(assessmentDocument, targets);
      const raw = await generateContent(
        buildStructuredRefinePrompt(source, target, refineInstruction.trim(), form),
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
        {
          structured: {
            name: "npdl_assessment_patch",
            schema: buildAssessmentPatchSchema(targets),
          },
        },
      );
      const patch = parseAssessmentPatch(raw, targets);
      const updatedDocument = mergeAssessmentPatch(assessmentDocument, patch, targets);
      const updated = renderAssessmentMarkdown(updatedDocument, form);
      setAssessmentDocument(updatedDocument);
      setGeneratedMarkdown(updated);
      setValidation(validateGeneratedMarkdown(updated, form));
      setHighlightKey(`${refineTarget.type}-${refineTarget.id}-${Date.now()}`);
      setRefineTarget(null);
      setRefineInstruction("");
    } catch (err) {
      setError(toUserErrorMessage(err));
    } finally {
      setRefining(false);
    }
  }, [refineTarget, assessmentDocument, refineInstruction, activeModuleTab, settings, form]);

  const testConnection = useCallback(async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const prompt = buildConnectionTestPrompt();
      const result = await generateContent(
        prompt,
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
      );
      setConnectionStatus(result.includes("好") ? "連線成功" : `已回應：${result.slice(0, 20)}`);
    } catch (err) {
      setConnectionStatus(toUserErrorMessage(err));
    } finally {
      setTestingConnection(false);
    }
  }, [settings]);

  const saveQuestion = useCallback((question: SavedQuestion) => {
    setBank((prev) => [question, ...prev.filter((q) => q.id !== question.id)]);
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setBank((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const appendKeyword = useCallback((field: "lifeKeywords" | "tools", value: string) => {
    setForm((prev) => {
      const current = prev[field].trim();
      if (!current) return { ...prev, [field]: value };
      if (current.split(/[、,，]/).some((part) => part.trim() === value)) return prev;
      return { ...prev, [field]: `${current}、${value}` };
    });
  }, []);

  return {
    form,
    updateForm,
    indicator,
    generatedMarkdown,
    assessmentDocument,
    canRefine: Boolean(assessmentDocument),
    modules,
    activeModuleTab,
    setActiveModuleTab,
    previewDevice,
    setPreviewDevice,
    sidebarOpen,
    setSidebarOpen,
    mobileStep,
    setMobileStep,
    generating,
    error,
    setError,
    settingsOpen,
    setSettingsOpen,
    bankOpen,
    setBankOpen,
    refineTarget,
    setRefineTarget,
    refineInstruction,
    setRefineInstruction,
    refining,
    highlightKey,
    pdfExcerpt,
    setPdfExcerpt,
    pdfName,
    setPdfName,
    ideation,
    ideating,
    ideationNotice,
    runIdeation,
    draftPrompt,
    restoreDraft,
    dismissDraft,
    settings,
    googleClientIdManaged: Boolean(MANAGED_GOOGLE_OAUTH_CLIENT_ID),
    setSettings,
    bank,
    saveQuestion,
    removeQuestion,
    hasIndicator,
    hasActivity,
    hasContext,
    canGenerate,
    hasAnyKey,
    hasSelectedModelKey,
    runGenerate,
    runRefine,
    testConnection,
    connectionStatus,
    testingConnection,
    validation,
    generationProgress,
    setValidation,
    appendKeyword,
    selectedModelProvider,
  };
}
