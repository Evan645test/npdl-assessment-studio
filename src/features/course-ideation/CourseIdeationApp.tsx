import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  ListChecks,
  Loader2,
  Map,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { GRADES, SUBJECT_CHIPS } from "@/data/constants";
import {
  COURSE_IDEATION_EXAMPLES,
  DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
  createCourseIdeationExampleInput,
} from "@/data/course-ideation-examples";
import { getIndicatorById } from "@/data/indicators";
import {
  generateContent,
  type GenerationPromptParts,
} from "@/lib/ai/client";
import {
  buildCourseAlignmentPrompt,
  buildCourseIdeationHandoff,
  buildKeywordAnalysisPrompt,
  CourseIdeationResponseError,
  COURSE_ALIGNMENT_SCHEMA,
  COURSE_IDEATION_RESPONSE_ERROR_MESSAGE,
  KEYWORD_ANALYSIS_SCHEMA,
  normalizeCoreKeywords,
  parseCourseAlignment,
  parseKeywordAnalysis,
  validateCourseIdeationInput,
} from "@/lib/course-ideation";
import {
  createCustomCurriculumEntry,
  CURRICULUM_SNAPSHOT_VERSION,
  getCurriculumCandidates,
  getCurriculumEntry,
} from "@/lib/curriculum";
import {
  COURSE_IDEATION_MODEL_OPTIONS,
  getCourseIdeationProvider,
  resolveCourseIdeationModel,
} from "@/lib/course-ideation-ai";
import {
  buildDesiredResults,
  buildEvidencePlanPrompt,
  buildEvidencePlanRepairPrompt,
  buildUnitPromptPackage,
  buildUnitBlueprintPrompt,
  buildUnitBlueprintRepairPrompt,
  DEFAULT_UNIT_CONSTRAINTS,
  EVIDENCE_PLAN_SCHEMA,
  isValidLearningDesignProject,
  parseEvidencePlan,
  parseUnitBlueprint,
  UNIT_BLUEPRINT_SCHEMA,
  validateUnitConstraints,
  validateEvidencePlanResult,
  validateUnitBlueprintResult,
} from "@/lib/learning-design";
import { toUserErrorMessage } from "@/lib/errors";
import {
  KEYS,
  readJson,
  readStorage,
  removeStorage,
  writeJson,
  writeStorage,
} from "@/lib/storage";
import type {
  CourseAlignmentResult,
  CourseIdeationInput,
  CurriculumEntry,
  CurriculumKind,
  CurriculumSelection,
  DesiredResults,
  EvidencePlanResult,
  EvidenceQuestionMap,
  KeywordAnalysisResult,
  LearningDesignProjectV1,
  LessonPromptPackage,
  LessonPromptStatus,
  UnitBlueprintResult,
  UnitConstraints,
  UnitLessonBlueprint,
  WorkflowState,
} from "@/types/course-ideation";
import { CourseIdeationSettingsModal } from "./CourseIdeationSettingsModal";

interface AiSettings {
  geminiKey: string;
  openaiKey: string;
  xaiKey: string;
  model: string;
}

interface CourseIdeationDraft {
  input: CourseIdeationInput;
  analysis: KeywordAnalysisResult | null;
  alignment: CourseAlignmentResult | null;
  curriculumSelection?: CurriculumSelection | null;
  customCurriculumEntries?: CurriculumEntry[];
  selectedIndicatorId: string;
  projectId?: string;
  projectCreatedAt?: number;
  desiredResults?: DesiredResults | null;
  desiredResultsConfirmedAt?: number | null;
  evidencePlan?: EvidencePlanResult | null;
  evidencePlanConfirmedAt?: number | null;
  unitConstraints?: UnitConstraints;
  unitBlueprint?: UnitBlueprintResult | null;
  unitBlueprintConfirmedAt?: number | null;
  lessonPromptStatus?: LessonPromptStatus[];
  alignmentAudit?: {
    desiredResults: WorkflowState;
    evidencePlan: WorkflowState;
    unitBlueprint: WorkflowState;
  };
  savedAt: number;
}

type AiAction = "analyze" | "align" | "evidence" | "blueprint";

const DEFAULT_INPUT = createCourseIdeationExampleInput(
  DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
);

const CONSENT_VERSION = 2;
const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function readSettings(): AiSettings {
  const savedCourseModel = readJson<string | null>(
    KEYS.courseIdeationModel,
    null,
  );
  const legacySharedModel = readJson<string | null>(KEYS.model, null);
  return {
    geminiKey: readStorage(KEYS.geminiKey) ?? "",
    openaiKey: readStorage(KEYS.openaiKey) ?? "",
    xaiKey: readStorage(KEYS.xaiKey) ?? "",
    model: resolveCourseIdeationModel(savedCourseModel, legacySharedModel),
  };
}

function readDraft(): CourseIdeationDraft | null {
  const draft = readJson<CourseIdeationDraft | null>(
    KEYS.courseIdeationDraft,
    null,
  );
  if (!draft || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) return null;
  if (validateCourseIdeationInput(draft.input).length > 0) return null;
  if (
    draft.alignment &&
    (!draft.alignment.curriculumSelection ||
      !draft.alignment.backwardDesign ||
      !draft.alignment.learningOutcomes?.knowledgeFoundation?.successCriteria)
  ) {
    return {
      ...draft,
      alignment: null,
      curriculumSelection: null,
      selectedIndicatorId: "",
      desiredResults: null,
      desiredResultsConfirmedAt: null,
      evidencePlan: null,
      evidencePlanConfirmedAt: null,
      unitBlueprint: null,
      unitBlueprintConfirmedAt: null,
      lessonPromptStatus: [],
      alignmentAudit: {
        desiredResults: "empty",
        evidencePlan: "empty",
        unitBlueprint: "empty",
      },
    };
  }
  if (
    draft.evidencePlan &&
    (!Array.isArray(draft.evidencePlan.questionMaps) ||
      draft.evidencePlan.questionMaps.length !== 2)
  ) {
    return {
      ...draft,
      evidencePlan: null,
      evidencePlanConfirmedAt: null,
      unitBlueprint: null,
      unitBlueprintConfirmedAt: null,
      lessonPromptStatus: [],
      alignmentAudit: {
        desiredResults: draft.desiredResultsConfirmedAt ? "current" : "empty",
        evidencePlan: "empty",
        unitBlueprint: "empty",
      },
    };
  }
  return draft;
}

function hasSavedConsent(): boolean {
  const consent = readJson<{ version?: number; acceptedAt?: number } | null>(
    KEYS.courseIdeationConsent,
    null,
  );
  return consent?.version === CONSENT_VERSION && typeof consent.acceptedAt === "number";
}

function providerName(model: string): string {
  const provider = getCourseIdeationProvider(model);
  if (provider === "openai") return "OpenAI";
  if (provider === "xai") return "Grok（xAI）";
  return "Gemini";
}

function persistApiKey(key: string, value: string): void {
  if (value) {
    writeStorage(key, value);
  } else {
    removeStorage(key);
  }
}

function promptText(prompt: GenerationPromptParts): string {
  return `${prompt.stable}\n\n${prompt.dynamic}`;
}

function createLocalId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function sameIds(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((id) => right.includes(id))
  );
}

