import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { OutputWorkspace } from "@/features/output/OutputWorkspace";
import { GoogleFormsSettingsModal } from "@/features/settings/GoogleFormsSettingsModal";
import { getIndicatorById } from "@/data/indicators";
import { generatePostAssessment } from "@/lib/assessment-generation";
import {
  isCourseAssessmentSeedCurrent,
  renderCourseAssessmentSeedMarkdown,
} from "@/lib/course-assessment";
import { renderAssessmentMarkdown } from "@/lib/assessment-document";
import { toUserErrorMessage } from "@/lib/errors";
import { getModelProvider } from "@/lib/ai/client";
import { splitModules } from "@/lib/markdown";
import { KEYS, readJson, writeJson } from "@/lib/storage";
import { isValidLearningDesignProject } from "@/lib/learning-design";
import { useGoogleOAuthClientId } from "@/hooks/useGoogleOAuthClientId";
import type {
  AssessmentDocument,
  CourseForm,
  GenerationProgress,
  ModuleTab,
  SavedQuestion,
} from "@/types";
import type {
  AssessmentDesignContext,
  LearningDesignProjectV1,
} from "@/types/course-ideation";
import type { SharedAiSettings } from "@/types/studio";
import type { ValidationResult } from "@/lib/validate-output";

export interface CoursePostAssessmentPanelProps {
  project: LearningDesignProjectV1;
  designContext: AssessmentDesignContext | null;
  form: CourseForm | null;
  aiSettings: SharedAiSettings;
  onOpenAiSettings: () => void;
  ready: boolean;
}

