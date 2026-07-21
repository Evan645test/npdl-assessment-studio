import { useCallback, useEffect, useMemo, useState } from "react";
import { DEFAULT_FORM } from "@/data/constants";
import { getIndicatorById } from "@/data/indicators";
import {
  generatePostAssessment,
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
import {
  isCourseAssessmentSeedCurrent,
  renderCourseAssessmentSeedMarkdown,
} from "@/lib/course-assessment";

import {
  readStoredGoogleOAuthClientId,
  resolveGoogleOAuthClientId,
} from "@/lib/google-oauth-config";
import { useGoogleOAuthClientId } from "@/hooks/useGoogleOAuthClientId";

function readSettings() {
  const model = readJson<string | null>(KEYS.model, null);
  const allowed = SHARED_AI_MODEL_OPTIONS.map((entry) => entry.value);
  return {
    geminiKey: localStorage.getItem(KEYS.geminiKey) ?? "",
    openaiKey: localStorage.getItem(KEYS.openaiKey) ?? "",
    xaiKey: localStorage.getItem(KEYS.xaiKey) ?? "",
    googleClientId: resolveGoogleOAuthClientId(readStoredGoogleOAuthClientId()),
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
  const googleOAuth = useGoogleOAuthClientId();
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
    ? { ...localSettings, ...options.aiSettings, googleClientId: googleOAuth.clientId }
    : { ...localSettings, googleClientId: googleOAuth.clientId };
  const [bank, setBank] = useState<SavedQuestion[]>(() =>
    readJson<SavedQuestion[]>(KEYS.questionBank, []),
  );
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [repairStatus, setRepairStatus] = useState<AssessmentRepairStatus | null>(null);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [handoffNotice, setHandoffNotice] = useState<string | null>(null);
  const [implementationNotes, setImplementationNotes] = useState("");
  const [pendingProjectUpdate, setPendingProjectUpdate] =
    useState<LearningDesignProjectV1 | null>(null);

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
    if (!googleOAuth.managed) {
      writeStorage(KEYS.googleOAuthClientId, localSettings.googleClientId);
    }
  }, [googleOAuth.managed, localSettings, options.aiSettings]);

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
      if (
        !isCourseAssessmentSeedCurrent(
          designContext.courseAssessmentSeed,
          designContext.assessmentSeedSourceFingerprint ??
            designContext.sourceFingerprint,
        )
      ) {
        throw new Error(
          "課程敘述語或診斷題組尚未建立，或已因上游修改而過期。",
        );
      }
      if (
        !project.unitBlueprint ||
        !project.unitBlueprintConfirmedAt ||
        project.alignmentAudit.unitBlueprint !== "current"
      ) {
        throw new Error("請先完成最新的單元節次藍圖，再帶入評量設計。");
      }
      const handoff = buildCourseIdeationHandoff(
        project.input,
        project.alignment,
        project.selectedIndicatorId,
        project.id,
      );
      const nextForm = courseIdeationHandoffToForm(handoff);
      if (
        assessmentDocument &&
        assessmentDesignContext?.projectId === project.id &&
        assessmentDesignContext.sourceFingerprint !==
          designContext.sourceFingerprint
      ) {
        setPendingProjectUpdate(project);
        setHandoffNotice(
          "課程端已有更新；目前課後評量尚未覆蓋。請確認後再套用新版課程資料。",
        );
        return;
      }
      writeJson(KEYS.learningDesignProject, project);
      setForm(nextForm);
      setAssessmentDesignContext(designContext);
      setAssessmentDocument(null);
      setGeneratedMarkdown(
        renderCourseAssessmentSeedMarkdown(
          designContext.courseAssessmentSeed,
          nextForm,
        ),
      );
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
      setImplementationNotes("");
      setPendingProjectUpdate(null);
      setDraftPrompt(null);
      setHandoffNotice(
        "已唯讀帶入課程敘述語與診斷題組；課後將沿用課前架構，可填設計差異後改寫課後評量。",
      );
      localStorage.removeItem(KEYS.draftDismissed);
      removeStorage(KEYS.courseIdeationHandoff);
      setDraftStorageReady(true);
    },
    [assessmentDesignContext, assessmentDocument],
  );

  const acceptPendingProjectUpdate = useCallback(() => {
    if (!pendingProjectUpdate || !pendingProjectUpdate.alignment) return;
    const designContext = buildAssessmentDesignContext(pendingProjectUpdate);
    if (
      !designContext ||
      !isCourseAssessmentSeedCurrent(
        designContext.courseAssessmentSeed,
        designContext.assessmentSeedSourceFingerprint ??
          designContext.sourceFingerprint,
      )
    ) {
      setError("更新後的課程端診斷題組資料不完整或已過期。");
      return;
    }
    const handoff = buildCourseIdeationHandoff(
      pendingProjectUpdate.input,
      pendingProjectUpdate.alignment,
      pendingProjectUpdate.selectedIndicatorId,
      pendingProjectUpdate.id,
    );
    const nextForm = courseIdeationHandoffToForm(handoff);
    writeJson(KEYS.learningDesignProject, pendingProjectUpdate);
    setForm(nextForm);
    setAssessmentDesignContext(designContext);
    setAssessmentDocument(null);
    setGeneratedMarkdown(
      renderCourseAssessmentSeedMarkdown(
        designContext.courseAssessmentSeed,
        nextForm,
      ),
    );
    setValidation(null);
    setRepairStatus(null);
    setActiveModuleTab(0);
    setImplementationNotes("");
    setPendingProjectUpdate(null);
    setHandoffNotice(
      "已套用新版課程資料；原課後評量已清除，請重新產生。",
    );
  }, [pendingProjectUpdate]);

  const keepCurrentAssessment = useCallback(() => {
    setPendingProjectUpdate(null);
    setHandoffNotice("已保留目前課後評量；課程端更新尚未套用。");
  }, []);

  useEffect(() => {
    if (!draftStorageReady) return;
    if (!form.activityName && !generatedMarkdown) return;
    const draft: DraftState = {
      form,
      assessmentDocument,
      assessmentDesignContext,
      implementationNotes,
      legacyMarkdown: assessmentDocument ? undefined : generatedMarkdown,
      activeModuleTab,
      savedAt: Date.now(),
    };
    writeJson(KEYS.draft, draft);
  }, [
    form,
    assessmentDocument,
    assessmentDesignContext,
    implementationNotes,
    activeModuleTab,
    draftStorageReady,
  ]);

  useEffect(() => {
    const handoff = readJson<CourseIdeationHandoff | null>(
      KEYS.courseIdeationHandoff,
      null,
    );
    if (isValidCourseIdeationHandoff(handoff)) {
      const nextForm = courseIdeationHandoffToForm(handoff);
      setForm(nextForm);
      let importedCurrentSeed = false;
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
          if (context) {
            setAssessmentDesignContext(context);
            if (
              isCourseAssessmentSeedCurrent(
                context.courseAssessmentSeed,
                context.assessmentSeedSourceFingerprint ??
                  context.sourceFingerprint,
              )
            ) {
              setAssessmentDocument(null);
              setGeneratedMarkdown(
                renderCourseAssessmentSeedMarkdown(
                  context.courseAssessmentSeed,
                  nextForm,
                ),
              );
              importedCurrentSeed = true;
            }
          }
        }
      }
      setMobileStep(2);
      setDraftPrompt(null);
      setHandoffNotice(
        importedCurrentSeed
          ? "已唯讀帶入課程敘述語與診斷題組；課後將沿用課前架構，可填設計差異後改寫課後評量。"
          : "已帶入課程發想結果，請確認推薦子向度後再生成評量。",
      );
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
    setImplementationNotes(
      "implementationNotes" in draftPrompt
        ? draftPrompt.implementationNotes ?? ""
        : "",
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
      const progress = (next: GenerationProgress) => {
        if (next.receivedChars > 0 && firstDeltaMs === null) {
          firstDeltaMs = performance.now() - startedAt;
        }
        setGenerationProgress(next);
      };
      if (!assessmentDesignContext?.courseAssessmentSeed) {
        throw new Error(
          "請先在課程流程完成診斷題組後，再產生課後評量。獨立整包評量路徑已停用。",
        );
      }
      const result = await generatePostAssessment({
              form,
              indicator,
              model: settings.model,
              geminiKey: settings.geminiKey,
              openaiKey: settings.openaiKey,
              xaiKey: settings.xaiKey,
              designContext: assessmentDesignContext,
              implementationNotes,
              onProgress: progress,
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
    implementationNotes,
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
          ? (refineTarget.id === "診斷題組" ? "pre.scenario" : "post.scenario")
          : `${activeModuleTab === 1 ? "pre" : "post"}.${refineTarget.id.toLowerCase().replace(/[^q1-4]/g, "")}` as AssessmentTarget;
      if (refineTarget.type === "question" && activeModuleTab === 0) {
        throw new Error("無法判斷題目所屬模組，請切換至診斷或遷移題組分頁後再微調。");
      }
      if (
        assessmentDesignContext?.courseAssessmentSeed &&
        !target.startsWith("post.")
      ) {
        throw new Error(
          "課程敘述語與診斷題組由課程端管理；請回課程設計工作區修改。",
        );
      }
      const targets = [target];
      const source = selectAssessmentPatchSource(assessmentDocument, targets);
      const raw = await generateContent(
        buildStructuredRefinePrompt(
          source,
          target,
          refineInstruction.trim(),
          form,
          assessmentDesignContext,
        ),
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
  }, [
    refineTarget,
    assessmentDocument,
    refineInstruction,
    activeModuleTab,
    settings,
    form,
    assessmentDesignContext,
  ]);

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
    assessmentDesignContext,
    courseAlignedMode: Boolean(
      assessmentDesignContext?.courseAssessmentSeed,
    ),
    implementationNotes,
    setImplementationNotes,
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
    googleClientIdManaged: googleOAuth.managed,
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
    pendingProjectUpdate,
    acceptPendingProjectUpdate,
    keepCurrentAssessment,
    dismissHandoffNotice: () => setHandoffNotice(null),
    applyLearningDesignProject,
  };
}