function CriterionCheckboxes({
  criteria,
  selectedIds,
  onToggle,
}: {
  criteria: Array<{ id: string; text: string }>;
  selectedIds: string[];
  onToggle: (criterionId: string, checked: boolean) => void;
}) {
  return (
    <fieldset className="mt-3">
      <legend className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
        對應成功指標
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {criteria.map((criterion) => (
          <label
            key={criterion.id}
            title={criterion.text}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[10px] font-black text-zinc-700"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(criterion.id)}
              onChange={(event) =>
                onToggle(criterion.id, event.target.checked)
              }
              className="accent-amber-700"
            />
            {criterion.id}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ProgressionPanel({ indicatorId }: { indicatorId: string }) {
  const indicator = getIndicatorById(indicatorId);
  if (!indicator) return null;
  const levels = [
    ["證據有限", indicator.levels.evidence_limited],
    ["萌芽", indicator.levels.emerging],
    ["發展", indicator.levels.developing],
    ["精熟", indicator.levels.mastering],
  ] as const;
  return (
    <details className="mt-4 overflow-hidden rounded-xl border border-[#dfe8e2] bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-black text-[#173f36]">
        查看四個學生版學習進程
        <ChevronDown className="h-4 w-4" />
      </summary>
      <div className="grid gap-3 border-t border-[#dfe8e2] bg-[#f7faf8] p-4 md:grid-cols-2">
        {levels.map(([name, text]) => (
          <article key={name} className="rounded-xl border border-[#dfe8e2] bg-white p-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#2f7d68]">
              {name}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm font-medium leading-7 text-zinc-700">
              {text.replaceAll(" / ", "\n")}
            </p>
          </article>
        ))}
      </div>
    </details>
  );
}

interface ConsentModalProps {
  open: boolean;
  provider: string;
  modelLabel: string;
  purpose: string;
  payload: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConsentModal({
  open,
  provider,
  modelLabel,
  purpose,
  payload,
  onCancel,
  onConfirm,
}: ConsentModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-ideation-consent-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl"
          >
            <div className="border-b border-[#dfe8e2] p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 id="course-ideation-consent-title" className="text-lg font-black">
                    首次 AI 資料傳送同意
                  </h2>
                  <p className="mt-1 text-sm font-medium text-zinc-600">
                    確認後，此瀏覽器未來使用課程發想工具時不再逐次詢問；你可隨時撤回。
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7faf8] p-5 custom-scrollbar">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["供應商", provider],
                  ["模型", modelLabel],
                  ["本次用途", purpose],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-[#dfe8e2] bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-black text-zinc-800">{value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-950">
                將傳送課程欄位、核心關鍵字、後續產生的關鍵字分析，以及校準時列入候選的課綱代碼與原文。API Key、學生姓名與本機檔案不會成為生成提示內容。若日後切換供應商，後續資料會送往新選擇的供應商。
              </div>
              <details className="rounded-xl border border-[#dfe8e2] bg-white">
                <summary className="cursor-pointer px-4 py-3 text-sm font-black text-zinc-700">
                  查看本次完整傳送內容
                </summary>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap border-t border-[#dfe8e2] bg-zinc-950 p-4 text-xs leading-6 text-zinc-100 custom-scrollbar">
                  {payload}
                </pre>
              </details>
            </div>
            <div className="grid gap-3 border-t border-[#dfe8e2] bg-white p-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-[#dfe8e2] py-3 text-sm font-black text-zinc-700 hover:bg-[#f7faf8]"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-xl bg-[#173f36] py-3 text-sm font-black text-white hover:bg-[#0f312a]"
              >
                同意並繼續
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PromptPreviewModalProps {
  promptPackage: LessonPromptPackage | null;
  notice: string | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

function PromptPreviewModal({
  promptPackage,
  notice,
  onClose,
  onCopy,
}: PromptPreviewModalProps) {
  return (
    <AnimatePresence>
      {promptPackage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="canvas-prompt-preview-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#dfe8e2] p-5">
              <div>
                <h2 id="canvas-prompt-preview-title" className="text-lg font-black">
                  Gemini Canvas 提示詞預覽
                </h2>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  一份提示詞包含全部節次教案及每節學習單；可直接貼入 Gemini Canvas，或分別建立私人 Gem 與貼入完整單元任務。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="關閉提示詞預覽"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7faf8] p-5 custom-scrollbar">
              {notice && (
                <p
                  role="status"
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-950"
                >
                  {notice}
                </p>
              )}
              {[
                {
                  label: "完整 Canvas 提示詞",
                  copyLabel: "完整提示詞",
                  value: promptPackage.fullPrompt,
                },
                {
                  label: "Gem 固定設定",
                  copyLabel: "Gem 設定",
                  value: promptPackage.gemInstructions,
                },
                {
                  label: "完整單元任務",
                  copyLabel: "完整單元任務",
                  value: promptPackage.lessonTaskPrompt,
                },
              ].map((section) => (
                <section
                  key={section.label}
                  className="overflow-hidden rounded-xl border border-[#dfe8e2] bg-white"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-[#dfe8e2] px-4 py-3">
                    <h3 className="text-sm font-black text-[#173f36]">
                      {section.label}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onCopy(section.value, section.copyLabel)}
                      className="flex items-center gap-1 rounded-lg border border-[#b9ccc2] px-3 py-1.5 text-xs font-black text-[#173f36] hover:bg-emerald-50"
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                      複製
                    </button>
                  </div>
                  <textarea
                    aria-label={section.label}
                    readOnly
                    value={section.value}
                    className="h-56 w-full resize-y bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100 outline-none custom-scrollbar"
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </section>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function CourseIdeationApp() {
  const [initialDraft] = useState(readDraft);
  const [initialStoredProject] = useState(() => {
    const project = readJson<LearningDesignProjectV1 | null>(
      KEYS.learningDesignProject,
      null,
    );
    return isValidLearningDesignProject(project) &&
      project.id === initialDraft?.projectId
      ? project
      : null;
  });
  const [input, setInput] = useState<CourseIdeationInput>(
    initialDraft?.input ?? DEFAULT_INPUT,
  );
  const [analysis, setAnalysis] = useState<KeywordAnalysisResult | null>(
    initialDraft?.analysis ?? null,
  );
  const [alignment, setAlignment] = useState<CourseAlignmentResult | null>(
    initialDraft?.alignment ?? null,
  );
  const [curriculumSelection, setCurriculumSelection] =
    useState<CurriculumSelection | null>(
      initialDraft?.curriculumSelection ??
        initialDraft?.alignment?.curriculumSelection ??
        null,
    );
  const [customCurriculumEntries, setCustomCurriculumEntries] = useState<
    CurriculumEntry[]
  >(initialDraft?.customCurriculumEntries ?? []);
  const [customPerformanceDraft, setCustomPerformanceDraft] = useState("");
  const [customContentDraft, setCustomContentDraft] = useState("");
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(
    initialDraft?.selectedIndicatorId ?? "",
  );
  const [projectId] = useState(
    initialDraft?.projectId ?? `learning-design-${createLocalId()}`,
  );
  const [projectCreatedAt] = useState(
    initialDraft?.projectCreatedAt ?? Date.now(),
  );
  const [desiredResults, setDesiredResults] = useState<DesiredResults | null>(
    initialDraft?.desiredResults ??
      (initialDraft?.alignment
        ? buildDesiredResults(initialDraft.alignment)
        : null),
  );
  const [desiredResultsConfirmedAt, setDesiredResultsConfirmedAt] = useState<
    number | null
  >(initialDraft?.desiredResultsConfirmedAt ?? null);
  const [evidencePlan, setEvidencePlan] = useState<EvidencePlanResult | null>(
    initialStoredProject?.evidencePlan?.questionMaps?.length === 2
      ? initialStoredProject.evidencePlan
      : initialDraft?.evidencePlan ?? null,
  );
  const [evidencePlanConfirmedAt, setEvidencePlanConfirmedAt] = useState<
    number | null
  >(
    initialStoredProject?.evidencePlanConfirmedAt ??
      initialDraft?.evidencePlanConfirmedAt ??
      null,
  );
  const [unitConstraints, setUnitConstraints] = useState<UnitConstraints>(
    initialDraft?.unitConstraints ?? DEFAULT_UNIT_CONSTRAINTS,
  );
  const [unitBlueprint, setUnitBlueprint] =
    useState<UnitBlueprintResult | null>(
      initialDraft?.unitBlueprint ?? null,
    );
  const [unitBlueprintConfirmedAt, setUnitBlueprintConfirmedAt] = useState<
    number | null
  >(
    initialStoredProject?.unitBlueprintConfirmedAt ??
      initialDraft?.unitBlueprintConfirmedAt ??
      null,
  );
  const [lessonPromptStatus, setLessonPromptStatus] = useState<
    LessonPromptStatus[]
  >(initialDraft?.lessonPromptStatus ?? []);
  const [alignmentAudit, setAlignmentAudit] = useState(
    initialDraft?.alignmentAudit ?? {
      desiredResults: initialDraft?.desiredResultsConfirmedAt
        ? ("current" as const)
        : ("empty" as const),
      evidencePlan: initialDraft?.evidencePlan
        ? ("current" as const)
        : ("empty" as const),
      unitBlueprint: initialDraft?.unitBlueprint
        ? ("current" as const)
        : ("empty" as const),
    },
  );
  const [promptPreview, setPromptPreview] =
    useState<LessonPromptPackage | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [busyAction, setBusyAction] = useState<AiAction | null>(null);
  const [pendingAction, setPendingAction] = useState<AiAction | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentGranted, setConsentGranted] = useState(hasSavedConsent);
  const [settings, setSettings] = useState<AiSettings>(readSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);

  const selectedProvider = getCourseIdeationProvider(settings.model);
  const hasModelAccess =
    (selectedProvider === "openai" && Boolean(settings.openaiKey.trim())) ||
    (selectedProvider === "xai" && Boolean(settings.xaiKey.trim())) ||
    (selectedProvider === "gemini" && Boolean(settings.geminiKey.trim()));
  const modelLabel =
    COURSE_IDEATION_MODEL_OPTIONS.find(
      (option) => option.value === settings.model,
    )?.label ??
    settings.model;
  const inputErrors = useMemo(() => validateCourseIdeationInput(input), [input]);
  const curriculumCandidates = useMemo(
    () => getCurriculumCandidates(input, analysis, customCurriculumEntries),
    [analysis, customCurriculumEntries, input],
  );
  const candidatePerformanceIds = new Set(
    curriculumCandidates.performances.map((entry) => entry.id),
  );
  const candidateContentIds = new Set(
    curriculumCandidates.contents.map((entry) => entry.id),
  );
  const curriculumSelectionComplete =
    curriculumSelection !== null &&
    curriculumSelection.performanceIds.length >= 1 &&
    curriculumSelection.performanceIds.length <= 2 &&
    curriculumSelection.contentIds.length >= 1 &&
    curriculumSelection.contentIds.length <= 3 &&
    curriculumSelection.performanceIds.every((id) =>
      candidatePerformanceIds.has(id),
    ) &&
    curriculumSelection.contentIds.every((id) => candidateContentIds.has(id));
  const selectedIndicator = getIndicatorById(selectedIndicatorId);
  const unitConstraintErrors = useMemo(
    () => validateUnitConstraints(unitConstraints),
    [unitConstraints],
  );
  const currentProject = useMemo<LearningDesignProjectV1>(
    () => ({
      version: 1,
      id: projectId,
      createdAt: projectCreatedAt,
      updatedAt: Date.now(),
      input,
      analysis,
      alignment,
      customCurriculumEntries,
      selectedIndicatorId,
      desiredResults,
      desiredResultsConfirmedAt,
      evidencePlan,
      evidencePlanConfirmedAt,
      unitConstraints,
      unitBlueprint,
      unitBlueprintConfirmedAt,
      lessonPromptStatus,
      alignmentAudit,
    }),
    [
      alignment,
      alignmentAudit,
      analysis,
      customCurriculumEntries,
      desiredResults,
      desiredResultsConfirmedAt,
      evidencePlan,
      evidencePlanConfirmedAt,
      input,
      lessonPromptStatus,
      projectCreatedAt,
      projectId,
      selectedIndicatorId,
      unitBlueprint,
      unitBlueprintConfirmedAt,
      unitConstraints,
    ],
  );
  const pendingPrompt = useMemo(() => {
    if (pendingAction === "analyze") return buildKeywordAnalysisPrompt(input);
    if (pendingAction === "align" && analysis) {
      return buildCourseAlignmentPrompt(
        input,
        analysis,
        curriculumCandidates,
        curriculumSelection,
      );
    }
    if (
      pendingAction === "evidence" &&
      alignment &&
      selectedIndicatorId
    ) {
      return buildEvidencePlanPrompt(
        input,
        alignment,
        selectedIndicatorId,
      );
    }
    if (
      pendingAction === "blueprint" &&
      alignment &&
      desiredResults &&
      evidencePlan &&
      selectedIndicatorId
    ) {
      return buildUnitBlueprintPrompt(
        input,
        alignment,
        selectedIndicatorId,
        evidencePlan,
        unitConstraints,
      );
    }
    return null;
  }, [
    analysis,
    alignment,
    curriculumCandidates,
    curriculumSelection,
    desiredResults,
    evidencePlan,
    input,
    pendingAction,
    selectedIndicatorId,
    unitConstraints,
  ]);

  useEffect(() => {
    persistApiKey(KEYS.geminiKey, settings.geminiKey);
    persistApiKey(KEYS.openaiKey, settings.openaiKey);
    persistApiKey(KEYS.xaiKey, settings.xaiKey);
    writeJson(KEYS.courseIdeationModel, settings.model);
  }, [settings]);

  useEffect(() => {
    const draft: CourseIdeationDraft = {
      input,
      analysis,
      alignment,
      curriculumSelection,
      customCurriculumEntries,
      selectedIndicatorId,
      projectId,
      projectCreatedAt,
      desiredResults,
      desiredResultsConfirmedAt,
      evidencePlan,
      evidencePlanConfirmedAt,
      unitConstraints,
      unitBlueprint,
      unitBlueprintConfirmedAt,
      lessonPromptStatus,
      alignmentAudit,
      savedAt: Date.now(),
    };
    writeJson(KEYS.courseIdeationDraft, draft);
  }, [
    alignment,
    analysis,
    curriculumSelection,
    customCurriculumEntries,
    desiredResults,
    desiredResultsConfirmedAt,
    evidencePlan,
    evidencePlanConfirmedAt,
    input,
    lessonPromptStatus,
    alignmentAudit,
    projectCreatedAt,
    projectId,
    selectedIndicatorId,
    unitBlueprint,
    unitBlueprintConfirmedAt,
    unitConstraints,
  ]);

  useEffect(() => {
    writeJson(KEYS.learningDesignProject, currentProject);
  }, [currentProject]);

  const invalidateDesignAfterEndpointChange = () => {
    setDesiredResults(null);
    setDesiredResultsConfirmedAt(null);
    setEvidencePlanConfirmedAt(null);
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setEvidenceError(null);
    setBlueprintError(null);
    setAlignmentAudit({
      desiredResults: "empty",
      evidencePlan: evidencePlan ? "stale" : "empty",
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    });
  };

  const updateInput = (patch: Partial<CourseIdeationInput>) => {
    setInput((current) => ({ ...current, ...patch }));
    setAnalysis(null);
    setAlignment(null);
    setCurriculumSelection(null);
    setCustomCurriculumEntries([]);
    setSelectedIndicatorId("");
    invalidateDesignAfterEndpointChange();
    setError(null);
  };

  const addKeyword = (raw: string) => {
    const next = normalizeCoreKeywords([...input.coreKeywords, raw]);
    if (next.length === input.coreKeywords.length) return;
    updateInput({ coreKeywords: next });
    setKeywordDraft("");
  };

  const handleKeywordKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== "," && event.key !== "，") return;
    event.preventDefault();
    addKeyword(keywordDraft);
  };

  const adjustCurriculumSelection = (
    kind: CurriculumKind,
    id: string,
    checked: boolean,
  ) => {
    const field =
      kind === "learning_performance" ? "performanceIds" : "contentIds";
    const maximum = kind === "learning_performance" ? 2 : 3;
    const current = curriculumSelection ?? {
      performanceIds: [],
      contentIds: [],
      rationale: "",
      mode: "teacher_edited" as const,
    };
    const existing = current[field];
    const nextIds = checked
      ? existing.includes(id)
        ? existing
        : [...existing, id]
      : existing.filter((entryId) => entryId !== id);
    if (nextIds.length > maximum) {
      setError(
        kind === "learning_performance"
          ? "學習表現最多選擇 2 項。"
          : "學習內容最多選擇 3 項。",
      );
      return;
    }
    setCurriculumSelection({
      ...current,
      [field]: nextIds,
      rationale: "教師已調整課綱選擇，需重新校準後才會產生更新成果。",
      mode: "teacher_edited",
    });
    setAlignment(null);
    setSelectedIndicatorId("");
    invalidateDesignAfterEndpointChange();
    setError(null);
  };

  const addCustomCurriculumEntry = (kind: CurriculumKind) => {
    const draft =
      kind === "learning_performance"
        ? customPerformanceDraft
        : customContentDraft;
    try {
      const entry = createCustomCurriculumEntry(
        kind,
        draft,
        input,
        `custom-${kind}-${createLocalId()}`,
      );
      setCustomCurriculumEntries((current) => [...current, entry]);
      if (kind === "learning_performance") {
        setCustomPerformanceDraft("");
      } else {
        setCustomContentDraft("");
      }
      adjustCurriculumSelection(kind, entry.id, true);
    } catch (caught) {
      setError(toUserErrorMessage(caught));
    }
  };

  const executeAction = async (action: AiAction) => {
    if (!hasModelAccess) {
      setError(`請先設定 ${providerName(settings.model)} API Key。`);
      setSettingsOpen(true);
      return;
    }
    if (action === "analyze" && inputErrors.length > 0) {
      setError(inputErrors[0]);
      return;
    }
    if (action === "align" && !analysis) {
      setError("請先完成階段一的關鍵字分析。");
      return;
    }
    if (
      action === "align" &&
      (curriculumCandidates.performances.length === 0 ||
        curriculumCandidates.contents.length === 0)
    ) {
      setError("找不到可校準的課綱條目，請先加入教師自訂的學習表現與學習內容。");
      return;
    }
    if (
      action === "align" &&
      curriculumSelection?.mode === "teacher_edited" &&
      !curriculumSelectionComplete
    ) {
      setError("教師調整後需保留 1–2 項學習表現與 1–3 項學習內容。");
      return;
    }
    if (
      action === "evidence" &&
      (!alignment ||
        !desiredResults ||
        !desiredResultsConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        !selectedIndicatorId)
    ) {
      scrollToDesignStep(
        "learning-design-desired-results",
        "請先確認學習終點，再建立評量證據。",
      );
      return;
    }
    if (
      action === "blueprint" &&
      (!alignment ||
        !desiredResults ||
        !evidencePlan ||
        !evidencePlanConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        alignmentAudit.evidencePlan !== "current" ||
        !selectedIndicatorId)
    ) {
      scrollToDesignStep(
        "learning-design-evidence",
        "請先建立、編修並確認評量證據，再產生單元節次藍圖。",
      );
      return;
    }
    if (action === "blueprint" && unitConstraintErrors.length > 0) {
      setError(unitConstraintErrors[0]);
      return;
    }
    setBusyAction(action);
    setError(null);
    try {
      if (action === "analyze") {
        const raw = await generateContent(
          buildKeywordAnalysisPrompt(input),
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_keyword_analysis",
              schema: KEYWORD_ANALYSIS_SCHEMA,
            },
          },
        );
        const nextAnalysis = parseKeywordAnalysis(
          raw,
          settings.model,
          input.coreKeywords,
        );
        setAnalysis(nextAnalysis);
        setAlignment(null);
        setCurriculumSelection(null);
        setSelectedIndicatorId("");
        invalidateDesignAfterEndpointChange();
      } else if (action === "align" && analysis) {
        const raw = await generateContent(
          buildCourseAlignmentPrompt(
            input,
            analysis,
            curriculumCandidates,
            curriculumSelection,
          ),
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_course_alignment",
              schema: COURSE_ALIGNMENT_SCHEMA,
            },
          },
        );
        const nextAlignment = parseCourseAlignment(
          raw,
          settings.model,
          curriculumCandidates,
          curriculumSelection?.mode === "teacher_edited"
            ? "teacher_edited"
            : "ai_auto",
        );
        if (curriculumSelection?.mode === "teacher_edited") {
          const samePerformances = sameIds(
            nextAlignment.curriculumSelection.performanceIds,
            curriculumSelection.performanceIds,
          );
          const sameContents = sameIds(
            nextAlignment.curriculumSelection.contentIds,
            curriculumSelection.contentIds,
          );
          if (!samePerformances || !sameContents) {
            throw new CourseIdeationResponseError(
              "AI 未保留教師調整的課綱選擇。",
            );
          }
        }
        setAlignment(nextAlignment);
        setCurriculumSelection(nextAlignment.curriculumSelection);
        setSelectedIndicatorId(nextAlignment.recommendations[0].indicatorId);
        setDesiredResults(buildDesiredResults(nextAlignment));
        setDesiredResultsConfirmedAt(null);
        setEvidencePlanConfirmedAt(null);
        setUnitBlueprintConfirmedAt(null);
        setLessonPromptStatus([]);
        setEvidenceError(null);
        setBlueprintError(null);
        setAlignmentAudit({
          desiredResults: "empty",
          evidencePlan: evidencePlan ? "stale" : "empty",
          unitBlueprint: unitBlueprint ? "stale" : "empty",
        });
      } else if (
        action === "evidence" &&
        alignment &&
        desiredResults &&
        selectedIndicatorId
      ) {
        const raw = await generateContent(
          buildEvidencePlanPrompt(input, alignment, selectedIndicatorId),
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_evidence_plan",
              schema: EVIDENCE_PLAN_SCHEMA,
            },
          },
        );
        let nextEvidencePlan: EvidencePlanResult;
        try {
          nextEvidencePlan = parseEvidencePlan(
            raw,
            settings.model,
            desiredResults,
          );
        } catch (caught) {
          if (!(caught instanceof CourseIdeationResponseError)) throw caught;
          const repairedRaw = await generateContent(
            buildEvidencePlanRepairPrompt(
              input,
              alignment,
              selectedIndicatorId,
              raw,
              caught.message,
            ),
            settings.model,
            settings.geminiKey,
            settings.openaiKey,
            settings.xaiKey,
            {
              structured: {
                name: "npdl_evidence_plan_repair",
                schema: EVIDENCE_PLAN_SCHEMA,
              },
            },
          );
          nextEvidencePlan = parseEvidencePlan(
            repairedRaw,
            settings.model,
            desiredResults,
          );
        }
        setEvidencePlan(nextEvidencePlan);
        setEvidencePlanConfirmedAt(null);
        setUnitBlueprintConfirmedAt(null);
        setLessonPromptStatus([]);
        setEvidenceError(null);
        setBlueprintError(null);
        setAlignmentAudit((current) => ({
          desiredResults: current.desiredResults,
          evidencePlan: "current",
          unitBlueprint: unitBlueprint ? "stale" : "empty",
        }));
      } else if (
        action === "blueprint" &&
        alignment &&
        desiredResults &&
        evidencePlan &&
        selectedIndicatorId
      ) {
        const raw = await generateContent(
          buildUnitBlueprintPrompt(
            input,
            alignment,
            selectedIndicatorId,
            evidencePlan,
            unitConstraints,
          ),
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_unit_blueprint",
              schema: UNIT_BLUEPRINT_SCHEMA,
            },
          },
        );
        let nextBlueprint: UnitBlueprintResult;
        try {
          nextBlueprint = parseUnitBlueprint(
            raw,
            settings.model,
            desiredResults,
            evidencePlan,
            unitConstraints,
            selectedIndicatorId,
          );
        } catch (caught) {
          if (!(caught instanceof CourseIdeationResponseError)) throw caught;
          const repairedRaw = await generateContent(
            buildUnitBlueprintRepairPrompt(
              input,
              alignment,
              selectedIndicatorId,
              evidencePlan,
              unitConstraints,
              raw,
              caught.message,
            ),
            settings.model,
            settings.geminiKey,
            settings.openaiKey,
            settings.xaiKey,
            {
              structured: {
                name: "npdl_unit_blueprint_repair",
                schema: UNIT_BLUEPRINT_SCHEMA,
              },
            },
          );
          nextBlueprint = parseUnitBlueprint(
            repairedRaw,
            settings.model,
            desiredResults,
            evidencePlan,
            unitConstraints,
            selectedIndicatorId,
          );
        }
        setUnitBlueprint(nextBlueprint);
        setUnitBlueprintConfirmedAt(Date.now());
        setBlueprintError(null);
        setLessonPromptStatus([
          {
            lessonId: "unit-all",
            promptVersion: 1,
            generatedExternally: false,
          },
        ]);
        setAlignmentAudit((current) => ({
          ...current,
          unitBlueprint: "current",
        }));
      }
    } catch (caught) {
      const detailedMessage =
        caught instanceof CourseIdeationResponseError
          ? caught.message || COURSE_IDEATION_RESPONSE_ERROR_MESSAGE
          : toUserErrorMessage(caught);
      if (action === "evidence") {
        setEvidenceError(detailedMessage);
      } else if (action === "blueprint") {
        setBlueprintError(detailedMessage);
      } else {
        setError(
          caught instanceof CourseIdeationResponseError
            ? COURSE_IDEATION_RESPONSE_ERROR_MESSAGE
            : detailedMessage,
        );
      }
    } finally {
      setBusyAction(null);
    }
  };

  const requestAction = (action: AiAction) => {
    if (action === "analyze" && inputErrors.length > 0) {
      setError(inputErrors[0]);
      return;
    }
    if (action === "align" && !analysis) {
      setError("請先完成階段一的關鍵字分析。");
      return;
    }
    if (
      action === "align" &&
      (curriculumCandidates.performances.length === 0 ||
        curriculumCandidates.contents.length === 0)
    ) {
      setError("找不到可校準的課綱條目，請先加入教師自訂的學習表現與學習內容。");
      return;
    }
    if (
      action === "align" &&
      curriculumSelection?.mode === "teacher_edited" &&
      !curriculumSelectionComplete
    ) {
      setError("教師調整後需保留 1–2 項學習表現與 1–3 項學習內容。");
      return;
    }
    if (
      action === "evidence" &&
      (!alignment ||
        !desiredResults ||
        !desiredResultsConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        !selectedIndicatorId)
    ) {
      scrollToDesignStep(
        "learning-design-desired-results",
        "請先確認學習終點，再建立評量證據。",
      );
      return;
    }
    if (
      action === "blueprint" &&
      (!alignment ||
        !desiredResults ||
        !evidencePlan ||
        !evidencePlanConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        alignmentAudit.evidencePlan !== "current" ||
        !selectedIndicatorId)
    ) {
      scrollToDesignStep(
        "learning-design-evidence",
        "請先建立、編修並確認評量證據，再產生單元節次藍圖。",
      );
      return;
    }
    if (action === "blueprint" && unitConstraintErrors.length > 0) {
      setError(unitConstraintErrors[0]);
      return;
    }
    if (!hasModelAccess) {
      setError(`請先設定 ${providerName(settings.model)} API Key。`);
      setSettingsOpen(true);
      return;
    }
    if (!consentGranted) {
      setPendingAction(action);
      setConsentOpen(true);
      return;
    }
    void executeAction(action);
  };

  const confirmConsent = () => {
    const action = pendingAction;
    writeJson(KEYS.courseIdeationConsent, {
      version: CONSENT_VERSION,
      acceptedAt: Date.now(),
    });
    setConsentGranted(true);
    setConsentOpen(false);
    setPendingAction(null);
    if (action) void executeAction(action);
  };

  const revokeConsent = () => {
    removeStorage(KEYS.courseIdeationConsent);
    setConsentGranted(false);
  };

  const loadTestExample = (exampleId: string) => {
    setInput(createCourseIdeationExampleInput(exampleId));
    setAnalysis(null);
    setAlignment(null);
    setCurriculumSelection(null);
    setCustomCurriculumEntries([]);
    setSelectedIndicatorId("");
    setKeywordDraft("");
    setCustomPerformanceDraft("");
    setCustomContentDraft("");
    invalidateDesignAfterEndpointChange();
    setError(null);
    removeStorage(KEYS.courseIdeationDraft);
  };

  const chooseIndicator = (indicatorId: string) => {
    if (indicatorId === selectedIndicatorId) return;
    setSelectedIndicatorId(indicatorId);
    setEvidencePlanConfirmedAt(null);
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setAlignmentAudit((current) => ({
      desiredResults: current.desiredResults,
      evidencePlan: evidencePlan ? "stale" : "empty",
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    }));
    setEvidenceError(null);
    setBlueprintError(null);
  };

  const confirmDesiredResults = () => {
    if (!desiredResults || !alignment || !selectedIndicatorId) {
      setError("學習終點資料不完整，請重新執行課綱與 6Cs 校準。");
      return;
    }
    setDesiredResultsConfirmedAt(Date.now());
    setAlignmentAudit((current) => ({
      ...current,
      desiredResults: "current",
    }));
    setError(null);
  };

  const scrollToDesignStep = (id: string, message: string) => {
    setError(id === "learning-design-desired-results" ? message : null);
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => target?.focus({ preventScroll: true }), 350);
    if (id === "learning-design-evidence") {
      setEvidenceError(message);
    } else if (id === "learning-design-blueprint") {
      setBlueprintError(message);
    }
  };

  const markEvidenceEdited = () => {
    setEvidencePlanConfirmedAt(null);
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setEvidenceError(null);
    setBlueprintError(null);
    setAlignmentAudit((current) => ({
      ...current,
      evidencePlan:
        current.desiredResults === "current" ? "current" : "stale",
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    }));
  };

  const updateEvidencePlan = (
    updater: (current: EvidencePlanResult) => EvidencePlanResult,
  ) => {
    setEvidencePlan((current) =>
      current ? { ...updater(current), mode: "teacher_edited" } : current,
    );
    markEvidenceEdited();
  };

  const updatePerformanceTask = (
    field: "goal" | "role" | "audience" | "situation" | "product",
    value: string,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      performanceTask: { ...current.performanceTask, [field]: value },
    }));
  };

  const togglePerformanceTaskCriterion = (
    criterionId: string,
    checked: boolean,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      performanceTask: {
        ...current.performanceTask,
        criterionIds: checked
          ? Array.from(
              new Set([...current.performanceTask.criterionIds, criterionId]),
            )
          : current.performanceTask.criterionIds.filter(
              (id) => id !== criterionId,
            ),
      },
    }));
  };

  const updateQuestionMap = (
    phase: EvidenceQuestionMap["phase"],
    field: "sharedProblem" | "transferDifference",
    value: string,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      questionMaps: current.questionMaps.map((map) =>
        map.phase === phase ? { ...map, [field]: value } : map,
      ),
    }));
  };

  const updateQuestionPurpose = (
    phase: EvidenceQuestionMap["phase"],
    questionId: EvidenceQuestionMap["questions"][number]["id"],
    field: "purpose" | "observableEvidence",
    value: string,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      questionMaps: current.questionMaps.map((map) =>
        map.phase !== phase
          ? map
          : {
              ...map,
              questions: map.questions.map((question) =>
                question.id === questionId
                  ? { ...question, [field]: value }
                  : question,
              ),
            },
      ),
    }));
  };

  const toggleQuestionCriterion = (
    phase: EvidenceQuestionMap["phase"],
    questionId: EvidenceQuestionMap["questions"][number]["id"],
    criterionId: string,
    checked: boolean,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      questionMaps: current.questionMaps.map((map) =>
        map.phase !== phase
          ? map
          : {
              ...map,
              questions: map.questions.map((question) =>
                question.id !== questionId
                  ? question
                  : {
                      ...question,
                      criterionIds: checked
                        ? Array.from(
                            new Set([...question.criterionIds, criterionId]),
                          )
                        : question.criterionIds.filter(
                            (id) => id !== criterionId,
                          ),
                    },
              ),
            },
      ),
    }));
  };

  const updateEvidenceItem = (
    itemId: string,
    field: "title" | "artifact" | "method" | "timing" | "decisionRule",
    value: string,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const toggleEvidenceItemCriterion = (
    itemId: string,
    criterionId: string,
    checked: boolean,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.map((item) =>
        item.id !== itemId
          ? item
          : {
              ...item,
              criterionIds: checked
                ? Array.from(new Set([...item.criterionIds, criterionId]))
                : item.criterionIds.filter((id) => id !== criterionId),
            },
      ),
    }));
  };

  const addFormativeEvidence = () => {
    const criterionIds =
      desiredResults?.successCriteria.slice(0, 1).map((item) => item.id) ?? [];
    updateEvidencePlan((current) => ({
      ...current,
      evidenceItems: [
        ...current.evidenceItems,
        {
          id: `evidence-formative-${createLocalId()}`,
          type: "formative",
          title: "新增形成性證據",
          criterionIds,
          artifact: "請描述學生將留下的可觀察作品或紀錄。",
          method: "教師觀察與學生作品蒐集",
          timing: "教學進行中",
          decisionRule:
            "若尚未達成成功指標的學生超過三分之一，下一節先安排示例分析與補證活動。",
        },
      ],
    }));
  };

  const deleteFormativeEvidence = (itemId: string) => {
    updateEvidencePlan((current) => ({
      ...current,
      evidenceItems: current.evidenceItems.filter(
        (item) => item.id !== itemId || item.type !== "formative",
      ),
    }));
  };

  const updateRubricLevel = (
    criterionId: string,
    level: "evidenceLimited" | "emerging" | "developing" | "mastering",
    value: string,
  ) => {
    updateEvidencePlan((current) => ({
      ...current,
      rubric: current.rubric.map((criterion) =>
        criterion.criterionId === criterionId
          ? {
              ...criterion,
              levels: { ...criterion.levels, [level]: value },
            }
          : criterion,
      ),
    }));
  };

  const confirmEvidencePlan = () => {
    if (!evidencePlan || !desiredResults) {
      setEvidenceError("請先建立評量證據草稿。");
      return;
    }
    if (
      !desiredResultsConfirmedAt ||
      alignmentAudit.desiredResults !== "current"
    ) {
      setEvidenceError("學習終點已變更，請先重新確認學習終點。");
      return;
    }
    const errors = validateEvidencePlanResult(evidencePlan, desiredResults);
    if (errors.length > 0) {
      setEvidenceError(errors[0]);
      return;
    }
    setEvidencePlanConfirmedAt(Date.now());
    setEvidenceError(null);
    setAlignmentAudit((current) => ({ ...current, evidencePlan: "current" }));
    window.setTimeout(() => {
      const target = document.getElementById("learning-design-blueprint");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      target?.focus({ preventScroll: true });
    }, 100);
  };

  const reopenEvidencePlan = () => {
    markEvidenceEdited();
  };

  const markBlueprintEdited = () => {
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setBlueprintError(null);
    setAlignmentAudit((current) => ({
      ...current,
      unitBlueprint:
        current.evidencePlan === "current" && evidencePlanConfirmedAt
          ? "current"
          : "stale",
    }));
  };

  const updateUnitBlueprint = (
    updater: (current: UnitBlueprintResult) => UnitBlueprintResult,
  ) => {
    setUnitBlueprint((current) =>
      current ? { ...updater(current), mode: "teacher_edited" } : current,
    );
    markBlueprintEdited();
  };

  const updateLesson = (
    lessonId: string,
    field:
      | "title"
      | "milestone"
      | "learningIntention"
      | "coreTask"
      | "formativeCheck"
      | "decisionRule"
      | "previousConnection"
      | "nextConnection",
    value: string,
  ) => {
    updateUnitBlueprint((current) => ({
      ...current,
      lessons: current.lessons.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, [field]: value } : lesson,
      ),
    }));
  };

  const updateLessonMinutes = (lessonId: string, minutes: number) => {
    updateUnitBlueprint((current) => ({
      ...current,
      lessons: current.lessons.map((lesson) =>
        lesson.id === lessonId ? { ...lesson, minutes } : lesson,
      ),
    }));
  };

  const updateLessonIndicator = (
    lessonId: string,
    primaryIndicatorId: string,
  ) => {
    updateUnitBlueprint((current) => ({
      ...current,
      lessons: current.lessons.map((lesson) =>
        lesson.id === lessonId
          ? { ...lesson, primaryIndicatorId }
          : lesson,
      ),
    }));
  };

  const toggleLessonArrayValue = (
    lessonId: string,
    field:
      | "outcomeIds"
      | "criterionIds"
      | "evidenceItemIds"
      | "fourElementNames",
    value: string,
    checked: boolean,
  ) => {
    updateUnitBlueprint((current) => ({
      ...current,
      lessons: current.lessons.map((lesson) => {
        if (lesson.id !== lessonId) return lesson;
        const values = lesson[field] as string[];
        return {
          ...lesson,
          [field]: checked
            ? Array.from(new Set([...values, value]))
            : values.filter((entry) => entry !== value),
        } as UnitLessonBlueprint;
      }),
    }));
  };

  const moveLesson = (lessonId: string, direction: -1 | 1) => {
    updateUnitBlueprint((current) => {
      const index = current.lessons.findIndex(
        (lesson) => lesson.id === lessonId,
      );
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.lessons.length) {
        return current;
      }
      const lessons = [...current.lessons];
      [lessons[index], lessons[targetIndex]] = [
        lessons[targetIndex],
        lessons[index],
      ];
      return {
        ...current,
        lessons: lessons.map((lesson, lessonIndex) => ({
          ...lesson,
          lessonNumber: lessonIndex + 1,
        })),
      };
    });
  };

  const confirmUnitBlueprint = () => {
    if (!unitBlueprint || !desiredResults || !evidencePlan) {
      setBlueprintError("請先建立單元節次藍圖草稿。");
      return;
    }
    if (
      !evidencePlanConfirmedAt ||
      alignmentAudit.desiredResults !== "current" ||
      alignmentAudit.evidencePlan !== "current"
    ) {
      setBlueprintError("評量證據已變更，請先重新確認評量證據。");
      return;
    }
    const errors = validateUnitBlueprintResult(
      unitBlueprint,
      desiredResults,
      evidencePlan,
      unitConstraints,
      selectedIndicatorId,
    );
    if (errors.length > 0) {
      setBlueprintError(errors[0]);
      return;
    }
    setUnitBlueprintConfirmedAt(Date.now());
    setBlueprintError(null);
    setAlignmentAudit((current) => ({ ...current, unitBlueprint: "current" }));
    setLessonPromptStatus(
      unitBlueprint.lessons.map((lesson) => ({
        lessonId: lesson.id,
        promptVersion: 1,
        generatedExternally: false,
      })),
    );
  };

  const reopenUnitBlueprint = () => {
    markBlueprintEdited();
  };

  const updateUnitConstraint = <Key extends keyof UnitConstraints>(
    key: Key,
    value: UnitConstraints[Key],
  ) => {
    setUnitConstraints((current) => ({ ...current, [key]: value }));
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setAlignmentAudit((current) => ({
      ...current,
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    }));
    setBlueprintError(null);
  };

  const updateLessonPromptStatus = (
    lessonId: string,
    patch: Partial<LessonPromptStatus>,
  ) => {
    setLessonPromptStatus((current) => {
      const existing = current.find((status) => status.lessonId === lessonId);
      const next: LessonPromptStatus = {
        lessonId,
        promptVersion: 1,
        generatedExternally: false,
        ...existing,
        ...patch,
      };
      return [
        ...current.filter((status) => status.lessonId !== lessonId),
        next,
      ];
    });
  };

  const createPromptPackage = (): LessonPromptPackage | null => {
    try {
      return buildUnitPromptPackage(currentProject);
    } catch (caught) {
      setError(toUserErrorMessage(caught));
      return null;
    }
  };

  const previewUnitPrompt = () => {
    const promptPackage = createPromptPackage();
    if (promptPackage) {
      setPromptPreview(promptPackage);
      setCopyNotice(null);
    }
  };

  const copyPromptText = async (
    promptPackage: LessonPromptPackage,
    text: string,
    label: string,
  ) => {
    setPromptPreview(promptPackage);
    try {
      await navigator.clipboard.writeText(text);
      updateLessonPromptStatus(promptPackage.lessonId, {
        lastCopiedAt: Date.now(),
      });
      setCopyNotice(`${label}已複製。`);
      setError(null);
    } catch {
      setCopyNotice("瀏覽器未允許剪貼簿存取，請在下方文字框手動全選複製。");
    }
  };

  const copyUnitPrompt = () => {
    const promptPackage = createPromptPackage();
    if (promptPackage) {
      void copyPromptText(promptPackage, promptPackage.fullPrompt, "完整提示詞");
    }
  };

  const downloadUnitPrompt = () => {
    const promptPackage = createPromptPackage();
    if (!promptPackage || !unitBlueprint) return;
    const blob = new Blob([promptPackage.fullPrompt], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `NPDL-${input.unitName}-${unitBlueprint.lessons.length}節完整教案與學習單-Gemini-Canvas提示詞.md`
      .replace(/[\\/:*?"<>|]/g, "-");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError(null);
  };

  const testConnection = async () => {
    if (!hasModelAccess) {
      setConnectionStatus(`請填寫 ${providerName(settings.model)} API Key。`);
      return;
    }
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const response = await generateContent(
        "請只回覆一個字：「好」。",
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
      );
      setConnectionStatus(response.includes("好") ? "連線成功" : `已回應：${response.slice(0, 24)}`);
    } catch (caught) {
      setConnectionStatus(toUserErrorMessage(caught));
    } finally {
      setTestingConnection(false);
    }
  };

  const handoffToAssessment = () => {
    if (
      !alignment ||
      !selectedIndicatorId ||
      !desiredResults ||
      !evidencePlan ||
      !evidencePlanConfirmedAt ||
      alignmentAudit.desiredResults !== "current" ||
      alignmentAudit.evidencePlan !== "current"
    ) {
      setError("請先確認學習終點並完成評量證據，再帶入評量工作室。");
      return;
    }
    try {
      writeJson(KEYS.learningDesignProject, currentProject);
      const handoff = buildCourseIdeationHandoff(
        input,
        alignment,
        selectedIndicatorId,
        projectId,
      );
      writeJson(KEYS.courseIdeationHandoff, handoff);
      window.location.assign(import.meta.env.BASE_URL);
    } catch (caught) {
      setError(toUserErrorMessage(caught));
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-[#f3f7f4] text-zinc-900 custom-scrollbar">
      <header className="sticky top-0 z-40 border-b border-[#dfe8e2] bg-white/95 px-4 py-3 shadow-[0_1px_12px_rgba(15,45,38,0.06)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#173f36] text-white">
              <Lightbulb className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm font-black sm:text-base">NPDL 課程發想工具</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                創意孵化 · 6Cs 對齊 · 四要素整合
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl border border-[#dfe8e2] bg-white p-2 text-zinc-600 hover:bg-[#f7faf8]"
              aria-label="開啟 AI 設定"
            >
              <Settings2 className="h-5 w-5" />
            </button>
            <a
              href={import.meta.env.BASE_URL}
              className="flex items-center gap-2 rounded-xl border border-[#dfe8e2] bg-white px-3 py-2 text-xs font-black text-zinc-700 hover:bg-[#f7faf8]"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">評量工作室</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <section className="mb-6 overflow-hidden rounded-2xl bg-[#173f36] p-6 text-white shadow-xl shadow-emerald-950/10 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-200">
                Course Ideation Studio
              </p>
              <h2 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">
                把模糊想法，轉成可對齊、可觀察、可延伸的課程起點
              </h2>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-emerald-50/85">
                先整理 3–5 個核心關鍵字，以 108 課綱知識基礎為錨點，再由 AI 導航至 1–2 個 6Cs 子向度；課綱原文與正式四級進程皆取自受控資料，不由 AI 改寫。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["01", "創意孵化與關鍵字提取器"],
                ["02", "6Cs 對齊與進程導航員"],
              ].map(([number, label]) => (
                <div key={number} className="rounded-xl border border-white/15 bg-white/10 p-4">
                  <p className="text-xs font-black text-emerald-200">{number}</p>
                  <p className="mt-1 text-sm font-black leading-5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="關閉錯誤">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <section className="h-fit rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6 xl:sticky xl:top-24">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
                  階段一
                </p>
                <h2 className="mt-1 text-xl font-black">輸入與啟航</h2>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                  四個課程欄位，加上 3–5 個核心關鍵字。
                </p>
              </div>
              <div className="relative shrink-0">
                <RotateCcw
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
                />
                <select
                  aria-label="載入測試範例"
                  title="載入不同學科的測試範例"
                  value=""
                  onChange={(event) => {
                    if (event.target.value) {
                      loadTestExample(event.target.value);
                    }
                  }}
                  className="min-h-9 max-w-44 cursor-pointer appearance-none rounded-xl border border-[#dfe8e2] bg-white py-2 pl-8 pr-8 text-xs font-black text-zinc-600 outline-none hover:bg-[#f7faf8] focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100 sm:max-w-56"
                >
                  <option value="" disabled>
                    測試範例
                  </option>
                  {COURSE_IDEATION_EXAMPLES.map((example) => (
                    <option key={example.id} value={example.id}>
                      {example.input.subject}｜{example.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1 block text-xs font-black text-zinc-600">年級</span>
                <select
                  value={input.grade}
                  onChange={(event) => updateInput({ grade: event.target.value })}
                  className="min-h-12 w-full rounded-xl border border-[#dfe8e2] bg-white px-3 text-sm font-bold outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                >
                  {GRADES.map((grade) => (
                    <option key={grade}>{grade}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-xs font-black text-zinc-600">學科</span>
                <input
                  value={input.subject}
                  onChange={(event) => updateInput({ subject: event.target.value })}
                  className="min-h-12 w-full rounded-xl border border-[#dfe8e2] px-3 text-sm font-bold outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUBJECT_CHIPS.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  onClick={() => updateInput({ subject })}
                  className={`rounded-full px-3 py-1 text-[11px] font-black ${
                    input.subject === subject
                      ? "bg-[#173f36] text-white"
                      : "bg-[#eef4f0] text-zinc-600 hover:bg-[#dfe8e2]"
                  }`}
                >
                  {subject}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4">
              <label>
                <span className="mb-1 block text-xs font-black text-zinc-600">單元名稱</span>
                <input
                  value={input.unitName}
                  onChange={(event) => updateInput({ unitName: event.target.value })}
                  placeholder="例如：全球氣候變遷"
                  className="min-h-12 w-full rounded-xl border border-[#dfe8e2] px-3 text-sm font-bold outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-black text-zinc-600">教學主題</span>
                <input
                  value={input.teachingTopic}
                  onChange={(event) =>
                    updateInput({ teachingTopic: event.target.value })
                  }
                  placeholder="例如：極端氣候與校園調適倡議"
                  className="min-h-12 w-full rounded-xl border border-[#dfe8e2] px-3 text-sm font-bold outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-zinc-600">核心關鍵字</span>
                <span className="text-[10px] font-black text-zinc-400">
                  {input.coreKeywords.length}/5
                </span>
              </div>
              <div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-xl border border-[#dfe8e2] bg-white p-2 focus-within:border-[#2f7d68] focus-within:ring-2 focus-within:ring-emerald-100">
                {input.coreKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() =>
                        updateInput({
                          coreKeywords: input.coreKeywords.filter(
                            (current) => current !== keyword,
                          ),
                        })
                      }
                      aria-label={`移除關鍵字 ${keyword}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {input.coreKeywords.length < 5 && (
                  <input
                    value={keywordDraft}
                    onChange={(event) => setKeywordDraft(event.target.value)}
                    onKeyDown={handleKeywordKeyDown}
                    onBlur={() => addKeyword(keywordDraft)}
                    placeholder="輸入後按 Enter"
                    className="min-h-7 min-w-32 flex-1 border-0 bg-transparent px-1 text-sm outline-none"
                  />
                )}
              </div>
              <p className="mt-1 text-[10px] font-bold text-zinc-500">
                可輸入概念、真實情境、學生行動或預期證據；至少 3 個。
              </p>
            </div>

            <button
              type="button"
              onClick={() => requestAction("analyze")}
              disabled={busyAction !== null || inputErrors.length > 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#173f36] py-3.5 text-sm font-black text-white shadow-sm hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busyAction === "analyze" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BrainCircuit className="h-4 w-4" />
              )}
              {busyAction === "analyze" ? "正在分析關鍵字…" : "AI 分析核心關鍵字"}
            </button>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf2ef] pt-4 text-[11px] font-bold text-zinc-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                {consentGranted ? "此瀏覽器已同意 AI 傳送" : "首次使用前會顯示傳送內容"}
              </span>
              {consentGranted && (
                <button
                  type="button"
                  onClick={revokeConsent}
                  className="font-black text-[#9a6617] underline"
                >
                  撤回同意
                </button>
              )}
            </div>
          </section>

          <div className="space-y-6">
            {!analysis && (
              <section className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-[#b9ccc2] bg-white/70 p-8 text-center">
                <div className="rounded-2xl bg-emerald-100 p-4 text-emerald-800">
                  <Sparkles className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-black">等待關鍵字分析</h2>
                <p className="mt-2 max-w-lg text-sm font-medium leading-7 text-zinc-500">
                  分析完成後，這裡會顯示主題群、課程訊號與可補充關鍵字，接著進入 6Cs 對齊。
                </p>
              </section>
            )}

            {analysis && (
              <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
                      階段一結果
                    </p>
                    <h2 className="mt-1 text-xl font-black">創意孵化與關鍵字提取器</h2>
                  </div>
                  <span className="rounded-full bg-[#eef4f0] px-3 py-1 text-[10px] font-black text-[#175247]">
                    {modelLabel.split("（")[0]}
                  </span>
                </div>
                <p className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold leading-7 text-amber-950">
                  {analysis.summary}
                </p>
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-900">
                  現場可行性基準：以台灣高中一般班級、50 分鐘課時、一般教室與少量共用裝置為預設；自然科可依物理、化學、生物或地科選用一般高中可能具備的基本實驗器材，但須確認數量、安全與可用狀態，並提供校內低科技替代方案。
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {analysis.themes.map((theme) => (
                    <article key={theme.label} className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4">
                      <h3 className="text-sm font-black">{theme.label}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {theme.keywords.map((keyword) => (
                          <span key={keyword} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#175247] ring-1 ring-[#dfe8e2]">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <p className="mt-3 text-xs font-medium leading-6 text-zinc-600">
                        {theme.interpretation}
                      </p>
                    </article>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-[#dfe8e2] p-4">
                  <h3 className="text-xs font-black text-zinc-700">深度學習對齊訊號</h3>
                  <ul className="mt-2 grid gap-2 text-sm font-medium leading-6 text-zinc-600 sm:grid-cols-2">
                    {analysis.curriculumSignals.map((signal) => (
                      <li key={signal} className="flex items-start gap-2">
                        <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
                {analysis.suggestedKeywords.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-black text-zinc-600">可補充關鍵字</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {analysis.suggestedKeywords.map((keyword) => {
                        const disabled =
                          input.coreKeywords.includes(keyword) ||
                          input.coreKeywords.length >= 5;
                        return (
                          <button
                            key={keyword}
                            type="button"
                            disabled={disabled}
                            onClick={() => addKeyword(keyword)}
                            className="flex items-center gap-1 rounded-full border border-[#dfe8e2] bg-white px-3 py-1 text-xs font-black text-zinc-700 hover:border-[#b9ccc2] disabled:opacity-40"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {keyword}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            )}

            {analysis && (
              <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
                      課程校準
                    </p>
                    <h2 className="mt-1 text-xl font-black">108 課綱校準</h2>
                    <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                      已依年級與學科硬性篩選，再依單元、主題和關鍵字排序。AI 只可採用下列受控 ID。
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#eef4f0] px-3 py-1 text-[10px] font-black text-[#175247]">
                    資料快照 {CURRICULUM_SNAPSHOT_VERSION}
                  </span>
                </div>

                {curriculumSelection?.mode === "teacher_edited" && !alignment && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-950">
                    教師已調整課綱選擇。舊的 6Cs 與三層成果已清除，請重新校準。
                  </div>
                )}
                {curriculumSelection && alignment && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-950">
                    {curriculumSelection.mode === "ai_auto"
                      ? "AI 自動採用"
                      : "教師調整後採用"}
                    ：{curriculumSelection.rationale}
                  </div>
                )}

                {[
                  {
                    kind: "learning_performance" as const,
                    title: "學習表現",
                    entries: curriculumCandidates.performances,
                    selectedIds: curriculumSelection?.performanceIds ?? [],
                    hint: "AI 採用 1–2 項",
                  },
                  {
                    kind: "learning_content" as const,
                    title: "學習內容",
                    entries: curriculumCandidates.contents,
                    selectedIds: curriculumSelection?.contentIds ?? [],
                    hint: "AI 採用 1–3 項",
                  },
                ].map((group) => (
                  <div key={group.kind} className="mt-5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-zinc-800">
                        {group.title}
                      </h3>
                      <span className="text-[10px] font-black text-zinc-500">
                        {group.hint} · 候選 {group.entries.length} 項
                      </span>
                    </div>
                    {group.entries.length > 0 ? (
                      <div className="mt-2 grid gap-2">
                        {group.entries.map((entry) => {
                          const checked = group.selectedIds.includes(entry.id);
                          return (
                            <label
                              key={entry.id}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                                checked
                                  ? "border-[#2f7d68] bg-emerald-50"
                                  : "border-[#dfe8e2] bg-[#f7faf8] hover:border-[#b9ccc2]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  adjustCurriculumSelection(
                                    group.kind,
                                    entry.id,
                                    event.target.checked,
                                  )
                                }
                                className="mt-1 h-4 w-4 accent-[#173f36]"
                              />
                              <span className="min-w-0">
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-[#173f36]">
                                    {entry.code}
                                  </span>
                                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-black text-zinc-500 ring-1 ring-[#dfe8e2]">
                                    第 {entry.stage} 學習階段
                                  </span>
                                  {entry.sourceVersion === "unverified" && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-900">
                                      教師自訂／未由系統核對
                                    </span>
                                  )}
                                </span>
                                <span className="mt-1 block text-xs font-medium leading-6 text-zinc-700">
                                  {entry.text}
                                </span>
                                <span className="mt-1 block text-[10px] font-bold leading-5 text-zinc-500">
                                  來源：{entry.sourceDocumentTitle} · {entry.sourceName}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-950">
                        目前受控資料沒有符合的{group.title}，請在下方加入教師自訂依據。
                      </p>
                    )}
                  </div>
                ))}

                <details className="mt-5 rounded-xl border border-[#dfe8e2] bg-[#f7faf8]">
                  <summary className="cursor-pointer px-4 py-3 text-xs font-black text-zinc-700">
                    加入教師自訂課綱依據
                  </summary>
                  <div className="grid gap-4 border-t border-[#dfe8e2] p-4 sm:grid-cols-2">
                    {[
                      {
                        kind: "learning_performance" as const,
                        label: "自訂學習表現",
                        value: customPerformanceDraft,
                        setValue: setCustomPerformanceDraft,
                      },
                      {
                        kind: "learning_content" as const,
                        label: "自訂學習內容",
                        value: customContentDraft,
                        setValue: setCustomContentDraft,
                      },
                    ].map((field) => (
                      <div key={field.kind}>
                        <label className="text-xs font-black text-zinc-700">
                          {field.label}
                        </label>
                        <textarea
                          value={field.value}
                          onChange={(event) => field.setValue(event.target.value)}
                          rows={3}
                          placeholder="貼上教師確認的課綱文字或校本課程依據"
                          className="mt-2 w-full resize-y rounded-xl border border-[#dfe8e2] bg-white p-3 text-xs font-medium leading-6 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                        />
                        <button
                          type="button"
                          onClick={() => addCustomCurriculumEntry(field.kind)}
                          className="mt-2 flex w-full items-center justify-center gap-1 rounded-xl border border-[#b9ccc2] bg-white py-2 text-xs font-black text-[#173f36] hover:bg-emerald-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          加入並選取
                        </button>
                      </div>
                    ))}
                  </div>
                </details>

                <button
                  type="button"
                  onClick={() => requestAction("align")}
                  disabled={
                    busyAction !== null ||
                    curriculumCandidates.performances.length === 0 ||
                    curriculumCandidates.contents.length === 0 ||
                    (curriculumSelection?.mode === "teacher_edited" &&
                      !curriculumSelectionComplete)
                  }
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7791f] py-3.5 text-sm font-black text-white hover:bg-[#946114] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyAction === "align" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  {busyAction === "align"
                    ? "正在校準課綱與 6Cs…"
                    : curriculumSelection?.mode === "teacher_edited"
                      ? "依教師調整重新校準"
                      : "進行 108 課綱與 6Cs 校準"}
                </button>
              </section>
            )}

            {alignment && (
              <>
                <nav
                  aria-label="逆向設計進度"
                  className="rounded-2xl border border-[#dfe8e2] bg-white p-4 shadow-sm"
                >
                  <ol className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                    {[
                      {
                        label: "學習終點",
                        id: "learning-design-desired-results",
                        done: Boolean(desiredResultsConfirmedAt),
                        started: Boolean(desiredResults),
                      },
                      {
                        label: "評量證據",
                        id: "learning-design-evidence",
                        done: Boolean(evidencePlanConfirmedAt),
                        started: Boolean(evidencePlan),
                      },
                      {
                        label: "節次藍圖",
                        id: "learning-design-blueprint",
                        done: Boolean(unitBlueprintConfirmedAt),
                        started: Boolean(unitBlueprint),
                      },
                      {
                        label: "Canvas",
                        id: "learning-design-blueprint",
                        done: Boolean(unitBlueprintConfirmedAt),
                        started: false,
                      },
                    ].map((step, index) => (
                      <li key={step.label}>
                        <button
                          type="button"
                          onClick={() =>
                            scrollToDesignStep(step.id, `請完成「${step.label}」。`)
                          }
                          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-left text-xs font-black transition ${
                            step.done
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : step.started
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-zinc-200 bg-zinc-50 text-zinc-500"
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              step.done
                                ? "bg-emerald-700 text-white"
                                : "bg-white text-zinc-600"
                            }`}
                          >
                            {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                          </span>
                          {step.label}
                        </button>
                      </li>
                    ))}
                  </ol>
                </nav>

                <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
                    階段二
                  </p>
                  <h2 className="mt-1 text-xl font-black">6Cs 子向度推薦</h2>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    選擇一個子向度作為後續評量設計主軸。
                  </p>
                  <div className="mt-4 grid gap-3">
                    {alignment.recommendations.map((recommendation) => {
                      const indicator = getIndicatorById(recommendation.indicatorId);
                      if (!indicator) return null;
                      const selected = selectedIndicatorId === recommendation.indicatorId;
                      return (
                        <button
                          key={recommendation.indicatorId}
                          type="button"
                          onClick={() => chooseIndicator(recommendation.indicatorId)}
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-[#173f36] bg-[#173f36] text-white shadow-md"
                              : "border-[#dfe8e2] bg-[#f7faf8] hover:border-[#b9ccc2]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${selected ? "text-emerald-200" : "text-emerald-700"}`}>
                                {indicator.dimension} · {indicator.id}
                              </p>
                              <h3 className="mt-1 text-base font-black">{indicator.name}</h3>
                            </div>
                            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? "border-white bg-white text-[#173f36]" : "border-[#b9ccc2] text-transparent"}`}>
                              <Check className="h-4 w-4" />
                            </span>
                          </div>
                          <p className={`mt-3 text-sm font-medium leading-7 ${selected ? "text-emerald-50" : "text-zinc-600"}`}>
                            {recommendation.reason}
                          </p>
                          <p className={`mt-3 text-xs font-black ${selected ? "text-amber-200" : "text-[#9a6617]"}`}>
                            註：關鍵字｜{recommendation.matchedKeywords.join("、")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  {selectedIndicator && <ProgressionPanel indicatorId={selectedIndicator.id} />}
                </section>

                {desiredResults && (
                  <section
                    id="learning-design-desired-results"
                    tabIndex={-1}
                    className="scroll-mt-24 rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm outline-none focus:ring-2 focus:ring-sky-400 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                          逆向設計 · 第一步
                        </p>
                        <h2 className="mt-1 text-xl font-black text-sky-950">
                          鎖定學習終點
                        </h2>
                        <p className="mt-1 text-xs font-bold leading-6 text-sky-800">
                          教師確認後才會開放評量證據；若更動課程、課綱或 6Cs，後續內容會標示需要重新校準。
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${
                          alignmentAudit.desiredResults === "current"
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-amber-100 text-amber-950"
                        }`}
                      >
                        {alignmentAudit.desiredResults === "current"
                          ? "教師已確認"
                          : "等待教師確認"}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {[
                        ["遷移目標", desiredResults.transferGoals],
                        ["核心理解", desiredResults.enduringUnderstandings],
                        ["核心問題", desiredResults.essentialQuestions],
                      ].map(([label, items]) => (
                        <article
                          key={label as string}
                          className="rounded-xl border border-sky-200 bg-white p-4"
                        >
                          <h3 className="text-xs font-black text-sky-900">
                            {label as string}
                          </h3>
                          <ul className="mt-2 space-y-2 text-xs font-medium leading-6 text-zinc-700">
                            {(items as string[]).map((item) => (
                              <li key={item} className="flex items-start gap-2">
                                <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-sky-700" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </article>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={confirmDesiredResults}
                      disabled={alignmentAudit.desiredResults === "current"}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-800 py-3 text-sm font-black text-white hover:bg-sky-900 disabled:cursor-default disabled:bg-emerald-700"
                    >
                      <Check className="h-4 w-4" />
                      {alignmentAudit.desiredResults === "current"
                        ? "學習終點已確認"
                        : "確認並鎖定學習終點"}
                    </button>
                  </section>
                )}

                <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-violet-100 p-2 text-violet-800">
                      <BookOpenCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black">三層學習成果</h2>
                      <p className="text-xs font-bold text-zinc-500">
                        從內容理解逐步走向素養與真實實踐。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <article className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                        01 知識基礎
                      </p>
                      <div className="mt-3 rounded-lg border border-violet-100 bg-white p-3">
                        <p className="text-[10px] font-black text-violet-700">
                          課綱依據
                        </p>
                        <ul className="mt-2 space-y-2 text-xs font-medium leading-6 text-zinc-700">
                          {[
                            ...alignment.curriculumSelection.performanceIds,
                            ...alignment.curriculumSelection.contentIds,
                          ].map((id) => {
                            const entry = getCurriculumEntry(
                              id,
                              customCurriculumEntries,
                            );
                            if (!entry) return null;
                            return (
                              <li key={id}>
                                <span className="font-black text-[#173f36]">
                                  {entry.code}
                                </span>
                                ｜{entry.text}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <p className="mt-3 text-[10px] font-black text-violet-700">
                        學術預期成果
                      </p>
                      <p className="mt-1 text-sm font-black leading-7 text-zinc-800">
                        {alignment.learningOutcomes.knowledgeFoundation.statement}
                      </p>
                      <p className="mt-3 text-[10px] font-black text-violet-700">
                        成功指標
                      </p>
                      <ul className="mt-1 space-y-1 text-xs font-medium leading-6 text-zinc-700">
                        {alignment.learningOutcomes.knowledgeFoundation.successCriteria.map(
                          (criterion) => (
                            <li key={criterion} className="flex items-start gap-2">
                              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-violet-700" />
                              {criterion}
                            </li>
                          ),
                        )}
                      </ul>
                      <p className="mt-3 text-xs font-medium leading-6 text-zinc-600">
                        <span className="font-black">可觀察證據：</span>
                        {alignment.learningOutcomes.knowledgeFoundation.evidence}
                      </p>
                    </article>
                    {[
                      ["02 素養子向度", alignment.learningOutcomes.competencySubdimension],
                      ["03 四要素整合實踐", alignment.learningOutcomes.fourElementsPractice],
                    ].map(([label, outcome]) => (
                      <article key={label as string} className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4">
                        <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                          {label as string}
                        </p>
                        <p className="mt-2 text-sm font-black leading-7 text-zinc-800">
                          {(outcome as { statement: string }).statement}
                        </p>
                        <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                          <span className="font-black">可觀察證據：</span>
                          {(outcome as { evidence: string }).evidence}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-xl font-black">NPDL 學習設計四要素</h2>
                  <p className="mt-1 text-xs font-bold text-zinc-500">
                    不是 4E 教學循環；四個要素共同支撐深度學習設計。
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {alignment.fourElements.map((element) => (
                      <article key={element.name} className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4">
                        <h3 className="text-sm font-black text-[#173f36]">{element.name}</h3>
                        <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                          <span className="font-black">設計動作：</span>
                          {element.designMove}
                        </p>
                        <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                          <span className="font-black">學生證據：</span>
                          {element.studentEvidence}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>

                <section
                  id="learning-design-evidence"
                  tabIndex={-1}
                  className="scroll-mt-24 rounded-2xl border border-amber-200 bg-amber-50/55 p-5 shadow-sm outline-none focus:ring-2 focus:ring-amber-400 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                        逆向設計 · 第二步
                      </p>
                      <h2 className="mt-1 text-xl font-black text-amber-950">
                        建立完整評量證據
                      </h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-amber-900/80">
                        先決定學生要留下哪些證據，再倒推教學活動。學科規準與 6Cs 官方進程分開呈現。
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${
                        alignmentAudit.evidencePlan === "current" &&
                        evidencePlanConfirmedAt
                          ? "bg-emerald-100 text-emerald-900"
                          : alignmentAudit.evidencePlan === "stale"
                            ? "bg-red-100 text-red-900"
                            : evidencePlan
                              ? "bg-amber-100 text-amber-950"
                              : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {alignmentAudit.evidencePlan === "current" &&
                      evidencePlanConfirmedAt
                        ? "教師已確認"
                        : alignmentAudit.evidencePlan === "stale"
                          ? "需要重新校準"
                          : evidencePlan
                            ? "等待教師確認"
                            : "尚未建立"}
                    </span>
                  </div>

                  {alignmentAudit.desiredResults !== "current" && (
                    <p className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-xs font-bold leading-6 text-amber-950">
                      請先確認「學習終點」，才能讓 AI 依成功指標建立證據系統。
                    </p>
                  )}

                  {evidenceError && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-6 text-red-800"
                    >
                      {evidenceError}
                    </p>
                  )}

                  {evidencePlan && (
                    <div className="mt-4 space-y-4">
                      <article className="rounded-xl border border-amber-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-black text-amber-950">
                            真實總結任務
                          </h3>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-900">
                            台灣高中現場可行
                          </span>
                        </div>
                        <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                          {[
                            ["目標", evidencePlan.performanceTask.goal],
                            ["角色", evidencePlan.performanceTask.role],
                            ["受眾", evidencePlan.performanceTask.audience],
                            ["情境", evidencePlan.performanceTask.situation],
                            ["成果", evidencePlan.performanceTask.product],
                            [
                              "成功指標",
                              evidencePlan.performanceTask.criterionIds.join("、"),
                            ],
                          ].map(([label, value]) => (
                            <div key={label} className="rounded-lg bg-amber-50 p-3">
                              <dt className="font-black text-amber-800">{label}</dt>
                              <dd className="mt-1 font-medium leading-6 text-zinc-700">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </article>

                      <div className="grid gap-3 lg:grid-cols-2">
                        {evidencePlan.questionMaps.map((map) => (
                          <article
                            key={map.phase}
                            className="rounded-xl border border-amber-200 bg-white p-4"
                          >
                            <h3 className="text-sm font-black text-amber-950">
                              {map.phase === "pre"
                                ? "課前 Q1–Q4 證據目的"
                                : "課後 Q1–Q4 遷移證據目的"}
                            </h3>
                            <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                              <span className="font-black">共同問題：</span>
                              {map.sharedProblem}
                            </p>
                            {map.phase === "post" && (
                              <p className="mt-2 rounded-lg bg-sky-50 p-3 text-xs font-bold leading-6 text-sky-900">
                                新情境差異：{map.transferDifference}
                              </p>
                            )}
                            <div className="mt-3 space-y-2">
                              {map.questions.map((question) => (
                                <div
                                  key={question.id}
                                  className="rounded-lg bg-amber-50 p-3 text-xs leading-6"
                                >
                                  <p className="font-black text-amber-900">
                                    {question.id} ·{" "}
                                    {question.focus === "conceptual_understanding"
                                      ? "概念理解"
                                      : question.focus === "action_application"
                                        ? "行動應用"
                                        : question.focus === "life_transfer"
                                          ? "生活遷移"
                                          : "引導式簡答與四級進程"}
                                  </p>
                                  <p className="mt-1 font-medium text-zinc-700">
                                    {question.purpose}
                                  </p>
                                  <p className="mt-1 text-[10px] font-bold text-zinc-500">
                                    預期證據：{question.observableEvidence}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        {evidencePlan.evidenceItems.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-xl border border-amber-200 bg-white p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-black text-zinc-800">
                                {item.title}
                              </h3>
                              <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-900">
                                {item.type === "diagnostic"
                                  ? "課前診斷"
                                  : item.type === "formative"
                                    ? "形成性"
                                    : item.type === "summative"
                                      ? "總結性"
                                      : "課後遷移"}
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                              <span className="font-black">證據：</span>
                              {item.artifact}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                              <span className="font-black">蒐集方式：</span>
                              {item.method}（{item.timing}）
                            </p>
                            <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-950">
                              教學決策：{item.decisionRule}
                            </p>
                            <p className="mt-2 text-[10px] font-black text-zinc-500">
                              對應 {item.criterionIds.join("、")}
                            </p>
                          </article>
                        ))}
                      </div>

                      <details className="rounded-xl border border-amber-200 bg-white">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-black text-amber-950">
                          查看學科成功指標四級規準
                        </summary>
                        <div className="grid gap-3 border-t border-amber-200 p-4">
                          {evidencePlan.rubric.map((criterion) => (
                            <article
                              key={criterion.criterionId}
                              className="rounded-lg bg-amber-50 p-3"
                            >
                              <h4 className="text-xs font-black text-amber-900">
                                {criterion.criterionId}
                              </h4>
                              <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                                {[
                                  ["證據有限", criterion.levels.evidenceLimited],
                                  ["萌芽", criterion.levels.emerging],
                                  ["發展", criterion.levels.developing],
                                  ["精熟", criterion.levels.mastering],
                                ].map(([level, text]) => (
                                  <p
                                    key={level}
                                    className="rounded-lg bg-white p-3 font-medium leading-6 text-zinc-700"
                                  >
                                    <span className="font-black text-amber-800">
                                      {level}：
                                    </span>
                                    {text}
                                  </p>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      </details>

                      <details
                        className="rounded-xl border border-amber-300 bg-white"
                      >
                        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-black text-amber-950">
                          <Pencil className="h-4 w-4" />
                          {evidencePlanConfirmedAt
                            ? "查看已鎖定的評量證據內容"
                            : "逐項編修評量證據草稿"}
                        </summary>
                        <div className="space-y-5 border-t border-amber-200 p-4">
                          <fieldset
                            disabled={Boolean(evidencePlanConfirmedAt)}
                            className="space-y-5 disabled:opacity-75"
                          >
                            <div>
                              <h4 className="text-sm font-black text-amber-950">
                                真實總結任務
                              </h4>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {[
                                  ["goal", "目標"],
                                  ["role", "角色"],
                                  ["audience", "受眾"],
                                  ["situation", "情境"],
                                  ["product", "成果"],
                                ].map(([field, label]) => (
                                  <label
                                    key={field}
                                    className="text-xs font-black text-zinc-700"
                                  >
                                    {label}
                                    <textarea
                                      rows={2}
                                      value={
                                        evidencePlan.performanceTask[
                                          field as
                                            | "goal"
                                            | "role"
                                            | "audience"
                                            | "situation"
                                            | "product"
                                        ]
                                      }
                                      onChange={(event) =>
                                        updatePerformanceTask(
                                          field as
                                            | "goal"
                                            | "role"
                                            | "audience"
                                            | "situation"
                                            | "product",
                                          event.target.value,
                                        )
                                      }
                                      className="mt-1 w-full resize-y rounded-lg border border-amber-200 p-3 text-xs font-medium leading-6 outline-none focus:border-amber-500"
                                    />
                                  </label>
                                ))}
                              </div>
                              <CriterionCheckboxes
                                criteria={desiredResults?.successCriteria ?? []}
                                selectedIds={
                                  evidencePlan.performanceTask.criterionIds
                                }
                                onToggle={togglePerformanceTaskCriterion}
                              />
                            </div>

                            {evidencePlan.questionMaps.map((map) => (
                              <section
                                key={map.phase}
                                className="rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                              >
                                <h4 className="text-sm font-black text-amber-950">
                                  {map.phase === "pre"
                                    ? "課前 Q1–Q4"
                                    : "課後 Q1–Q4（新情境遷移）"}
                                </h4>
                                <label className="mt-3 block text-xs font-black text-zinc-700">
                                  共同問題脈絡
                                  <textarea
                                    rows={2}
                                    value={map.sharedProblem}
                                    onChange={(event) =>
                                      updateQuestionMap(
                                        map.phase,
                                        "sharedProblem",
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 w-full resize-y rounded-lg border border-amber-200 bg-white p-3 text-xs font-medium leading-6"
                                  />
                                </label>
                                {map.phase === "post" && (
                                  <label className="mt-3 block text-xs font-black text-zinc-700">
                                    新資料、新限制或新情境
                                    <textarea
                                      rows={2}
                                      value={map.transferDifference}
                                      onChange={(event) =>
                                        updateQuestionMap(
                                          map.phase,
                                          "transferDifference",
                                          event.target.value,
                                        )
                                      }
                                      className="mt-1 w-full resize-y rounded-lg border border-amber-200 bg-white p-3 text-xs font-medium leading-6"
                                    />
                                  </label>
                                )}
                                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                  {map.questions.map((question) => (
                                    <article
                                      key={question.id}
                                      className="rounded-lg border border-amber-200 bg-white p-3"
                                    >
                                      <h5 className="text-xs font-black text-amber-900">
                                        {question.id}
                                      </h5>
                                      <label className="mt-2 block text-[11px] font-black text-zinc-700">
                                        評量目的
                                        <textarea
                                          rows={2}
                                          value={question.purpose}
                                          onChange={(event) =>
                                            updateQuestionPurpose(
                                              map.phase,
                                              question.id,
                                              "purpose",
                                              event.target.value,
                                            )
                                          }
                                          className="mt-1 w-full resize-y rounded-lg border border-amber-200 p-2 text-xs font-medium leading-6"
                                        />
                                      </label>
                                      <label className="mt-2 block text-[11px] font-black text-zinc-700">
                                        預期可觀察證據
                                        <textarea
                                          rows={2}
                                          value={question.observableEvidence}
                                          onChange={(event) =>
                                            updateQuestionPurpose(
                                              map.phase,
                                              question.id,
                                              "observableEvidence",
                                              event.target.value,
                                            )
                                          }
                                          className="mt-1 w-full resize-y rounded-lg border border-amber-200 p-2 text-xs font-medium leading-6"
                                        />
                                      </label>
                                      <CriterionCheckboxes
                                        criteria={
                                          desiredResults?.successCriteria ?? []
                                        }
                                        selectedIds={question.criterionIds}
                                        onToggle={(criterionId, checked) =>
                                          toggleQuestionCriterion(
                                            map.phase,
                                            question.id,
                                            criterionId,
                                            checked,
                                          )
                                        }
                                      />
                                    </article>
                                  ))}
                                </div>
                              </section>
                            ))}

                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <h4 className="text-sm font-black text-amber-950">
                                  證據項目與教學決策
                                </h4>
                                <button
                                  type="button"
                                  onClick={addFormativeEvidence}
                                  className="flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-2 text-xs font-black text-amber-900 hover:bg-amber-50"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  新增形成性證據
                                </button>
                              </div>
                              <div className="mt-3 grid gap-3">
                                {evidencePlan.evidenceItems.map((item) => (
                                  <article
                                    key={item.id}
                                    className="rounded-xl border border-amber-200 p-4"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-[10px] font-black uppercase text-amber-800">
                                        {item.type}
                                      </span>
                                      {item.type === "formative" && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteFormativeEvidence(item.id)
                                          }
                                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black text-red-700 hover:bg-red-50"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          刪除
                                        </button>
                                      )}
                                    </div>
                                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                      {[
                                        ["title", "名稱", 1],
                                        ["artifact", "作品／可觀察證據", 2],
                                        ["method", "蒐集方式", 2],
                                        ["timing", "時間", 1],
                                        ["decisionRule", "教學決策規則", 3],
                                      ].map(([field, label, rows]) => (
                                        <label
                                          key={field as string}
                                          className={`text-xs font-black text-zinc-700 ${
                                            field === "decisionRule"
                                              ? "sm:col-span-2"
                                              : ""
                                          }`}
                                        >
                                          {label as string}
                                          <textarea
                                            rows={rows as number}
                                            value={
                                              item[
                                                field as
                                                  | "title"
                                                  | "artifact"
                                                  | "method"
                                                  | "timing"
                                                  | "decisionRule"
                                              ]
                                            }
                                            onChange={(event) =>
                                              updateEvidenceItem(
                                                item.id,
                                                field as
                                                  | "title"
                                                  | "artifact"
                                                  | "method"
                                                  | "timing"
                                                  | "decisionRule",
                                                event.target.value,
                                              )
                                            }
                                            className="mt-1 w-full resize-y rounded-lg border border-amber-200 p-2 text-xs font-medium leading-6"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                    <CriterionCheckboxes
                                      criteria={
                                        desiredResults?.successCriteria ?? []
                                      }
                                      selectedIds={item.criterionIds}
                                      onToggle={(criterionId, checked) =>
                                        toggleEvidenceItemCriterion(
                                          item.id,
                                          criterionId,
                                          checked,
                                        )
                                      }
                                    />
                                  </article>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-black text-amber-950">
                                每項成功指標的四級學科規準
                              </h4>
                              <div className="mt-3 grid gap-3">
                                {evidencePlan.rubric.map((criterion) => (
                                  <article
                                    key={criterion.criterionId}
                                    className="rounded-xl border border-amber-200 p-4"
                                  >
                                    <h5 className="text-xs font-black text-amber-900">
                                      {criterion.criterionId}
                                    </h5>
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                      {[
                                        ["evidenceLimited", "證據有限"],
                                        ["emerging", "萌芽"],
                                        ["developing", "發展"],
                                        ["mastering", "精熟"],
                                      ].map(([level, label]) => (
                                        <label
                                          key={level}
                                          className="text-[11px] font-black text-zinc-700"
                                        >
                                          {label}
                                          <textarea
                                            rows={2}
                                            value={
                                              criterion.levels[
                                                level as
                                                  | "evidenceLimited"
                                                  | "emerging"
                                                  | "developing"
                                                  | "mastering"
                                              ]
                                            }
                                            onChange={(event) =>
                                              updateRubricLevel(
                                                criterion.criterionId,
                                                level as
                                                  | "evidenceLimited"
                                                  | "emerging"
                                                  | "developing"
                                                  | "mastering",
                                                event.target.value,
                                              )
                                            }
                                            className="mt-1 w-full resize-y rounded-lg border border-amber-200 p-2 text-xs font-medium leading-6"
                                          />
                                        </label>
                                      ))}
                                    </div>
                                  </article>
                                ))}
                              </div>
                            </div>
                          </fieldset>
                        </div>
                      </details>

                      {evidencePlanConfirmedAt ? (
                        <button
                          type="button"
                          onClick={reopenEvidencePlan}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white py-3 text-sm font-black text-amber-900 hover:bg-amber-50"
                        >
                          <Pencil className="h-4 w-4" />
                          重新編輯評量證據
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={confirmEvidencePlan}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800"
                        >
                          <Check className="h-4 w-4" />
                          確認證據，前往節次藍圖
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      alignmentAudit.desiredResults === "current"
                        ? requestAction("evidence")
                        : scrollToDesignStep(
                            "learning-design-desired-results",
                            "請先確認學習終點，再建立評量證據。",
                          )
                    }
                    disabled={busyAction !== null}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-700 py-3.5 text-sm font-black text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === "evidence" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ListChecks className="h-4 w-4" />
                    )}
                    {busyAction === "evidence"
                      ? "正在建立評量證據…"
                      : alignmentAudit.desiredResults !== "current"
                        ? "先確認學習終點"
                      : evidencePlan
                        ? "重新建立並校準評量證據"
                        : "AI 建立完整評量證據"}
                  </button>
                </section>

                <section
                  id="learning-design-blueprint"
                  tabIndex={-1}
                  className="scroll-mt-24 rounded-2xl border border-indigo-200 bg-indigo-50/55 p-5 shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                        逆向設計 · 第三步
                      </p>
                      <h2 className="mt-1 text-xl font-black text-indigo-950">
                        單元節次藍圖
                      </h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-indigo-900/80">
                        每節連結成果、成功指標、可觀察證據與教學決策，並同步準備「知識基礎＋NPDL 子向度思考」學習單；通過檢查後提供一份完整 Canvas 提示詞。
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${
                        alignmentAudit.unitBlueprint === "current" &&
                        unitBlueprintConfirmedAt
                          ? "bg-emerald-100 text-emerald-900"
                          : alignmentAudit.unitBlueprint === "stale"
                            ? "bg-red-100 text-red-900"
                            : unitBlueprint
                              ? "bg-indigo-100 text-indigo-950"
                              : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {alignmentAudit.unitBlueprint === "current" &&
                      unitBlueprintConfirmedAt
                        ? "完整提示詞已準備"
                        : alignmentAudit.unitBlueprint === "stale"
                          ? "需要重新校準"
                          : unitBlueprint
                            ? "請重新產生"
                            : "尚未建立"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-black text-zinc-700">
                      總節數
                      <input
                        type="number"
                        min={2}
                        max={20}
                        value={unitConstraints.totalLessons}
                        onChange={(event) =>
                          updateUnitConstraint(
                            "totalLessons",
                            Number(event.target.value),
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    <label className="text-xs font-black text-zinc-700">
                      每節分鐘數
                      <input
                        type="number"
                        min={20}
                        max={120}
                        value={unitConstraints.minutesPerLesson}
                        onChange={(event) =>
                          updateUnitConstraint(
                            "minutesPerLesson",
                            Number(event.target.value),
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-indigo-200 bg-white px-3 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      />
                    </label>
                    {[
                      ["requiredActivities", "必須保留的活動", "例如：實驗操作、校園踏查"],
                      ["equipmentConstraints", "設備、場地與分組限制", "例如：每組一台平板、不可使用實驗室"],
                      ["priorExperience", "學生先備經驗", "例如：已學過比例，尚未做過資料判讀"],
                      ["differentiationNeeds", "差異化支持", "例如：閱讀鷹架、進階延伸任務"],
                    ].map(([key, label, placeholder]) => (
                      <label
                        key={key}
                        className="text-xs font-black text-zinc-700"
                      >
                        {label}
                        <textarea
                          rows={3}
                          value={unitConstraints[key as keyof UnitConstraints]}
                          placeholder={placeholder}
                          onChange={(event) =>
                            updateUnitConstraint(
                              key as
                                | "requiredActivities"
                                | "equipmentConstraints"
                                | "priorExperience"
                                | "differentiationNeeds",
                              event.target.value,
                            )
                          }
                          className="mt-2 w-full resize-y rounded-xl border border-indigo-200 bg-white p-3 text-xs font-medium leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </label>
                    ))}
                  </div>

                  {unitConstraintErrors.length > 0 && (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">
                      {unitConstraintErrors[0]}
                    </p>
                  )}

                  {blueprintError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-6 text-red-800"
                    >
                      {blueprintError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      evidencePlanConfirmedAt &&
                      alignmentAudit.evidencePlan === "current"
                        ? requestAction("blueprint")
                        : scrollToDesignStep(
                            "learning-design-evidence",
                            "請先建立、編修並確認評量證據，再產生單元節次藍圖。",
                          )
                    }
                    disabled={
                      busyAction !== null ||
                      unitConstraintErrors.length > 0
                    }
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 py-3.5 text-sm font-black text-white hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === "blueprint" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Map className="h-4 w-4" />
                    )}
                    {busyAction === "blueprint"
                      ? "正在倒推單元節次…"
                      : !evidencePlanConfirmedAt ||
                          alignmentAudit.evidencePlan !== "current"
                        ? "先建立並確認評量證據"
                      : unitBlueprint
                        ? "重新產生單元節次藍圖"
                        : "AI 產生單元節次藍圖"}
                  </button>

                  {unitBlueprint && (
                    <div className="mt-5 space-y-3">
                      <p className="rounded-xl border border-indigo-200 bg-white p-4 text-sm font-bold leading-7 text-indigo-950">
                        {unitBlueprint.unitArc}
                      </p>

                      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                              Gemini Canvas · 完整單元
                            </p>
                            <h3 className="mt-1 text-lg font-black text-emerald-950">
                              {unitBlueprint.lessons.length} 節完整教案與學習單提示詞已準備
                            </h3>
                            <p className="mt-1 text-xs font-medium leading-6 text-emerald-800">
                              一次貼入 Gemini，即可產生全部節次教案，以及每節分為「知識基礎」與「NPDL 子向度思考」的學習單；後續直接在 Gemini 內修改。
                            </p>
                          </div>
                          {lessonPromptStatus.find(
                            (status) => status.lessonId === "unit-all",
                          )?.generatedExternally && (
                            <span className="shrink-0 rounded-full bg-emerald-200 px-3 py-1 text-[10px] font-black text-emerald-950">
                              已在外部產生
                            </span>
                          )}
                        </div>

                        {alignmentAudit.desiredResults === "current" &&
                        alignmentAudit.evidencePlan === "current" &&
                        alignmentAudit.unitBlueprint === "current" &&
                        evidencePlanConfirmedAt &&
                        unitBlueprintConfirmedAt ? (
                          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                            <button
                              type="button"
                              onClick={previewUnitPrompt}
                              className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-xs font-black text-emerald-950 hover:bg-emerald-100"
                            >
                              <FileText className="h-3.5 w-3.5" />
                              預覽完整提示詞
                            </button>
                            <button
                              type="button"
                              onClick={copyUnitPrompt}
                              className="flex items-center justify-center gap-1 rounded-lg bg-emerald-800 px-3 py-2.5 text-xs font-black text-white hover:bg-emerald-900"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                              複製完整單元
                            </button>
                            <button
                              type="button"
                              onClick={downloadUnitPrompt}
                              className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-xs font-black text-emerald-950 hover:bg-emerald-100"
                            >
                              <Download className="h-3.5 w-3.5" />
                              下載 Markdown
                            </button>
                            <a
                              href="https://gemini.google.com/app"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-xs font-black text-emerald-950 hover:bg-emerald-100"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              開啟 Gemini
                            </a>
                            <button
                              type="button"
                              onClick={() => {
                                const status = lessonPromptStatus.find(
                                  (candidate) =>
                                    candidate.lessonId === "unit-all",
                                );
                                updateLessonPromptStatus("unit-all", {
                                  generatedExternally:
                                    !status?.generatedExternally,
                                });
                              }}
                              className="flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-2.5 text-xs font-black text-emerald-950 hover:bg-emerald-100"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {lessonPromptStatus.find(
                                (status) => status.lessonId === "unit-all",
                              )?.generatedExternally
                                ? "取消外部標記"
                                : "標記外部產生"}
                            </button>
                          </div>
                        ) : (
                          <p className="mt-4 rounded-lg border border-red-200 bg-white p-3 text-xs font-bold text-red-800">
                            課程限制或評量證據已調整，請使用上方按鈕重新產生單元節次藍圖。
                          </p>
                        )}
                      </div>

                      <details className="rounded-xl border border-indigo-200 bg-white">
                        <summary className="cursor-pointer px-4 py-3 text-sm font-black text-indigo-950">
                          查看 {unitBlueprint.lessons.length} 節藍圖摘要
                        </summary>
                        <ol className="grid gap-2 border-t border-indigo-200 p-4 md:grid-cols-2">
                          {unitBlueprint.lessons.map((lesson) => (
                            <li
                              key={lesson.id}
                              className="rounded-lg bg-indigo-50 p-3"
                            >
                              <p className="text-[10px] font-black uppercase text-indigo-700">
                                第 {lesson.lessonNumber} 節 · {lesson.minutes} 分鐘
                              </p>
                              <p className="mt-1 text-sm font-black text-indigo-950">
                                {lesson.title}
                              </p>
                              <p className="mt-1 text-xs font-medium leading-6 text-zinc-600">
                                {lesson.milestone}
                              </p>
                            </li>
                          ))}
                        </ol>
                      </details>

                      {false && <details
                        className="rounded-xl border border-indigo-300 bg-white"
                      >
                        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-black text-indigo-950">
                          <Pencil className="h-4 w-4" />
                          {unitBlueprintConfirmedAt
                            ? "查看已鎖定的單元節次藍圖"
                            : "逐欄編修與調整節次順序"}
                        </summary>
                        <fieldset
                          disabled={Boolean(unitBlueprintConfirmedAt)}
                          className="space-y-4 border-t border-indigo-200 p-4 disabled:opacity-75"
                        >
                          <label className="block text-xs font-black text-zinc-700">
                            單元學習歷程
                            <textarea
                              rows={3}
                              value={unitBlueprint!.unitArc}
                              onChange={(event) =>
                                updateUnitBlueprint((current) => ({
                                  ...current,
                                  unitArc: event.target.value,
                                }))
                              }
                              className="mt-1 w-full resize-y rounded-lg border border-indigo-200 p-3 text-xs font-medium leading-6"
                            />
                          </label>

                          {unitBlueprint!.lessons.map((lesson, lessonIndex) => (
                            <article
                              key={lesson.id}
                              className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h4 className="text-sm font-black text-indigo-950">
                                  第 {lesson.lessonNumber} 節
                                </h4>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    aria-label={`第 ${lesson.lessonNumber} 節上移`}
                                    disabled={lessonIndex === 0}
                                    onClick={() => moveLesson(lesson.id, -1)}
                                    className="rounded-lg border border-indigo-200 bg-white p-2 text-indigo-900 disabled:opacity-35"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`第 ${lesson.lessonNumber} 節下移`}
                                    disabled={
                                      lessonIndex ===
                                      unitBlueprint!.lessons.length - 1
                                    }
                                    onClick={() => moveLesson(lesson.id, 1)}
                                    className="rounded-lg border border-indigo-200 bg-white p-2 text-indigo-900 disabled:opacity-35"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <label className="text-xs font-black text-zinc-700">
                                  標題
                                  <input
                                    value={lesson.title}
                                    onChange={(event) =>
                                      updateLesson(
                                        lesson.id,
                                        "title",
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 w-full rounded-lg border border-indigo-200 bg-white p-2 text-xs font-medium"
                                  />
                                </label>
                                <label className="text-xs font-black text-zinc-700">
                                  分鐘數
                                  <input
                                    type="number"
                                    min={20}
                                    max={120}
                                    value={lesson.minutes}
                                    onChange={(event) =>
                                      updateLessonMinutes(
                                        lesson.id,
                                        Number(event.target.value),
                                      )
                                    }
                                    className="mt-1 w-full rounded-lg border border-indigo-200 bg-white p-2 text-xs font-medium"
                                  />
                                </label>
                                {[
                                  ["milestone", "里程碑"],
                                  ["learningIntention", "本節學習意圖"],
                                  ["coreTask", "核心學習任務"],
                                  ["formativeCheck", "形成性檢核"],
                                  ["decisionRule", "教學決策規則"],
                                  ["previousConnection", "與前一節銜接"],
                                  ["nextConnection", "與下一節／總結任務銜接"],
                                ].map(([field, label]) => (
                                  <label
                                    key={field}
                                    className={`text-xs font-black text-zinc-700 ${
                                      field === "decisionRule"
                                        ? "sm:col-span-2"
                                        : ""
                                    }`}
                                  >
                                    {label}
                                    <textarea
                                      rows={field === "decisionRule" ? 3 : 2}
                                      value={
                                        lesson[
                                          field as
                                            | "milestone"
                                            | "learningIntention"
                                            | "coreTask"
                                            | "formativeCheck"
                                            | "decisionRule"
                                            | "previousConnection"
                                            | "nextConnection"
                                        ]
                                      }
                                      onChange={(event) =>
                                        updateLesson(
                                          lesson.id,
                                          field as
                                            | "milestone"
                                            | "learningIntention"
                                            | "coreTask"
                                            | "formativeCheck"
                                            | "decisionRule"
                                            | "previousConnection"
                                            | "nextConnection",
                                          event.target.value,
                                        )
                                      }
                                      className="mt-1 w-full resize-y rounded-lg border border-indigo-200 bg-white p-2 text-xs font-medium leading-6"
                                    />
                                  </label>
                                ))}
                                <label className="text-xs font-black text-zinc-700">
                                  主要 6Cs 子向度
                                  <select
                                    value={lesson.primaryIndicatorId}
                                    onChange={(event) =>
                                      updateLessonIndicator(
                                        lesson.id,
                                        event.target.value,
                                      )
                                    }
                                    className="mt-1 w-full rounded-lg border border-indigo-200 bg-white p-2 text-xs font-medium"
                                  >
                                    {alignment!.recommendations.map(
                                      (recommendation) => {
                                        const indicator = getIndicatorById(
                                          recommendation.indicatorId,
                                        );
                                        return (
                                          <option
                                            key={recommendation.indicatorId}
                                            value={recommendation.indicatorId}
                                          >
                                            {indicator?.name ??
                                              recommendation.indicatorId}
                                          </option>
                                        );
                                      },
                                    )}
                                  </select>
                                </label>
                              </div>

                              {[
                                {
                                  label: "學習成果",
                                  field: "outcomeIds" as const,
                                  options:
                                    desiredResults?.outcomes.map((outcome) => ({
                                      id: outcome.id,
                                      label: outcome.statement,
                                    })) ?? [],
                                },
                                {
                                  label: "成功指標",
                                  field: "criterionIds" as const,
                                  options:
                                    desiredResults?.successCriteria.map(
                                      (criterion) => ({
                                        id: criterion.id,
                                        label: criterion.text,
                                      }),
                                    ) ?? [],
                                },
                                {
                                  label: "可觀察證據",
                                  field: "evidenceItemIds" as const,
                                  options:
                                    evidencePlan?.evidenceItems.map((item) => ({
                                      id: item.id,
                                      label: item.title,
                                    })) ?? [],
                                },
                                {
                                  label: "NPDL 四要素",
                                  field: "fourElementNames" as const,
                                  options: alignment!.fourElements.map(
                                    (element) => ({
                                      id: element.name,
                                      label: element.name,
                                    }),
                                  ),
                                },
                              ].map((group) => (
                                <fieldset key={group.field} className="mt-3">
                                  <legend className="text-[10px] font-black uppercase text-indigo-800">
                                    {group.label}
                                  </legend>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {group.options.map((option) => (
                                      <label
                                        key={option.id}
                                        title={option.label}
                                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-[10px] font-black text-zinc-700"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={(
                                            lesson[group.field] as string[]
                                          ).includes(option.id)}
                                          onChange={(event) =>
                                            toggleLessonArrayValue(
                                              lesson.id,
                                              group.field,
                                              option.id,
                                              event.target.checked,
                                            )
                                          }
                                          className="accent-indigo-700"
                                        />
                                        {option.id}
                                      </label>
                                    ))}
                                  </div>
                                </fieldset>
                              ))}
                            </article>
                          ))}
                        </fieldset>
                      </details>}

                      {false && (alignmentAudit.unitBlueprint === "stale" ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                          <p className="text-sm font-black text-red-900">
                            課程限制或評量證據已調整
                          </p>
                          <p className="mt-1 text-xs font-medium leading-6 text-red-800">
                            請使用上方「重新產生單元節次藍圖」，更新後即可再次啟用 Canvas。
                          </p>
                        </div>
                      ) : unitBlueprintConfirmedAt ? (
                        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-emerald-950">
                              藍圖已確認，Canvas 功能已開放
                            </p>
                            <p className="mt-1 text-xs font-medium text-emerald-800">
                              下方每一節都可直接預覽、複製或下載提示詞。
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={reopenUnitBlueprint}
                            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-xs font-black text-emerald-950 hover:bg-emerald-50"
                          >
                            <Pencil className="h-4 w-4" />
                            重新編輯藍圖
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-100/70 p-4 shadow-sm">
                          <p className="text-sm font-black text-indigo-950">
                            最後一步：確認藍圖後即可使用 Canvas
                          </p>
                          <p className="mt-1 text-xs font-medium leading-6 text-indigo-800">
                            系統會先檢查節次順序、成功指標覆蓋、診斷、總結與遷移證據。
                          </p>
                          <button
                            type="button"
                            onClick={confirmUnitBlueprint}
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 py-3 text-sm font-black text-white hover:bg-indigo-900"
                          >
                            <Check className="h-4 w-4" />
                            確認藍圖並啟用 Canvas
                          </button>
                        </div>
                      ))}

                      {false && unitBlueprint!.lessons.map((lesson) => {
                        const status = lessonPromptStatus.find(
                          (candidate) => candidate.lessonId === lesson.id,
                        );
                        const promptsReady =
                          alignmentAudit.desiredResults === "current" &&
                          alignmentAudit.evidencePlan === "current" &&
                          alignmentAudit.unitBlueprint === "current" &&
                          Boolean(evidencePlanConfirmedAt) &&
                          Boolean(unitBlueprintConfirmedAt);
                        return (
                          <article
                            key={lesson.id}
                            className="rounded-xl border border-indigo-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                                  第 {lesson.lessonNumber} 節 · {lesson.minutes} 分鐘
                                </p>
                                <h3 className="mt-1 text-base font-black text-indigo-950">
                                  {lesson.title}
                                </h3>
                                <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                                  {lesson.milestone}
                                </p>
                              </div>
                              {status?.generatedExternally && (
                                <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-[9px] font-black text-emerald-900">
                                  已在外部產生
                                </span>
                              )}
                            </div>
                            <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                              <p className="rounded-lg bg-indigo-50 p-3 font-medium leading-6 text-zinc-700">
                                <span className="font-black text-indigo-800">
                                  學習意圖：
                                </span>
                                {lesson.learningIntention}
                              </p>
                              <p className="rounded-lg bg-indigo-50 p-3 font-medium leading-6 text-zinc-700">
                                <span className="font-black text-indigo-800">
                                  核心任務：
                                </span>
                                {lesson.coreTask}
                              </p>
                              <p className="rounded-lg bg-emerald-50 p-3 font-medium leading-6 text-emerald-950 md:col-span-2">
                                <span className="font-black">形成性證據：</span>
                                {lesson.formativeCheck}
                                <br />
                                <span className="font-black">教學決策：</span>
                                {lesson.decisionRule}
                              </p>
                            </div>
                            <p className="mt-3 text-[10px] font-black leading-5 text-zinc-500">
                              成果 {lesson.outcomeIds.join("、")} · 成功指標{" "}
                              {lesson.criterionIds.join("、")} · 證據{" "}
                              {lesson.evidenceItemIds.join("、")}
                            </p>
                            {!promptsReady &&
                              alignmentAudit.unitBlueprint === "stale" && (
                                <p className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-800">
                                  課程限制或評量證據已調整，請重新產生藍圖。
                                </p>
                              )}
                            {!promptsReady &&
                              alignmentAudit.unitBlueprint === "current" &&
                              !unitBlueprintConfirmedAt && (
                                <p className="mt-3 rounded-lg bg-indigo-50 p-3 text-xs font-bold text-indigo-900">
                                  藍圖已產生；請按節次清單上方的「確認藍圖並啟用 Canvas」。
                                </p>
                              )}
                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                              <button
                                type="button"
                                onClick={previewUnitPrompt}
                                disabled={!promptsReady}
                                className="flex items-center justify-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-900 hover:bg-indigo-50 disabled:opacity-40"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                預覽
                              </button>
                              <button
                                type="button"
                                onClick={copyUnitPrompt}
                                disabled={!promptsReady}
                                className="flex items-center justify-center gap-1 rounded-lg bg-indigo-800 px-3 py-2 text-xs font-black text-white hover:bg-indigo-900 disabled:opacity-40"
                              >
                                <Clipboard className="h-3.5 w-3.5" />
                                複製完整提示詞
                              </button>
                              <button
                                type="button"
                                onClick={downloadUnitPrompt}
                                disabled={!promptsReady}
                                className="flex items-center justify-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-900 hover:bg-indigo-50 disabled:opacity-40"
                              >
                                <Download className="h-3.5 w-3.5" />
                                下載 Markdown
                              </button>
                              <a
                                href="https://gemini.google.com/app"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-black text-indigo-900 hover:bg-indigo-50 ${
                                  promptsReady
                                    ? ""
                                    : "pointer-events-none opacity-40"
                                }`}
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                開啟 Gemini
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  updateLessonPromptStatus(lesson.id, {
                                    generatedExternally:
                                      !status?.generatedExternally,
                                  })
                                }
                                disabled={!promptsReady}
                                className="flex items-center justify-center gap-1 rounded-lg border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-900 hover:bg-emerald-50 disabled:opacity-40"
                              >
                                <Check className="h-3.5 w-3.5" />
                                {status?.generatedExternally
                                  ? "取消外部標記"
                                  : "標記外部產生"}
                              </button>
                            </div>
                          </article>
                        );
                      })}

                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-emerald-950">
                        {alignmentAudit.desiredResults === "current" &&
                        alignmentAudit.evidencePlan === "current" &&
                        evidencePlanConfirmedAt
                          ? "已可帶入評量設計"
                          : "完成終點與證據後可帶入評量"}
                      </h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-emerald-800">
                        將帶入年級、學科、課程名稱、課綱原文、學習終點、成功指標與完整證據脈絡；舊 handoff 與現有評量仍可讀取。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handoffToAssessment}
                      disabled={
                        alignmentAudit.desiredResults !== "current" ||
                        alignmentAudit.evidencePlan !== "current" ||
                        !evidencePlanConfirmedAt
                      }
                      className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173f36] px-5 py-3 text-sm font-black text-white hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      帶入評量設計
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </main>

      <ConsentModal
        open={consentOpen}
        provider={providerName(settings.model)}
        modelLabel={modelLabel}
        purpose={
          pendingAction === "align"
            ? "108 課綱與 6Cs 校準、學習成果生成"
            : pendingAction === "evidence"
              ? "逆向設計評量證據生成"
              : pendingAction === "blueprint"
                ? "單元節次藍圖生成"
                : "核心關鍵字分析"
        }
        payload={pendingPrompt ? promptText(pendingPrompt) : ""}
        onCancel={() => {
          setConsentOpen(false);
          setPendingAction(null);
        }}
        onConfirm={confirmConsent}
      />
      <PromptPreviewModal
        promptPackage={promptPreview}
        notice={copyNotice}
        onClose={() => {
          setPromptPreview(null);
          setCopyNotice(null);
        }}
        onCopy={(text, label) => {
          if (promptPreview) {
            void copyPromptText(promptPreview, text, label);
          }
        }}
      />
      <CourseIdeationSettingsModal
        open={settingsOpen}
        geminiKey={settings.geminiKey}
        openaiKey={settings.openaiKey}
        xaiKey={settings.xaiKey}
        model={settings.model}
        testing={testingConnection}
        connectionStatus={connectionStatus}
        onClose={() => setSettingsOpen(false)}
        onChange={(patch) => setSettings((current) => ({ ...current, ...patch }))}
        onTest={() => void testConnection()}
        onClearProvider={() => {
          setConnectionStatus(null);
          setSettings((current) => {
            const provider = getCourseIdeationProvider(current.model);
            if (provider === "openai") return { ...current, openaiKey: "" };
            if (provider === "xai") return { ...current, xaiKey: "" };
            return { ...current, geminiKey: "" };
          });
        }}
        onClearAll={() => {
          setConnectionStatus(null);
          setSettings((current) => ({
            ...current,
            geminiKey: "",
            openaiKey: "",
            xaiKey: "",
          }));
        }}
      />
    </div>
  );
}