export function CoursePostAssessmentPanel({
  project,
  designContext,
  form,
  aiSettings,
  onOpenAiSettings,
  ready,
}: CoursePostAssessmentPanelProps) {
  const googleOAuth = useGoogleOAuthClientId();
  const [implementationNotes, setImplementationNotes] = useState("");
  const [assessmentDocument, setAssessmentDocument] =
    useState<AssessmentDocument | null>(
      project.evidencePlan?.assessmentDocument ?? null,
    );
  const [generatedMarkdown, setGeneratedMarkdown] = useState<string | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] =
    useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [activeModuleTab, setActiveModuleTab] = useState<ModuleTab>(2);
  const [bank, setBank] = useState<SavedQuestion[]>(() =>
    readJson<SavedQuestion[]>(KEYS.questionBank, []),
  );
  const [googleFormsSettingsOpen, setGoogleFormsSettingsOpen] = useState(false);

  const seed = designContext?.courseAssessmentSeed ?? null;
  const indicator = useMemo(() => {
    if (!form || form.source !== "資料庫") return null;
    return getIndicatorById(form.indicatorId) ?? null;
  }, [form]);
  const indicatorName =
    form?.source === "自訂"
      ? form.customIndicator
      : indicator?.name ?? form?.indicatorId ?? "";

  const seedCurrent = Boolean(
    seed &&
      designContext &&
      isCourseAssessmentSeedCurrent(
        seed,
        designContext.assessmentSeedSourceFingerprint ??
          designContext.sourceFingerprint,
      ),
  );

  useEffect(() => {
    if (!form || !seed) {
      setGeneratedMarkdown(null);
      return;
    }
    if (assessmentDocument) {
      setGeneratedMarkdown(renderAssessmentMarkdown(assessmentDocument, form));
      return;
    }
    setGeneratedMarkdown(renderCourseAssessmentSeedMarkdown(seed, form));
  }, [assessmentDocument, form, seed]);

  useEffect(() => {
    setAssessmentDocument(project.evidencePlan?.assessmentDocument ?? null);
  }, [project.evidencePlan?.assessmentDocument, project.id, project.updatedAt]);

  const modules = useMemo(
    () => splitModules(generatedMarkdown),
    [generatedMarkdown],
  );

  const selectedModelProvider = getModelProvider(aiSettings.model);
  const hasSelectedModelKey =
    selectedModelProvider === "free" ||
    (selectedModelProvider === "openai" &&
      Boolean(aiSettings.openaiKey.trim())) ||
    (selectedModelProvider === "xai" && Boolean(aiSettings.xaiKey.trim())) ||
    (selectedModelProvider === "gemini" &&
      Boolean(aiSettings.geminiKey.trim()));

  const canGenerate =
    ready &&
    seedCurrent &&
    Boolean(form) &&
    Boolean(designContext?.courseAssessmentSeed) &&
    hasSelectedModelKey &&
    !generating;

  const runGenerate = useCallback(async () => {
    if (!form || !designContext?.courseAssessmentSeed) {
      setError("請先完成課程敘述語與診斷題組，再產生課後評量。");
      return;
    }
    if (!hasSelectedModelKey) {
      setError("請先設定目前模型的 API Key。");
      onOpenAiSettings();
      return;
    }
    if (!seedCurrent) {
      setError("診斷題組已過期，請回到「診斷題組」重新產生後再繼續。");
      return;
    }
    setGenerating(true);
    setError(null);
    setValidation(null);
    setGenerationProgress({
      phase: "connecting",
      receivedChars: 0,
      completedSections: [],
    });
    try {
      const result = await generatePostAssessment({
        form,
        indicator,
        model: aiSettings.model,
        geminiKey: aiSettings.geminiKey,
        openaiKey: aiSettings.openaiKey,
        xaiKey: aiSettings.xaiKey,
        designContext,
        implementationNotes,
        onProgress: setGenerationProgress,
      });
      setValidation(result.validation);
      setAssessmentDocument(result.document);
      setGeneratedMarkdown(result.markdown);
      setActiveModuleTab(2);
      const stored = readJson<LearningDesignProjectV1 | null>(
        KEYS.learningDesignProject,
        null,
      );
      if (
        isValidLearningDesignProject(stored) &&
        stored.id === project.id &&
        stored.evidencePlan
      ) {
        writeJson(KEYS.learningDesignProject, {
          ...stored,
          updatedAt: Date.now(),
          evidencePlan: {
            ...stored.evidencePlan,
            assessmentDocument: result.document,
          },
        });
      }
    } catch (caught) {
      setError(toUserErrorMessage(caught));
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  }, [
    aiSettings,
    designContext,
    form,
    hasSelectedModelKey,
    implementationNotes,
    indicator,
    onOpenAiSettings,
    project.id,
    seedCurrent,
  ]);

  const saveQuestion = useCallback((question: SavedQuestion) => {
    setBank((current) => {
      const next = [
        question,
        ...current.filter((entry) => entry.id !== question.id),
      ].slice(0, 200);
      writeJson(KEYS.questionBank, next);
      return next;
    });
  }, []);

  if (!ready || !form || !designContext || !seed) {
    return (
      <section className="rounded-2xl border border-dashed border-[#b9ccc2] bg-white/70 p-8 text-center">
        <h2 className="text-xl font-black text-[#173f36]">課後評量尚未開放</h2>
        <p className="mt-2 text-sm font-medium leading-7 text-zinc-600">
          請先確認學習終點、評量證據、診斷題組與節次藍圖，再進入課後遷移與匯出。
        </p>
      </section>
    );
  }

  const generateLabel = generating
    ? implementationNotes.trim()
      ? "正在依設計差異改寫課後…"
      : "正在產生課後評量…"
    : implementationNotes.trim()
      ? assessmentDocument
        ? "依設計差異重新改寫課後評量"
        : "依設計差異改寫課後評量"
      : assessmentDocument
        ? "重新產生課後評量"
        : "產生課後評量";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-5 shadow-sm sm:p-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">
          單一流程 · 課後
        </p>
        <h2 className="mt-1 text-xl font-black text-cyan-950">
          課後遷移與匯出
        </h2>
        <p className="mt-1 text-xs font-bold leading-6 text-cyan-900/80">
          課前敘述語與診斷題組已由上游唯讀帶入。課後會緊扣 plannedPostMappings；可選填設計差異後改寫課後題組。
        </p>
        {!seedCurrent && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800">
            上游學習終點或評量證據已變更，請先回到「診斷題組」重新產生。
          </p>
        )}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-black text-cyan-950">
              設計差異說明（用於改寫課後）
            </span>
            <span className="ml-2 text-[10px] font-bold text-cyan-800">
              選填；未填時依課前架構與 plannedPost 產生
            </span>
            <textarea
              aria-label="設計差異說明（用於改寫課後）"
              value={implementationNotes}
              onChange={(event) =>
                setImplementationNotes(event.target.value.slice(0, 5000))
              }
              rows={3}
              placeholder="例如：第三節因停電改用紙本資料；學生普遍能讀圖，但對因果推論仍不穩定。"
              className="mt-1 w-full resize-y rounded-xl border border-cyan-200 bg-white px-3 py-2 text-xs font-medium leading-6 text-zinc-800 outline-none focus:border-cyan-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void runGenerate()}
            disabled={!canGenerate}
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173f36] px-5 text-sm font-black text-white hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {generating && <Loader2 className="h-4 w-4 animate-spin" />}
            {generateLabel}
          </button>
        </div>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-800"
          >
            {error}
          </p>
        )}
      </section>

      <div className="overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-sm">
        <OutputWorkspace
          modules={modules}
          activeTab={activeModuleTab}
          onTabChange={setActiveModuleTab}
          generating={generating}
          generationProgress={generationProgress}
          hasIndicator={Boolean(indicatorName.trim())}
          hasAnyKey={hasSelectedModelKey}
          indicator={indicator}
          indicatorName={indicatorName}
          form={form}
          googleClientId={googleOAuth.clientId}
          highlightKey={null}
          bank={bank}
          validation={validation}
          assessmentDesignContext={designContext}
          assessmentDocument={assessmentDocument}
          implementationNotes={implementationNotes}
          onSaveQuestion={saveQuestion}
          onOpenAiSettings={onOpenAiSettings}
          onOpenGoogleFormsSettings={() => setGoogleFormsSettingsOpen(true)}
        />
      </div>

      <GoogleFormsSettingsModal
        open={googleFormsSettingsOpen}
        clientId={googleOAuth.clientId}
        managed={googleOAuth.managed}
        onClose={() => setGoogleFormsSettingsOpen(false)}
        onChange={googleOAuth.updateStoredClientId}
      />
    </div>
  );
}
