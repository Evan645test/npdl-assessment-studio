import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_FORM } from "@/data/constants";
import { getIndicatorById } from "@/data/indicators";
import {
  generateAssessment,
  type AssessmentRepairStatus,
} from "@/lib/assessment-generation";
import {
  buildAssessmentPatchSchema,
  mergeAssessmentPatch,
  parseAssessmentDocument,
  parseAssessmentPatch,
  renderAssessmentMarkdown,
  selectAssessmentPatchSource,
} from "@/lib/assessment-document";
import { normalizeAssessmentQuestionStems } from "@/lib/question-contracts";
import { normalizeGeneratedQ4Markdown } from "@/lib/q4-guidance";
import { generateContent, generateIdeationJson, getModelProvider } from "@/lib/ai/client";
import {
  buildCourseIdeationHandoff,
  courseIdeationHandoffToForm,
  isValidCourseIdeationHandoff,
} from "@/lib/course-ideation";
import {
  buildAssessmentDesignContext,
  isValidLearningDesignProject,
} from "@/lib/learning-design";
import { toUserErrorMessage } from "@/lib/errors";
import { splitModules } from "@/lib/markdown";
import {
  buildConnectionTestPrompt,
  buildIdeationPrompt,
  buildStructuredRefinePrompt,
} from "@/prompts";
import { validateGeneratedMarkdown, type ValidationResult } from "@/lib/validate-output";
import { KEYS, readJson, removeStorage, writeJson, writeStorage } from "@/lib/storage";
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
import type {
  AssessmentDesignContext,
  CourseIdeationHandoff,
  LearningDesignProjectV1,
} from "@/types/course-ideation";
import {
  SHARED_AI_DEFAULT_MODEL,
  SHARED_AI_MODEL_OPTIONS,
} from "@/hooks/useSharedAiSettings";
import type { SharedAiSettings } from "@/types/studio";

const MANAGED_GOOGLE_OAUTH_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

function readSettings() {
  const model = readJson<string | null>(KEYS.model, null);
  const allowed = SHARED_AI_MODEL_OPTIONS.map((entry) => entry.value);
  return {
    geminiKey: localStorage.getItem(KEYS.geminiKey) ?? "",
    openaiKey: localStorage.getItem(KEYS.openaiKey) ?? "",
    xaiKey: localStorage.getItem(KEYS.xaiKey) ?? "",
    googleClientId:
      MANAGED_GOOGLE_OAUTH_CLIENT_ID
      || localStorage.getItem(KEYS.googleOAuthClientId)
      || "",
    model:
      model && allowed.includes(model as (typeof allowed)[number])
        ? model
        : SHARED_AI_DEFAULT_MODEL,
  };
}

interface UseAppStateOptions {
  aiSettings?: SharedAiSettings;
  onOpenAiSettings?: () => void;
}

export function useAppState(options: UseAppStateOptions = {}) {
  const [form, setForm] = useState<CourseForm>(DEFAULT_FORM);
  const [assessmentDocument, setAssessmentDocument] = useState<AssessmentDocument | null>(null);
  const [assessmentDesignContext, setAssessmentDesignContext] =
    useState<AssessmentDesignContext | null>(null);
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
  const [localSettings, setSettings] = useState(readSettings);
  const settings = options.aiSettings
    ? { ...localSettings, ...options.aiSettings }
    : localSettings;
  const [bank, setBank] = useState<SavedQuestion[]>(() =>
    readJson<SavedQuestion[]>(KEYS.questionBank, []),
  );
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [repairStatus, setRepairStatus] = useState<AssessmentRepairStatus | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);

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
    if (!options.aiSettings) {
      writeStorage(KEYS.geminiKey, localSettings.geminiKey);
      writeStorage(KEYS.openaiKey, localSettings.openaiKey);
      writeStorage(KEYS.xaiKey, localSettings.xaiKey);
      writeJson(KEYS.model, localSettings.model);
    }
    writeStorage(KEYS.googleOAuthClientId, localSettings.googleClientId);
  }, [localSettings, options.aiSettings]);

  useEffect(() => {
    setConnectionStatus(null);
  }, [settings.model, settings.geminiKey, settings.openaiKey, settings.xaiKey]);

  useEffect(() => {
    writeJson(KEYS.questionBank, bank);
  }, [bank]);

  const applyLearningDesignProject = useCallback(
    (project: LearningDesignProjectV1) => {
      if (!isValidLearningDesignProject(project) || !project.alignment) {
        throw new Error("課程設計專案不完整，無法帶入評量設計。");
      }
      const designContext = buildAssessmentDesignContext(project);
      if (!designContext) {
        throw new Error("請先確認學習終點與評量證據，再帶入評量設計。");
      }
      const handoff = buildCourseIdeationHandoff(
        project.input,
        project.alignment,
        project.selectedIndicatorId,
        project.id,
      );
      writeJson(KEYS.learningDesignProject, project);
      setForm(courseIdeationHandoffToForm(handoff));
      setAssessmentDesignContext(designContext);
      setAssessmentDocument(null);
      setGeneratedMarkdown(null);
      setValidation(null);
      setRepairStatus(null);
      setGenerationProgress(null);
      setActiveModuleTab(0);
      setMobileStep(2);
      setRefineTarget(null);
      setRefineInstruction("");
      setHighlightKey(null);
      setPdfExcerpt("");
      setPdfName("");
      setIdeation(null);
      setIdeationNotice(null);
      setDraftPrompt(null);
      setHandoffNotice("已帶入課程設計專案，可直接產生對齊的正式評量。");
      localStorage.removeItem(KEYS.draftDismissed);
      removeStorage(KEYS.courseIdeationHandoff);
      setDraftStorageReady(true);
    },
    [],
  );

  useEffect(() => {
    if (!draftStorageReady) return;
    if (!form.activityName && !generatedMarkdown) return;
    const draft: DraftState = {
      form,
      assessmentDocument,
      assessmentDesignContext,
      legacyMarkdown: assessmentDocument ? undefined : generatedMarkdown,
      activeModuleTab,
      savedAt: Date.now(),
    };
    writeJson(KEYS.draft, draft);
  }, [
    form,
    assessmentDocument,
    assessmentDesignContext,
    activeModuleTab,
    draftStorageReady,
  ]);

  useEffect(() => {
    const handoff = readJson<CourseIdeationHandoff | null>(
      KEYS.courseIdeationHandoff,
      null,
    );
    if (isValidCourseIdeationHandoff(handoff)) {
      setForm(courseIdeationHandoffToForm(handoff));
      if (handoff.version === 2) {
        const project = readJson<LearningDesignProjectV1 | null>(
          KEYS.learningDesignProject,
          null,
        );
        if (
          isValidLearningDesignProject(project) &&
          project.id === handoff.projectId
        ) {
          const context = buildAssessmentDesignContext(project);
          if (context) setAssessmentDesignContext(context);
        }
      }
      setMobileStep(2);
      setDraftPrompt(null);
      setHandoffNotice("已帶入課程發想結果，請確認推薦子向度後再生成評量。");
      removeStorage(KEYS.courseIdeationHandoff);
      setDraftStorageReady(true);
      return;
    }
    if (handoff) removeStorage(KEYS.courseIdeationHandoff);
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
        restoredDocument = normalizeAssessmentQuestionStems(
          parseAssessmentDocument(
            JSON.stringify(draftPrompt.assessmentDocument),
            { allowLegacyPostAnnotations: true },
          ),
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
    setAssessmentDesignContext(
      "assessmentDesignContext" in draftPrompt
        ? draftPrompt.assessmentDesignContext ?? null
        : null,
    );
    setAssessmentDocument(restoredDocument);
    setGeneratedMarkdown(normalizedMarkdown);
    setValidation(
      normalizedMarkdown
        ? validateGeneratedMarkdown(normalizedMarkdown, draftPrompt.form)
        : null,
    );
    setRepairStatus(normalizedMarkdown ? "not_needed" : null);
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
      options.onOpenAiSettings?.();
      setError(
        selectedModelProvider === "openai"
          ? "請填寫 OpenAI API Key。"
          : selectedModelProvider === "xai"
            ? "請填寫 Grok API Key。"
            : "請填寫 Gemini API Key。",
      );
      return;
    }
    setGenerating(true);
    if (window.innerWidth < 1024) setSidebarOpen(false);
    setError(null);
    setValidation(null);
    setRepairStatus(null);
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
        designContext: assessmentDesignContext,
        onProgress: (progress) => {
          if (progress.receivedChars > 0 && firstDeltaMs === null) {
            firstDeltaMs = performance.now() - startedAt;
          }
          setGenerationProgress(progress);
        },
      });

      setValidation(result.validation);
      setRepairStatus(result.repairStatus);
      setAssessmentDocument(result.document);
      setGeneratedMarkdown(result.markdown);
      setActiveModuleTab(0);
      if (assessmentDesignContext?.projectId) {
        const project = readJson<LearningDesignProjectV1 | null>(
          KEYS.learningDesignProject,
          null,
        );
        if (
          isValidLearningDesignProject(project) &&
          project.id === assessmentDesignContext.projectId &&
          project.evidencePlan
        ) {
          writeJson(KEYS.learningDesignProject, {
            ...project,
            updatedAt: Date.now(),
            evidencePlan: {
              ...project.evidencePlan,
              assessmentDocument: result.document,
            },
          });
        }
      }
      if (import.meta.env.DEV) {
        console.info("[assessment-performance]", {
          firstDeltaMs: firstDeltaMs === null ? null : Math.round(firstDeltaMs),
          totalMs: Math.round(performance.now() - startedAt),
          outputChars: result.outputChars,
          repairUsed: result.repairUsed,
          repairStatus: result.repairStatus,
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
  }, [
    canGenerate,
    hasSelectedModelKey,
    selectedModelProvider,
    form,
    indicator,
    pdfExcerpt,
    settings,
    assessmentDesignContext,
    options.onOpenAiSettings,
  ]);

  const runIdeation = useCallback(async () => {
    if (!form.activityName.trim()) return;
    if (!hasSelectedModelKey) {
      options.onOpenAiSettings?.();
      setIdeationNotice(
        selectedModelProvider === "openai"
          ? "請填寫 OpenAI API Key。"
          : selectedModelProvider === "xai"
            ? "請填寫 Grok API Key。"
            : "請填寫 Gemini API Key。",
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
  }, [
    form,
    hasSelectedModelKey,
    options.onOpenAiSettings,
    selectedModelProvider,
    settings,
  ]);

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
      const updatedDocument = normalizeAssessmentQuestionStems(
        mergeAssessmentPatch(assessmentDocument, patch, targets),
      );
      const updated = renderAssessmentMarkdown(updatedDocument, form);
      setAssessmentDocument(updatedDocument);
      setGeneratedMarkdown(updated);
      setValidation(validateGeneratedMarkdown(updated, form));
      setRepairStatus("not_needed");
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
    repairStatus,
    generationProgress,
    setValidation,
    appendKeyword,
    selectedModelProvider,
    handoffNotice,
    dismissHandoffNotice: () => setHandoffNotice(null),
    applyLearningDesignProject,
  };
}
