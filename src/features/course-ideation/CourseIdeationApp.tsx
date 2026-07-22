import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
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
  FileUp,
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
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { GRADES, SUBJECT_CHIPS } from "@/data/constants";
import {
  COURSE_IDEATION_EXAMPLES,
  DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
  createCourseIdeationExampleInput,
} from "@/data/course-ideation-examples";
import { getIndicatorById } from "@/data/indicators";
import {
  designReferenceLabel,
  designStageWithFocus,
  evidenceItemTypeLabel,
  implementationGroupLabel,
  implementationItemLabel,
  implementationItemWithFocus,
  questionKeyToIndex,
} from "@/lib/assessment-terminology";
import {
  generateContent,
  type GenerationPromptParts,
} from "@/lib/ai/client";
import {
  buildCourseAlignmentPrompt,
  buildCourseIdeationHandoff,
  buildKeywordAnalysisPrompt,
  courseIdeationHandoffToForm,
  CourseIdeationResponseError,
  COURSE_IDEATION_RESPONSE_ERROR_MESSAGE,
  getCourseAlignmentSchema,
  KEYWORD_ANALYSIS_SCHEMA,
  normalizeCoreKeywords,
  parseCourseAlignment,
  parseKeywordAnalysis,
  sanitizeGeneratedText,
  validateCourseIdeationInput,
} from "@/lib/course-ideation";
import {
  createCustomCurriculumEntry,
  CURRICULUM_SNAPSHOT_VERSION,
  CURRICULUM_TIER_LABELS,
  getCurriculumCandidates,
  getCurriculumEntry,
  getCurriculumOptions,
  getCurriculumTierMap,
  type CurriculumTier,
} from "@/lib/curriculum";
import {
  COURSE_IDEATION_MODEL_OPTIONS,
  getCourseIdeationProvider,
} from "@/lib/course-ideation-ai";
import {
  buildCourseCardRevisionPrompt,
  buildCourseCardRevisionRepairPrompt,
  courseCardRevisionLabel,
  getCourseCardValue,
  getCourseCardRevisionSchema,
  getCourseCardRevisionStructuredName,
  parseCourseCardRevisionPatch,
  replaceCourseCardValue,
  type CourseCardRevisionTarget,
  type CourseRevisionParent,
} from "@/lib/course-ai-revision";
import {
  buildLessonReferenceAnalysisPrompt,
  buildLessonReferenceRepairPrompt,
  extractLessonReferenceFromPaste,
  extractLessonReferenceText,
  LESSON_REFERENCE_ANALYSIS_SCHEMA,
  parseLessonReferenceAnalysis,
  type ExtractedLessonReference,
} from "@/lib/lesson-reference";
import {
  launchUnitDocumentInCanvas,
  type UnitCanvasDocumentKind,
} from "@/lib/unit-canvas-generation";
import {
  buildDesiredResults,
  buildAssessmentDesignContext,
  buildEvidencePlanPrompt,
  buildEvidencePlanRepairPrompt,
  buildUnitPromptPackage,
  buildUnitWorksheetPromptPackage,
  buildUnitPrepCoachGemPackage,
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
import {
  buildCourseAssessmentSourceFingerprint,
  COURSE_ASSESSMENT_SEED_SCHEMA,
  isCourseAssessmentSeedCurrent,
  parseCourseAssessmentSeed,
  renderCourseAssessmentSeedMarkdown,
  validateCourseAssessmentSeed,
} from "@/lib/course-assessment";
import {
  renderDiagnosticQuestionsMarkdown,
  renderDiagnosticTeacherGuideMarkdown,
} from "@/lib/diagnostic-export-documents";
import {
  buildCourseAssessmentSeedPrompt,
  buildCourseAssessmentSeedRepairPrompt,
} from "@/prompts";
import { splitModules } from "@/lib/markdown";
import { parseNarrativeModule } from "@/lib/parse-narrative";
import { NarrativeSectionBody } from "@/features/output/NarrativeSectionBody";
import {
  AssessmentQuestionDetail,
  assessmentQuestionPreviewLine,
} from "@/features/output/AssessmentQuestionDisplay";
import { parseAssessmentModule } from "@/lib/parse-assessment";
import {
  NextActionPanel,
  SectionStatusBadge,
  type WorkflowAction,
  type WorkflowStepStatus,
} from "@/features/course-ideation/CourseWorkflowChrome";
import { CoursePostAssessmentPanel } from "@/features/course-ideation/CoursePostAssessmentPanel";
import { toUserErrorMessage } from "@/lib/errors";
import {
  assessmentExportFingerprint,
  createGoogleFormsFromAssessment,
  getGoogleFormsModuleExportIssue,
  isGoogleFormExportEntryComplete,
  type GoogleFormsExportRecord,
} from "@/lib/google-forms";
import { GoogleFormsSettingsModal } from "@/features/settings/GoogleFormsSettingsModal";
import { useGoogleOAuthClientId } from "@/hooks/useGoogleOAuthClientId";
import { downloadTeacherDocumentDocx } from "@/lib/teacher-document-docx";
import {
  KEYS,
  readJson,
  removeStorage,
  writeJson,
} from "@/lib/storage";
import type {
  CourseAlignmentResult,
  CourseAssessmentSeedV1,
  AppliedLessonReference,
  CourseIdeationInput,
  CourseOriginMode,
  CurriculumEntry,
  CurriculumKind,
  CurriculumSelection,
  CurriculumRecommendation,
  DesiredResults,
  EvidencePlanResult,
  EvidenceQuestionMap,
  KeywordAnalysisResult,
  LessonReferenceAnalysis,
  LearningDesignProjectV1,
  LessonPromptPackage,
  LessonPromptStatus,
  UnitBlueprintResult,
  UnitConstraints,
  UnitLessonBlueprint,
  WorkflowState,
} from "@/types/course-ideation";
import type { SharedAiSettings } from "@/types/studio";

export interface CourseIdeationAppProps {
  embedded?: boolean;
  active?: boolean;
  aiSettings: SharedAiSettings;
  onOpenAiSettings: () => void;
  /** @deprecated 合併版改同頁進入課後步驟，不再跨工作區交接 */
  onOpenAssessment?: (project: LearningDesignProjectV1) => void;
  onProjectChange?: (project: LearningDesignProjectV1) => void;
}

interface CourseIdeationDraft {
  courseOriginMode?: CourseOriginMode | null;
  input: CourseIdeationInput;
  analysis: KeywordAnalysisResult | null;
  alignment: CourseAlignmentResult | null;
  curriculumSelection?: CurriculumSelection | null;
  curriculumRecommendation?: CurriculumRecommendation | null;
  customCurriculumEntries?: CurriculumEntry[];
  lessonReferenceAnalysis?: LessonReferenceAnalysis | null;
  appliedLessonReference?: AppliedLessonReference | null;
  selectedIndicatorId: string;
  projectId?: string;
  projectCreatedAt?: number;
  desiredResults?: DesiredResults | null;
  desiredResultsConfirmedAt?: number | null;
  evidencePlan?: EvidencePlanResult | null;
  evidencePlanConfirmedAt?: number | null;
  courseAssessmentSeed?: CourseAssessmentSeedV1 | null;
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

type AiAction =
  | "analyze"
  | "align"
  | "evidence"
  | "assessment_seed"
  | "blueprint"
  | "reference";

type CourseDesignTabId =
  | "alignment"
  | "desired-results"
  | "evidence"
  | "assessment-seed"
  | "delivery"
  | "post-assessment";

const drawerSpring = { type: "spring" as const, bounce: 0, duration: 0.3 };
const tabFade = { duration: 0.2 };

type EvidencePanelId =
  | "performance-task"
  | "questions"
  | "evidence-items"
  | "rubric"
  | "edit";

const DEFAULT_INPUT = createCourseIdeationExampleInput(
  DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
);

const CONSENT_VERSION = 3;
const DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;

function resolveInitialOriginMode(
  draft: CourseIdeationDraft | null,
  project: LearningDesignProjectV1 | null,
): CourseOriginMode | null {
  const fromDraft = draft?.courseOriginMode;
  if (fromDraft === "existing" || fromDraft === "new") return fromDraft;
  const fromProject = project?.courseOriginMode;
  if (fromProject === "existing" || fromProject === "new") return fromProject;
  if (draft?.appliedLessonReference || project?.appliedLessonReference) {
    return "existing";
  }
  if (draft?.analysis || project?.analysis) return "new";
  return null;
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

function narrativeLevelKey(
  label: string,
): "evidenceLimited" | "emerging" | "developing" | "mastering" | null {
  if (label.includes("證據有限")) return "evidenceLimited";
  if (label.includes("萌芽")) return "emerging";
  if (label.includes("發展")) return "developing";
  if (label.includes("精熟")) return "mastering";
  return null;
}

function revisionParentForTarget(
  target: CourseCardRevisionTarget,
  values: {
    analysis: KeywordAnalysisResult | null;
    alignment: CourseAlignmentResult | null;
    evidencePlan: EvidencePlanResult | null;
    courseAssessmentSeed: CourseAssessmentSeedV1 | null;
    unitBlueprint: UnitBlueprintResult | null;
  },
): CourseRevisionParent | null {
  if (
    target.kind === "keyword_summary" ||
    target.kind === "keyword_theme" ||
    target.kind === "curriculum_signal" ||
    target.kind === "suggested_keywords"
  ) {
    return values.analysis;
  }
  if (
    target.kind === "curriculum_rationale" ||
    target.kind === "six_c_recommendation" ||
    target.kind === "desired_result" ||
    target.kind === "learning_outcome" ||
    target.kind === "four_element" ||
    target.kind === "evidence_tools"
  ) {
    return values.alignment;
  }
  if (target.kind === "unit_arc" || target.kind === "lesson") {
    return values.unitBlueprint;
  }
  if (target.kind === "course_narrative_level") {
    return values.courseAssessmentSeed;
  }
  return values.evidencePlan;
}

function formatSuccessCriteriaLabels(
  criterionIds: string[],
  criteria: Array<{ id: string; text: string }> | null | undefined,
): string {
  if (criterionIds.length === 0) return "尚未選取";
  return criterionIds
    .map((id) => {
      const match = criteria?.find((item) => item.id === id);
      const text = match?.text?.trim();
      return text || id;
    })
    .join("；");
}

function successCriterionLabel(
  criterionId: string,
  criteria: Array<{ id: string; text: string }> | null | undefined,
): string {
  const match = criteria?.find((item) => item.id === criterionId);
  const text = match?.text?.trim();
  return text || criterionId;
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
        引用學習終點的成功指標
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {criteria.map((criterion) => (
          <label
            key={criterion.id}
            title={criterion.id}
            className="flex max-w-full cursor-pointer items-start gap-2 rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-[10px] font-bold leading-5 text-zinc-700"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(criterion.id)}
              onChange={(event) =>
                onToggle(criterion.id, event.target.checked)
              }
              className="mt-0.5 shrink-0 accent-amber-700"
            />
            <span className="min-w-0">
              <span className="block font-black text-amber-950">
                {sanitizeGeneratedText(criterion.text)}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const COURSE_TYPE_LABELS: Record<CurriculumEntry["courseType"], string> = {
  required: "必修",
  elective: "選修",
  all: "共同／全類型",
};

const PERFORMANCE_CATEGORY_LABELS: Record<string, Record<string, string>> = {
  自然科學: {
    a: "科學態度與科學本質",
    p: "問題解決與探究實作",
    t: "思考智能",
  },
  數學: {
    a: "代數",
    d: "資料與不確定性",
    f: "函數",
    g: "坐標幾何",
    n: "數與量",
    s: "空間與形狀",
  },
  國語文: {
    "1": "聆聽",
    "2": "口語表達",
    "4": "識字與寫字",
    "5": "閱讀",
    "6": "寫作",
  },
  英語文: {
    "1": "聆聽",
    "2": "口說",
    "3": "閱讀",
    "4": "寫作",
    "5": "綜合應用",
    "6": "學習興趣與態度",
    "7": "學習方法與策略",
    "8": "文化理解",
    "9": "邏輯思考與創造力",
  },
};

function curriculumCodeHead(entry: CurriculumEntry): string {
  return entry.code.split("-")[0]?.trim() || "其他";
}

function curriculumMajorCode(entry: CurriculumEntry): string {
  const head = curriculumCodeHead(entry)
    .replace(/^(地|歷|公)/, "")
    .replace(/^(P|C|B|E)(?=[A-Z])/, "$1");
  const scienceSpecific = head.match(/^[PCBE][A-Z]/)?.[0];
  if (scienceSpecific) return scienceSpecific;
  return head.match(/^[A-Za-z]/)?.[0]?.toUpperCase() ??
    head.match(/^\d/)?.[0] ??
    "其他";
}

function curriculumOptionCategory(entry: CurriculumEntry): {
  key: string;
  label: string;
} {
  const courseType = COURSE_TYPE_LABELS[entry.courseType];
  if (entry.kind === "learning_performance") {
    const head = curriculumCodeHead(entry).replace(/^(地|歷|公)/, "");
    const family = head.charAt(0).toLowerCase();
    const mapped =
      PERFORMANCE_CATEGORY_LABELS[entry.subject]?.[family] ??
      (["地理", "歷史", "公民與社會"].includes(entry.subject)
        ? {
            "1": "理解與解釋",
            "2": "態度與價值",
            "3": "實作與參與",
          }[family]
        : undefined);
    const category = mapped ?? `${family.toUpperCase() || "其他"} 類表現`;
    return {
      key: `${entry.subject}-${entry.courseType}-${category}`,
      label: `${entry.subject}｜${courseType}｜${category}`,
    };
  }

  const majorCode = curriculumMajorCode(entry);
  const mathLabels: Record<string, string> = {
    A: "代數",
    D: "資料與不確定性",
    F: "函數",
    G: "坐標幾何",
    N: "數與量",
    S: "空間與形狀",
  };
  const languageLabels: Record<string, Record<string, string>> = {
    國語文: {
      A: "語文知識",
      B: "文本表述",
      C: "文化內涵",
    },
    英語文: {
      A: "語言知識",
      B: "溝通功能",
      C: "文化與習俗",
      D: "思考能力",
    },
  };
  const category =
    (entry.subject === "數學" ? mathLabels[majorCode] : undefined) ??
    languageLabels[entry.subject]?.[majorCode] ??
    `${majorCode} 類內容`;
  return {
    key: `${entry.subject}-${entry.courseType}-${majorCode}`,
    label: `${entry.subject}｜${courseType}｜${category}`,
  };
}

function CurriculumOptionCard({
  entry,
  checked,
  recommended,
  tier,
  disabled,
  onToggle,
}: {
  entry: CurriculumEntry;
  checked: boolean;
  recommended: boolean;
  tier?: CurriculumTier;
  disabled: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 rounded-lg border p-3 ${
        checked
          ? "border-[#2f7d68] bg-emerald-50"
          : disabled
            ? "cursor-not-allowed border-zinc-200 bg-zinc-50 opacity-50"
            : "cursor-pointer border-[#dfe8e2] bg-white hover:border-[#9fc2b4]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onToggle(entry.id, event.target.checked)}
        className="mt-1 accent-emerald-800"
      />
      <span className="min-w-0 text-[11px] font-medium leading-5 text-zinc-700">
        <span className="flex flex-wrap items-center gap-1.5">
          <strong className="text-[#173f36]">{entry.code}</strong>
          {recommended && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black text-violet-800">
              AI 推薦
            </span>
          )}
          {tier === 1 && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] font-black text-sky-900">
              {CURRICULUM_TIER_LABELS[1]}
            </span>
          )}
          {tier === 2 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black text-indigo-900">
              {CURRICULUM_TIER_LABELS[2]}
            </span>
          )}
          {entry.sourceVersion === "unverified" && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-900">
              教師自訂／未核對
            </span>
          )}
        </span>
        <span className="mt-1 block">{entry.text}</span>
        <span className="mt-1 block text-[9px] font-bold text-zinc-500">
          {entry.subject} · 第 {entry.stage} 階段 ·{" "}
          {COURSE_TYPE_LABELS[entry.courseType]} · {entry.sourceDocumentTitle}
        </span>
      </span>
    </label>
  );
}

function CurriculumMultiSelect({
  title,
  entries,
  selectedIds,
  recommendedIds,
  tierById,
  maximum,
  onToggle,
}: {
  title: string;
  entries: CurriculumEntry[];
  selectedIds: string[];
  recommendedIds: string[];
  tierById: Map<string, CurriculumTier>;
  maximum: number;
  onToggle: (id: string, checked: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = entries.filter((entry) =>
    `${entry.code} ${entry.text} ${entry.subject}`
      .toLowerCase()
      .includes(normalizedSearch),
  );
  const recommended = new Set(recommendedIds);
  const recommendedEntries = recommendedIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is CurriculumEntry => Boolean(entry));
  const selectedEntries = selectedIds
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is CurriculumEntry => Boolean(entry));

  const suggestionEntries = filtered
    .filter((entry) => {
      const tier = tierById.get(entry.id);
      return tier === 1 || tier === 2;
    })
    .sort((left, right) => {
      const leftTier = tierById.get(left.id) ?? 3;
      const rightTier = tierById.get(right.id) ?? 3;
      if (leftTier !== rightTier) return leftTier - rightTier;
      return left.code.localeCompare(right.code, "zh-Hant", { numeric: true });
    });

  const displayRecommended =
    recommendedEntries.length > 0
      ? recommendedEntries
      : suggestionEntries.slice(0, 12);

  const displayRecommendedIds = new Set(displayRecommended.map((entry) => entry.id));
  const otherEntries = filtered.filter((entry) => !displayRecommendedIds.has(entry.id));
  const groups = Array.from(
    otherEntries.reduce((map, entry) => {
      const tier = tierById.get(entry.id);
      const category =
        tier === 3
          ? { key: "tier-3", label: CURRICULUM_TIER_LABELS[3] }
          : curriculumOptionCategory(entry);
      const current = map.get(category.key) ?? {
        label: category.label,
        entries: [] as CurriculumEntry[],
      };
      current.entries.push(entry);
      map.set(category.key, current);
      return map;
    }, new globalThis.Map<string, { label: string; entries: CurriculumEntry[] }>()),
  )
    .map(([key, group]) => ({
      key,
      ...group,
      entries: group.entries.sort((left, right) => {
        const leftTier = tierById.get(left.id) ?? 3;
        const rightTier = tierById.get(right.id) ?? 3;
        if (leftTier !== rightTier) return leftTier - rightTier;
        return left.code.localeCompare(right.code, "zh-Hant", { numeric: true });
      }),
    }))
    .sort((left, right) => {
      if (left.key === "tier-3") return -1;
      if (right.key === "tier-3") return 1;
      return left.label.localeCompare(right.label, "zh-Hant");
    });

  const renderOption = (entry: CurriculumEntry, isRecommended: boolean) => {
    const checked = selectedIds.includes(entry.id);
    const atLimit = selectedIds.length >= maximum && !checked;
    return (
      <CurriculumOptionCard
        key={entry.id}
        entry={entry}
        checked={checked}
        recommended={isRecommended && recommended.has(entry.id)}
        tier={tierById.get(entry.id)}
        disabled={atLimit}
        onToggle={onToggle}
      />
    );
  };

  return (
    <section className="mt-5 rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-zinc-800">{title}</h3>
        <span className="text-[10px] font-black text-zinc-500">
          已選 {selectedIds.length}/{maximum} · 受控清單 {entries.length} 項 · 可不選
        </span>
      </div>
      {selectedEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onToggle(entry.id, false)}
              className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-[10px] font-black text-emerald-950"
              aria-label={`取消選取 ${entry.code}`}
            >
              {entry.code}
              {recommended.has(entry.id) && (
                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[8px] font-black text-violet-800">
                  AI 推薦
                </span>
              )}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
      <div
        className="mt-4 rounded-xl border-2 border-violet-200 bg-violet-50 p-3"
        aria-label={`建議梯隊${title}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-violet-950">
              {recommendedEntries.length > 0 ? `AI 推薦的${title}` : `建議梯隊${title}`}
            </p>
            <p className="mt-1 text-[10px] font-bold text-violet-700">
              依「建議優先 → 同科類似概念」排序；可不選，或最多選 {maximum}{" "}
              項。跨梯隊勾選亦可。
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-violet-200 px-2.5 py-1 text-[10px] font-black text-violet-900">
            {displayRecommended.length} 項
          </span>
        </div>
        {displayRecommended.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {displayRecommended.map((entry) =>
              renderOption(entry, recommended.has(entry.id)),
            )}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-violet-300 bg-white/70 p-3 text-xs font-bold leading-5 text-violet-800">
            目前此科目尚無可對應的官方 108 條目。可略過課綱直接按上方完成 6Cs
            校準，或改選科目／加入教師自訂依據後再選。
          </div>
        )}
      </div>
      <details className="mt-3 rounded-xl border border-[#cbdad2] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-xs font-black text-[#173f36]">
          <span>
            其他可選{title}
            <span className="ml-2 text-[10px] text-zinc-500">
              {otherEntries.length} 項 · 含同科其他
            </span>
          </span>
          <ChevronDown className="h-4 w-4" />
        </summary>
        <div className="border-t border-[#dfe8e2] p-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="輸入課綱代碼、原文或科目"
            aria-label={`搜尋${title}`}
            className="w-full rounded-lg border border-[#dfe8e2] px-3 py-2 text-xs font-medium outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
          />
          <div className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
            {groups.map((group) => (
              <details
                key={group.key}
                open={normalizedSearch.length > 0 ? true : undefined}
                className="rounded-lg border border-[#dfe8e2] bg-[#f7faf8]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-[11px] font-black text-[#173f36]">
                  <span>{group.label}</span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] text-zinc-500">
                    {group.entries.length} 項
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </summary>
                <div className="grid gap-2 border-t border-[#dfe8e2] p-2">
                  {group.entries.map((entry) => renderOption(entry, false))}
                </div>
              </details>
            ))}
            {otherEntries.length === 0 && (
              <p className="rounded-lg bg-zinc-50 p-3 text-center text-xs font-bold text-zinc-500">
                {normalizedSearch
                  ? "其他條目中找不到符合代碼、原文或科目的結果。"
                  : "目前沒有建議梯隊以外的其他條目。"}
              </p>
            )}
          </div>
        </div>
      </details>
    </section>
  );
}

function AiRevisionButton({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#9fc2b4] bg-white px-3 py-2 text-xs font-black text-[#175247] shadow-sm hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Sparkles className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

interface ContentDrawerContent {
  eyebrow: string;
  title: string;
  body: ReactNode;
}

function ContentDrawer({
  content,
  onClose,
}: {
  content: ContentDrawerContent | null;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {content && (
        <motion.div
          className="fixed inset-0 z-[75] flex justify-end bg-zinc-950/35 p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduceMotion ? tabFade : undefined}
        >
          <button
            type="button"
            aria-label="關閉內容抽屜"
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-content-drawer-title"
            className="relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-[#dfe8e2] bg-white/95 shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:border"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={reduceMotion ? tabFade : drawerSpring}
            style={{ transformOrigin: "right center" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#dfe8e2] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
                  {content.eyebrow}
                </p>
                <h2
                  id="course-content-drawer-title"
                  className="mt-1 text-lg font-black text-zinc-950"
                >
                  {content.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
                aria-label="關閉內容"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {content.body}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DrawerText({
  label,
  text,
  onOpen,
  tone = "amber",
}: {
  label: string;
  text: string;
  onOpen: (content: ContentDrawerContent) => void;
  tone?: "amber" | "emerald" | "sky" | "cyan" | "indigo" | "zinc";
}) {
  const cleanText = text.trim();
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
    zinc: "border-[#dfe8e2] bg-[#f7faf8] text-zinc-800",
  };
  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-black">{label}</p>
        <button
          type="button"
          onClick={() =>
            onOpen({
              eyebrow: "完整內容",
              title: label,
              body: (
                <p className="whitespace-pre-wrap text-sm font-medium leading-7 text-zinc-700">
                  {cleanText || "（尚無內容）"}
                </p>
              ),
            })
          }
          className="shrink-0 rounded-lg border border-black/10 bg-white px-2.5 py-1 text-[10px] font-black text-zinc-700 hover:bg-zinc-50"
        >
          查看完整內容
        </button>
      </div>
      <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-zinc-700">
        {cleanText || "（尚無內容）"}
      </p>
    </div>
  );
}

function EvidenceText({
  label,
  text,
  tone = "amber",
}: {
  label: string;
  text: string;
  tone?: "amber" | "emerald" | "sky" | "cyan" | "indigo" | "zinc";
}) {
  const toneClasses = {
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-950",
    sky: "border-sky-200 bg-sky-50 text-sky-950",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-950",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-950",
    zinc: "border-[#dfe8e2] bg-[#f7faf8] text-zinc-800",
  };
  return (
    <div className={`rounded-lg border p-3 ${toneClasses[tone]}`}>
      <p className="text-xs font-black">{label}</p>
      <p className="mt-2 whitespace-pre-wrap text-xs font-medium leading-6 text-zinc-700">
        {text.trim() || "（尚無內容）"}
      </p>
    </div>
  );
}

function CourseTabs({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: Array<{
    id: CourseDesignTabId;
    label: string;
    status: WorkflowStepStatus;
    disabled?: boolean;
  }>;
  activeTab: CourseDesignTabId;
  onChange: (tab: CourseDesignTabId) => void;
}) {
  return (
    <nav
      aria-label="課程設計分頁"
      className="rounded-2xl border border-white/60 bg-white/75 p-2 shadow-sm backdrop-blur-xl backdrop-saturate-150"
    >
      <div
        role="tablist"
        className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={`min-h-11 min-w-[8.5rem] rounded-xl border px-3 py-2 text-left text-xs font-black tracking-tight transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 lg:min-w-0 ${
              activeTab === tab.id
                ? "border-[#173f36] bg-[#173f36] text-white shadow-sm"
                : "border-transparent bg-[#f7faf8] text-zinc-600 hover:bg-[#eef4f0] hover:text-zinc-900"
            }`}
          >
            <span className="block tracking-tight">{tab.label}</span>
            <SectionStatusBadge
              status={tab.status}
              label={
                tab.status === "done"
                  ? "完成"
                  : tab.status === "review"
                    ? "待確認"
                    : tab.status === "stale"
                      ? "需更新"
                      : tab.status === "ready"
                        ? "可進行"
                        : tab.status === "working"
                          ? "進行中"
                          : "未開放"
              }
            />
          </button>
        ))}
      </div>
    </nav>
  );
}

function InputDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[74] flex justify-end bg-zinc-950/35 p-0 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={reduceMotion ? tabFade : undefined}
        >
          <button
            type="button"
            aria-label="關閉課程輸入抽屜"
            className="absolute inset-0"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-input-drawer-title"
            className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-[#dfe8e2] bg-white/95 shadow-2xl backdrop-blur-xl sm:rounded-2xl sm:border"
            initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
            transition={reduceMotion ? tabFade : drawerSpring}
            style={{ transformOrigin: "right center" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#dfe8e2] px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
                  輸入端
                </p>
                <h2
                  id="course-input-drawer-title"
                  className="mt-1 text-lg font-black text-zinc-950"
                >
                  編輯課程輸入
                </h2>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                  調整課程欄位、關鍵字與教案附件，不佔用主工作區。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
                aria-label="關閉課程輸入"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {children}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
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
                將傳送課程欄位、核心關鍵字、課綱候選、後續產生的學習終點、評量證據、節次藍圖、教師輸入的 AI 修改要求；若本次用途是分析既有教案，也會傳送附件擷取文字。API Key、檔名與原始檔案不會成為提示內容。上傳前請先移除學生姓名與其他個資；若日後切換供應商，後續資料會送往新選擇的供應商。
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

function promptPreviewKindLabel(promptPackage: LessonPromptPackage): {
  title: string;
  subtitle: string;
  taskLabel: string;
  fullLabel: string;
  gemLabel: string;
} {
  if (promptPackage.lessonId === "unit-worksheets") {
    return {
      title: "學習單提示詞預覽",
      subtitle:
        "此提示詞產出「學生版」與「教師參考解答版」兩部分；學生版可直接列印，教師版含參考解答；不含備課教案。",
      taskLabel: "學習單任務資料",
      fullLabel: "完整 Canvas 提示詞",
      gemLabel: "Gem 固定設定",
    };
  }
  if (promptPackage.lessonId === "unit-prep-coach-gem") {
    return {
      title: "備課諮詢 Gem 指令預覽",
      subtitle:
        "一鍵複製後，整段貼進 Gemini Gem「自訂指令」即可使用；已內嵌校準、學習終點、評量證據與節次藍圖，無需另附檔。",
      taskLabel: "建立步驟（僅供參考）",
      fullLabel: "完整建立說明＋指令",
      gemLabel: "一鍵貼上用｜Gem 自訂指令（含設計錨點）",
    };
  }
  if (promptPackage.lessonId === "unit-all") {
    return {
      title: "教師備課提示詞預覽",
      subtitle:
        "此提示詞只產出全部節次教師備課教案；不含學生學習單。可直接貼入 Gemini Canvas。",
      taskLabel: "教師備課任務資料",
      fullLabel: "完整 Canvas 提示詞",
      gemLabel: "Gem 固定設定",
    };
  }
  return {
    title: "Gemini Canvas 提示詞預覽",
    subtitle: "可直接貼入 Gemini Canvas，或分別建立私人 Gem 與貼入任務資料。",
    taskLabel: "任務資料",
    fullLabel: "完整 Canvas 提示詞",
    gemLabel: "Gem 固定設定",
  };
}

function PromptPreviewModal({
  promptPackage,
  notice,
  onClose,
  onCopy,
}: PromptPreviewModalProps) {
  const kindLabels = promptPackage
    ? promptPreviewKindLabel(promptPackage)
    : null;
  return (
    <AnimatePresence>
      {promptPackage && kindLabels && (
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
                  {kindLabels.title}
                </h2>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  {kindLabels.subtitle}
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
                  label: kindLabels.fullLabel,
                  copyLabel: kindLabels.fullLabel,
                  value: promptPackage.fullPrompt,
                },
                {
                  label: kindLabels.gemLabel,
                  copyLabel: kindLabels.gemLabel,
                  value: promptPackage.gemInstructions,
                },
                {
                  label: kindLabels.taskLabel,
                  copyLabel: kindLabels.taskLabel,
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

interface AiRevisionDraft {
  target: CourseCardRevisionTarget;
  before: unknown;
  value: unknown;
  parent: CourseRevisionParent;
}

interface AiRevisionModalProps {
  target: CourseCardRevisionTarget | null;
  instruction: string;
  draft: AiRevisionDraft | null;
  busy: boolean;
  error: string | null;
  onInstructionChange: (value: string) => void;
  onGenerate: () => void;
  onApply: () => void;
  onClose: () => void;
}

function AiRevisionModal({
  target,
  instruction,
  draft,
  busy,
  error,
  onInstructionChange,
  onGenerate,
  onApply,
  onClose,
}: AiRevisionModalProps) {
  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[75] flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-ai-revision-title"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#dfe8e2] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#dfe8e2] p-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
                  AI 輔助修改
                </p>
                <h2
                  id="course-ai-revision-title"
                  className="mt-1 text-lg font-black"
                >
                  修改{courseCardRevisionLabel(target)}
                </h2>
                <p className="mt-1 text-xs font-bold leading-6 text-zinc-500">
                  AI 只產生這張卡的新版本；確認前不會改動原內容，套用時會重新驗證整個階段。
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                aria-label="關閉 AI 輔助修改"
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-40"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#f7faf8] p-5 custom-scrollbar">
              <label className="block">
                <span className="text-xs font-black text-zinc-700">
                  希望 AI 如何修改？
                </span>
                <textarea
                  rows={5}
                  maxLength={1000}
                  value={instruction}
                  disabled={busy}
                  onChange={(event) =>
                    onInstructionChange(event.target.value)
                  }
                  placeholder="例如：保留原本學習目標，但讓任務更符合高一普通班、每組只有一台平板且兩節課內可完成。"
                  className="mt-2 w-full resize-y rounded-xl border border-[#b9ccc2] bg-white p-3 text-sm font-medium leading-7 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100 disabled:bg-zinc-100"
                />
                <span className="mt-1 block text-right text-[10px] font-black text-zinc-400">
                  {instruction.length}/1000
                </span>
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold leading-6 text-red-800"
                >
                  {error}
                </p>
              )}

              {draft && draft.target === target && (
                <section className="rounded-xl border border-emerald-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-emerald-950">
                      AI 修改草稿預覽
                    </h3>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-900">
                      尚未套用
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {[
                      ["原內容", draft.before],
                      ["新內容", draft.value],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="overflow-hidden rounded-lg border border-zinc-200">
                        <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-black text-zinc-600">
                          {String(label)}
                        </p>
                        <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-white p-3 text-[11px] font-medium leading-6 text-zinc-700 custom-scrollbar">
                          {typeof value === "string"
                            ? value
                            : JSON.stringify(value, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="grid gap-3 border-t border-[#dfe8e2] bg-white p-4 sm:grid-cols-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border border-[#dfe8e2] py-3 text-sm font-black text-zinc-700 hover:bg-[#f7faf8] disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy || instruction.trim().length < 4}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#2f7d68] bg-white py-3 text-sm font-black text-[#175247] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy
                  ? "AI 正在修改…"
                  : draft
                    ? "重新產生草稿"
                    : "產生修改草稿"}
              </button>
              <button
                type="button"
                onClick={onApply}
                disabled={busy || !draft || draft.target !== target}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#173f36] py-3 text-sm font-black text-white hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                套用這個版本
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function CourseIdeationApp({
  embedded = false,
  active = true,
  aiSettings: settings,
  onOpenAiSettings,
  onOpenAssessment: _onOpenAssessment,
  onProjectChange,
}: CourseIdeationAppProps) {
  const googleOAuth = useGoogleOAuthClientId();
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
  const [courseOriginMode, setCourseOriginMode] = useState<CourseOriginMode | null>(
    () => resolveInitialOriginMode(initialDraft, initialStoredProject),
  );
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
  const [curriculumRecommendation, setCurriculumRecommendation] =
    useState<CurriculumRecommendation | null>(
      initialDraft?.curriculumRecommendation ?? null,
    );
  const [customCurriculumEntries, setCustomCurriculumEntries] = useState<
    CurriculumEntry[]
  >(initialDraft?.customCurriculumEntries ?? []);
  const [lessonReferenceAnalysis, setLessonReferenceAnalysis] =
    useState<LessonReferenceAnalysis | null>(
      initialDraft?.lessonReferenceAnalysis ?? null,
    );
  const [appliedLessonReference, setAppliedLessonReference] =
    useState<AppliedLessonReference | null>(
      initialDraft?.appliedLessonReference ?? null,
    );
  const [referenceFileName, setReferenceFileName] = useState("");
  const [extractedLessonReference, setExtractedLessonReference] =
    useState<ExtractedLessonReference | null>(null);
  const [referenceSelection, setReferenceSelection] = useState<Set<string>>(
    new Set(),
  );
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceBusy, setReferenceBusy] = useState(false);
  const [lessonPasteDraft, setLessonPasteDraft] = useState("");
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
  const [courseAssessmentSeed, setCourseAssessmentSeed] =
    useState<CourseAssessmentSeedV1 | null>(
      initialStoredProject?.courseAssessmentSeed ??
        initialDraft?.courseAssessmentSeed ??
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
  const [canvasGeneratingKind, setCanvasGeneratingKind] =
    useState<UnitCanvasDocumentKind | null>(null);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [busyAction, setBusyAction] = useState<AiAction | null>(null);
  const [pendingAction, setPendingAction] = useState<AiAction | null>(null);
  const [revisionTarget, setRevisionTarget] =
    useState<CourseCardRevisionTarget | null>(null);
  const [pendingRevisionTarget, setPendingRevisionTarget] =
    useState<CourseCardRevisionTarget | null>(null);
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revisionDraft, setRevisionDraft] =
    useState<AiRevisionDraft | null>(null);
  const [revisionBusy, setRevisionBusy] = useState(false);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentGranted, setConsentGranted] = useState(hasSavedConsent);
  const [error, setError] = useState<string | null>(null);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [assessmentSeedError, setAssessmentSeedError] = useState<string | null>(
    null,
  );
  const [googleFormsSettingsOpen, setGoogleFormsSettingsOpen] = useState(false);
  const [formsExporting, setFormsExporting] = useState(false);
  const [formsExportStatus, setFormsExportStatus] = useState<string | null>(
    null,
  );
  const [formsExportRecord, setFormsExportRecord] =
    useState<GoogleFormsExportRecord | null>(null);
  const [diagnosticDocExporting, setDiagnosticDocExporting] = useState<
    "questions" | "guide" | null
  >(null);
  const [diagnosticDocStatus, setDiagnosticDocStatus] = useState<string | null>(
    null,
  );
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [handoffPreviewOpen, setHandoffPreviewOpen] = useState(false);
  const [contentDrawer, setContentDrawer] =
    useState<ContentDrawerContent | null>(null);
  const [inputDrawerOpen, setInputDrawerOpen] = useState(false);
  const [activeDesignTab, setActiveDesignTab] =
    useState<CourseDesignTabId>("alignment");
  const [manualDesignTab, setManualDesignTab] = useState(false);
  const reduceMotion = useReducedMotion();
  const [assessmentNarrativeTab, setAssessmentNarrativeTab] = useState(0);
  const [evidencePanel, setEvidencePanel] =
    useState<EvidencePanelId>("performance-task");

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
  const curriculumOptions = useMemo(
    () => getCurriculumOptions(input, customCurriculumEntries),
    [customCurriculumEntries, input],
  );
  const curriculumCandidates = useMemo(
    () =>
      getCurriculumCandidates(
        input,
        analysis,
        customCurriculumEntries,
        {
          performanceIds: Array.from(
            new Set([
              ...(curriculumSelection?.performanceIds ?? []),
              ...(curriculumRecommendation?.performanceIds ?? []),
            ]),
          ),
          contentIds: Array.from(
            new Set([
              ...(curriculumSelection?.contentIds ?? []),
              ...(curriculumRecommendation?.contentIds ?? []),
            ]),
          ),
        },
      ),
    [
      analysis,
      curriculumRecommendation,
      curriculumSelection,
      customCurriculumEntries,
      input,
    ],
  );
  const optionPerformanceIds = new Set(
    curriculumOptions.performances.map((entry) => entry.id),
  );
  const optionContentIds = new Set(
    curriculumOptions.contents.map((entry) => entry.id),
  );
  const curriculumSelectionNeedsRecalibration =
    curriculumSelection?.mode === "teacher_edited" &&
    (!alignment ||
      !sameIds(
        curriculumSelection.performanceIds,
        alignment.curriculumSelection.performanceIds,
      ) ||
      !sameIds(
        curriculumSelection.contentIds,
        alignment.curriculumSelection.contentIds,
      ));
  const curriculumTierById = useMemo(
    () => getCurriculumTierMap(input, analysis, customCurriculumEntries),
    [analysis, customCurriculumEntries, input],
  );
  const hasOfficialCurriculumPool =
    curriculumOptions.performances.length > 0 ||
    curriculumOptions.contents.length > 0;
  const selectedIndicator = getIndicatorById(selectedIndicatorId);
  const unitConstraintErrors = useMemo(
    () => validateUnitConstraints(unitConstraints),
    [unitConstraints],
  );
  const courseAssessmentSourceFingerprint = useMemo(
    () =>
      desiredResults && evidencePlan
        ? buildCourseAssessmentSourceFingerprint({
            course: input,
            selectedIndicatorId,
            desiredResults,
            evidencePlan,
          })
        : "",
    [desiredResults, evidencePlan, input, selectedIndicatorId],
  );
  const assessmentSeedCurrent = isCourseAssessmentSeedCurrent(
    courseAssessmentSeed,
    courseAssessmentSourceFingerprint,
  );
  const currentProject = useMemo<LearningDesignProjectV1>(
    () => ({
      version: 1,
      id: projectId,
      createdAt: projectCreatedAt,
      updatedAt: Date.now(),
      courseOriginMode,
      input,
      analysis,
      alignment,
      customCurriculumEntries,
      curriculumRecommendation,
      lessonReferenceAnalysis: appliedLessonReference
        ? lessonReferenceAnalysis
        : null,
      appliedLessonReference,
      selectedIndicatorId,
      desiredResults,
      desiredResultsConfirmedAt,
      evidencePlan,
      evidencePlanConfirmedAt,
      courseAssessmentSeed,
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
      appliedLessonReference,
      courseOriginMode,
      customCurriculumEntries,
      curriculumRecommendation,
      desiredResults,
      desiredResultsConfirmedAt,
      evidencePlan,
      evidencePlanConfirmedAt,
      courseAssessmentSeed,
      input,
      lessonPromptStatus,
      lessonReferenceAnalysis,
      projectCreatedAt,
      projectId,
      selectedIndicatorId,
      unitBlueprint,
      unitBlueprintConfirmedAt,
      unitConstraints,
    ],
  );
  const assessmentDesignContext = useMemo(
    () => buildAssessmentDesignContext(currentProject),
    [currentProject],
  );
  const assessmentForm = useMemo(
    () =>
      alignment && selectedIndicatorId
        ? courseIdeationHandoffToForm(
            buildCourseIdeationHandoff(
              input,
              alignment,
              selectedIndicatorId,
              projectId,
            ),
          )
        : null,
    [alignment, input, projectId, selectedIndicatorId],
  );
  const assessmentSeedModules = useMemo(
    () =>
      courseAssessmentSeed && assessmentForm
        ? splitModules(
            renderCourseAssessmentSeedMarkdown(
              courseAssessmentSeed,
              assessmentForm,
            ),
          )
        : [],
    [assessmentForm, courseAssessmentSeed],
  );
  const courseNarrativeSlices = useMemo(
    () =>
      assessmentSeedModules[0]
        ? parseNarrativeModule(
            assessmentSeedModules[0],
            selectedIndicator ?? null,
          ).slices
        : [],
    [assessmentSeedModules, selectedIndicator],
  );
  const preAssessmentPreview = useMemo(
    () =>
      assessmentSeedModules[1]
        ? parseAssessmentModule(assessmentSeedModules[1], "pre")
        : null,
    [assessmentSeedModules],
  );
  const diagnosticIndicatorName =
    selectedIndicator?.name ?? selectedIndicatorId;
  const preAssessmentContent = assessmentSeedModules[1] ?? "";
  const canExportDiagnosticDocuments = Boolean(
    courseAssessmentSeed &&
      assessmentForm &&
      preAssessmentContent.trim() &&
      (preAssessmentPreview?.questions.length ?? 0) > 0,
  );
  const diagnosticFormsFingerprint = useMemo(
    () =>
      assessmentForm && preAssessmentContent
        ? assessmentExportFingerprint(
            assessmentForm,
            diagnosticIndicatorName,
            preAssessmentContent,
            "",
          )
        : "",
    [assessmentForm, diagnosticIndicatorName, preAssessmentContent],
  );
  const diagnosticFormsExportIssue = useMemo(() => {
    if (!preAssessmentContent.trim()) return "尚未產生診斷題組。";
    if (!assessmentSeedCurrent) {
      return "學習終點或評量證據已更新，請重新產生診斷題組。";
    }
    return getGoogleFormsModuleExportIssue(preAssessmentContent, "pre");
  }, [assessmentSeedCurrent, preAssessmentContent]);
  const googleClientId = googleOAuth.clientId;
  const googleClientIdManaged = googleOAuth.managed;
  const googleClientIdIssue = googleOAuth.issue;

  useEffect(() => {
    if (!diagnosticFormsFingerprint || !assessmentForm) {
      setFormsExportRecord(null);
      return;
    }
    const records = readJson<Record<string, GoogleFormsExportRecord>>(
      KEYS.googleFormsExports,
      {},
    );
    const preFingerprint = assessmentExportFingerprint(
      assessmentForm,
      diagnosticIndicatorName,
      preAssessmentContent,
      "",
    );
    setFormsExportRecord(
      records[diagnosticFormsFingerprint] ??
        Object.values(records).find(
          (record) => record.preFingerprint === preFingerprint,
        ) ??
        null,
    );
    setFormsExportStatus(null);
  }, [
    assessmentForm,
    diagnosticFormsFingerprint,
    diagnosticIndicatorName,
    preAssessmentContent,
  ]);
  const pendingPrompt = useMemo(() => {
    if (pendingRevisionTarget && revisionTarget === pendingRevisionTarget) {
      const parent = revisionParentForTarget(pendingRevisionTarget, {
        analysis,
        alignment,
        evidencePlan,
        courseAssessmentSeed,
        unitBlueprint,
      });
      const currentCard = parent
        ? getCourseCardValue(parent, pendingRevisionTarget)
        : undefined;
      if (parent && currentCard !== undefined) {
        try {
          return buildCourseCardRevisionPrompt({
            target: pendingRevisionTarget,
            input,
            instruction: revisionInstruction,
            currentCard,
            parent,
            desiredResults,
            evidencePlan,
            unitConstraints,
            selectedIndicatorId,
          });
        } catch {
          return null;
        }
      }
    }
    if (pendingAction === "reference" && extractedLessonReference) {
      return buildLessonReferenceAnalysisPrompt(extractedLessonReference.text);
    }
    if (pendingAction === "analyze") return buildKeywordAnalysisPrompt(input);
    if (pendingAction === "align" && analysis) {
      return buildCourseAlignmentPrompt(
        input,
        analysis,
        curriculumCandidates,
        curriculumSelection,
        appliedLessonReference,
        curriculumRecommendation,
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
        appliedLessonReference,
      );
    }
    if (
      pendingAction === "assessment_seed" &&
      assessmentDesignContext &&
      assessmentForm
    ) {
      return buildCourseAssessmentSeedPrompt(
        assessmentForm,
        selectedIndicator ?? null,
        assessmentDesignContext,
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
        appliedLessonReference,
        courseAssessmentSeed,
      );
    }
    return null;
  }, [
    analysis,
    alignment,
    appliedLessonReference,
    assessmentDesignContext,
    assessmentForm,
    courseAssessmentSeed,
    curriculumCandidates,
    curriculumRecommendation,
    curriculumSelection,
    desiredResults,
    evidencePlan,
    extractedLessonReference,
    input,
    pendingAction,
    pendingRevisionTarget,
    revisionInstruction,
    revisionTarget,
    selectedIndicatorId,
    selectedIndicator,
    unitBlueprint,
    unitConstraints,
  ]);

  useEffect(() => {
    onProjectChange?.(currentProject);
  }, [currentProject, onProjectChange]);

  useEffect(() => {
    const draft: CourseIdeationDraft = {
      courseOriginMode,
      input,
      analysis,
      alignment,
      curriculumSelection,
      curriculumRecommendation,
      customCurriculumEntries,
      lessonReferenceAnalysis: appliedLessonReference
        ? lessonReferenceAnalysis
        : null,
      appliedLessonReference,
      selectedIndicatorId,
      projectId,
      projectCreatedAt,
      desiredResults,
      desiredResultsConfirmedAt,
      evidencePlan,
      evidencePlanConfirmedAt,
      courseAssessmentSeed,
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
    appliedLessonReference,
    courseOriginMode,
    curriculumSelection,
    curriculumRecommendation,
    customCurriculumEntries,
    desiredResults,
    desiredResultsConfirmedAt,
    evidencePlan,
    evidencePlanConfirmedAt,
    courseAssessmentSeed,
    input,
    lessonPromptStatus,
    lessonReferenceAnalysis,
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
    setAssessmentSeedError(null);
    setBlueprintError(null);
    setAlignmentAudit({
      desiredResults: "empty",
      evidencePlan: evidencePlan ? "stale" : "empty",
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    });
  };

  const clearCourseProgressForOriginSwitch = () => {
    setAnalysis(null);
    setAlignment(null);
    setCurriculumSelection(null);
    setCurriculumRecommendation(null);
    setCustomCurriculumEntries([]);
    setLessonReferenceAnalysis(null);
    setAppliedLessonReference(null);
    setExtractedLessonReference(null);
    setReferenceFileName("");
    setReferenceSelection(new Set());
    setLessonPasteDraft("");
    setReferenceError(null);
    setSelectedIndicatorId("");
    setKeywordDraft("");
    setEvidencePlan(null);
    setEvidencePlanConfirmedAt(null);
    setCourseAssessmentSeed(null);
    setUnitBlueprint(null);
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setDesiredResults(null);
    setDesiredResultsConfirmedAt(null);
    setAlignmentAudit({
      desiredResults: "empty",
      evidencePlan: "empty",
      unitBlueprint: "empty",
    });
    setError(null);
    setManualDesignTab(false);
    setActiveDesignTab("alignment");
  };

  const selectCourseOriginMode = (mode: CourseOriginMode) => {
    setCourseOriginMode(mode);
    setError(null);
    if (mode === "existing") {
      setInputDrawerOpen(true);
    }
  };

  const requestChangeCourseOriginMode = () => {
    const hasProgress =
      Boolean(analysis) ||
      Boolean(appliedLessonReference) ||
      Boolean(alignment) ||
      Boolean(courseAssessmentSeed) ||
      Boolean(unitBlueprint);
    if (
      hasProgress &&
      !window.confirm(
        "更改「已有／未有課程」方向會清空目前的分析與下游設計（終點、證據、題組、藍圖）。確定要更改嗎？",
      )
    ) {
      return;
    }
    clearCourseProgressForOriginSwitch();
    setCourseOriginMode(null);
  };

  const markDesignStaleAfterCurriculumSelectionChange = () => {
    setDesiredResultsConfirmedAt(null);
    setEvidencePlanConfirmedAt(null);
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setEvidenceError(null);
    setBlueprintError(null);
    setAlignmentAudit({
      desiredResults: desiredResults ? "stale" : "empty",
      evidencePlan: evidencePlan ? "stale" : "empty",
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    });
  };

  const updateInput = (patch: Partial<CourseIdeationInput>) => {
    setInput((current) => ({ ...current, ...patch }));
    setAnalysis(null);
    setAlignment(null);
    setCurriculumSelection(null);
    setCurriculumRecommendation(null);
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
    const maximum = 2;
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
          : "學習內容最多選擇 2 項。",
      );
      return;
    }
    setCurriculumSelection({
      ...current,
      [field]: nextIds,
      rationale: "教師已調整課綱選擇，需重新校準後才會產生更新成果。",
      mode: "teacher_edited",
    });
    markDesignStaleAfterCurriculumSelectionChange();
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

  const handleLessonReferenceFile = async (file: File | null) => {
    setReferenceError(null);
    setLessonReferenceAnalysis(null);
    setReferenceSelection(new Set());
    setExtractedLessonReference(null);
    setReferenceFileName("");
    setLessonPasteDraft("");
    if (!file) return;
    setReferenceBusy(true);
    try {
      const extracted = await extractLessonReferenceText(file);
      setExtractedLessonReference(extracted);
      setReferenceFileName(file.name);
    } catch (caught) {
      setReferenceError(toUserErrorMessage(caught));
    } finally {
      setReferenceBusy(false);
    }
  };

  const handleLessonReferencePaste = () => {
    setReferenceError(null);
    setLessonReferenceAnalysis(null);
    setReferenceSelection(new Set());
    try {
      const extracted = extractLessonReferenceFromPaste(lessonPasteDraft);
      setExtractedLessonReference(extracted);
      setReferenceFileName("貼上的教案文字");
    } catch (caught) {
      setExtractedLessonReference(null);
      setReferenceFileName("");
      setReferenceError(toUserErrorMessage(caught));
    }
  };

  const executeLessonReferenceAnalysis = async () => {
    if (!extractedLessonReference) {
      setReferenceError("請先上傳教案檔案，或貼上教案文字後再分析。");
      return;
    }
    if (!hasModelAccess) {
      setReferenceError(`請先設定 ${providerName(settings.model)} API Key。`);
      onOpenAiSettings();
      return;
    }
    setReferenceBusy(true);
    setReferenceError(null);
    try {
      const prompt = buildLessonReferenceAnalysisPrompt(
        extractedLessonReference.text,
      );
      const raw = await generateContent(
        prompt,
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
        {
          structured: {
            name: "npdl_lesson_reference_analysis",
            schema: LESSON_REFERENCE_ANALYSIS_SCHEMA,
          },
        },
      );
      let nextAnalysis: LessonReferenceAnalysis;
      try {
        nextAnalysis = parseLessonReferenceAnalysis(raw, settings.model);
      } catch (caught) {
        const repair = buildLessonReferenceRepairPrompt(
          raw,
          toUserErrorMessage(caught),
        );
        const repairedRaw = await generateContent(
          repair,
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_lesson_reference_analysis_repair",
              schema: LESSON_REFERENCE_ANALYSIS_SCHEMA,
            },
          },
        );
        nextAnalysis = parseLessonReferenceAnalysis(
          repairedRaw,
          settings.model,
        );
      }
      setLessonReferenceAnalysis(nextAnalysis);
      const initiallySelected = new Set<string>();
      const inferred = nextAnalysis.inferredCourse;
      if (inferred.grade) initiallySelected.add("course:grade");
      if (inferred.subject) initiallySelected.add("course:subject");
      if (inferred.unitName) initiallySelected.add("course:unitName");
      if (inferred.teachingTopic) {
        initiallySelected.add("course:teachingTopic");
      }
      if (inferred.coreKeywords.length > 0) {
        initiallySelected.add("course:coreKeywords");
      }
      (
        [
          "learningGoals",
          "reusableActivities",
          "assessmentIdeas",
          "resources",
          "constraints",
          "differentiationSupports",
        ] as const
      ).forEach((field) =>
        nextAnalysis[field].forEach((_, index) =>
          initiallySelected.add(`${field}:${index}`),
        ),
      );
      setReferenceSelection(initiallySelected);
    } catch (caught) {
      setReferenceError(toUserErrorMessage(caught));
    } finally {
      setReferenceBusy(false);
      setPendingAction(null);
    }
  };

  const requestLessonReferenceAnalysis = () => {
    if (!extractedLessonReference) {
      setReferenceError("請先上傳教案檔案，或貼上教案文字後再分析。");
      return;
    }
    if (!hasModelAccess) {
      setReferenceError(`請先設定 ${providerName(settings.model)} API Key。`);
      onOpenAiSettings();
      return;
    }
    if (!consentGranted) {
      setPendingAction("reference");
      setConsentOpen(true);
      return;
    }
    void executeLessonReferenceAnalysis();
  };

  const toggleReferenceSelection = (key: string, checked: boolean) => {
    setReferenceSelection((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const applyLessonReferenceSelection = () => {
    if (!lessonReferenceAnalysis || referenceSelection.size === 0) {
      setReferenceError("請至少勾選一項要帶入的教案參考。");
      return;
    }
    const inferred = lessonReferenceAnalysis.inferredCourse;
    const inferredGrade =
      inferred.grade &&
      GRADES.includes(inferred.grade as (typeof GRADES)[number])
        ? inferred.grade
        : input.grade;
    const nextInput: CourseIdeationInput = {
      grade:
        referenceSelection.has("course:grade") && inferred.grade
          ? inferredGrade
          : input.grade,
      subject:
        referenceSelection.has("course:subject") && inferred.subject
          ? inferred.subject
          : input.subject,
      unitName:
        referenceSelection.has("course:unitName") && inferred.unitName
          ? inferred.unitName
          : input.unitName,
      teachingTopic:
        referenceSelection.has("course:teachingTopic") &&
        inferred.teachingTopic
          ? inferred.teachingTopic
          : input.teachingTopic,
      coreKeywords:
        referenceSelection.has("course:coreKeywords") &&
        inferred.coreKeywords.length > 0
          ? normalizeCoreKeywords([
              ...inferred.coreKeywords,
              ...input.coreKeywords,
            ])
          : input.coreKeywords,
    };
    const selectedArray = (
      field:
        | "learningGoals"
        | "reusableActivities"
        | "assessmentIdeas"
        | "resources"
        | "constraints"
        | "differentiationSupports",
    ) =>
      lessonReferenceAnalysis[field].filter((_, index) =>
        referenceSelection.has(`${field}:${index}`),
      );
    setAppliedLessonReference({
      learningGoals: selectedArray("learningGoals"),
      reusableActivities: selectedArray("reusableActivities"),
      assessmentIdeas: selectedArray("assessmentIdeas"),
      resources: selectedArray("resources"),
      constraints: selectedArray("constraints"),
      differentiationSupports: selectedArray("differentiationSupports"),
    });
    setCourseOriginMode("existing");
    setInput(nextInput);
    setAnalysis(null);
    setAlignment(null);
    setCurriculumSelection(null);
    setCurriculumRecommendation(null);
    setCustomCurriculumEntries([]);
    setExtractedLessonReference(null);
    setReferenceFileName("");
    setLessonPasteDraft("");
    setSelectedIndicatorId("");
    invalidateDesignAfterEndpointChange();
    setReferenceError(null);
  };

  const executeAction = async (action: AiAction) => {
    if (action === "reference") {
      await executeLessonReferenceAnalysis();
      return;
    }
    if (!hasModelAccess) {
      setError(`請先設定 ${providerName(settings.model)} API Key。`);
      onOpenAiSettings();
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
      curriculumSelection?.mode === "teacher_edited" &&
      curriculumSelection.performanceIds.some((id) => !optionPerformanceIds.has(id))
    ) {
      setError("所選學習表現不在目前科目可用清單中，請清除後重選或略過課綱。");
      return;
    }
    if (
      action === "align" &&
      curriculumSelection?.mode === "teacher_edited" &&
      curriculumSelection.contentIds.some((id) => !optionContentIds.has(id))
    ) {
      setError("所選學習內容不在目前科目可用清單中，請清除後重選或略過課綱。");
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
      action === "assessment_seed" &&
      (!alignment ||
        !desiredResults ||
        !evidencePlan ||
        !evidencePlanConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        alignmentAudit.evidencePlan !== "current" ||
        !assessmentDesignContext ||
        !assessmentForm ||
        !selectedIndicatorId)
    ) {
      scrollToDesignStep(
        "learning-design-evidence",
        "請先建立、編修並確認評量證據，再產生課程敘述語與診斷題組。",
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
        !selectedIndicatorId ||
        !assessmentSeedCurrent)
    ) {
      scrollToDesignStep(
        assessmentSeedCurrent
          ? "learning-design-evidence"
          : "learning-design-assessment-seed",
        assessmentSeedCurrent
          ? "請先建立、編修並確認評量證據，再產生單元節次藍圖。"
          : "請先產生最新的課程敘述語與診斷題組，再產生單元節次藍圖。",
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
        setCurriculumRecommendation(null);
        setSelectedIndicatorId("");
        invalidateDesignAfterEndpointChange();
      } else if (action === "align" && analysis) {
        const alignmentMode =
          curriculumSelection?.mode === "teacher_edited"
            ? "teacher_edited"
            : "ai_auto";
        const raw = await generateContent(
          buildCourseAlignmentPrompt(
            input,
            analysis,
            curriculumCandidates,
            curriculumSelection,
            appliedLessonReference,
            curriculumRecommendation,
          ),
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_course_alignment",
              schema: getCourseAlignmentSchema(alignmentMode),
            },
          },
        );
        const nextAlignment = parseCourseAlignment(
          raw,
          settings.model,
          curriculumCandidates,
          alignmentMode,
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
        if (
          curriculumRecommendation &&
          nextAlignment.curriculumRecommendation &&
          (!sameIds(
            nextAlignment.curriculumRecommendation.performanceIds,
            curriculumRecommendation.performanceIds,
          ) ||
            !sameIds(
              nextAlignment.curriculumRecommendation.contentIds,
              curriculumRecommendation.contentIds,
            ))
        ) {
          throw new CourseIdeationResponseError(
            "AI 未保留原始的課綱推薦清單。",
          );
        }
        setAlignment(nextAlignment);
        setCurriculumSelection(nextAlignment.curriculumSelection);
        if (!curriculumRecommendation && nextAlignment.curriculumRecommendation) {
          setCurriculumRecommendation(nextAlignment.curriculumRecommendation);
        }
        setSelectedIndicatorId(nextAlignment.recommendations[0].indicatorId);
        setDesiredResults(null);
        setDesiredResultsConfirmedAt(null);
        setEvidencePlanConfirmedAt(null);
        setUnitBlueprintConfirmedAt(null);
        setLessonPromptStatus([]);
        setEvidenceError(null);
        setAssessmentSeedError(null);
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
          buildEvidencePlanPrompt(
            input,
            alignment,
            selectedIndicatorId,
            appliedLessonReference,
          ),
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
        setAssessmentSeedError(null);
        setBlueprintError(null);
        setActiveDesignTab("evidence");
        setManualDesignTab(true);
        setEvidencePanel("performance-task");
        setAlignmentAudit((current) => ({
          desiredResults: current.desiredResults,
          evidencePlan: "current",
          unitBlueprint: unitBlueprint ? "stale" : "empty",
        }));
      } else if (
        action === "assessment_seed" &&
        assessmentDesignContext &&
        assessmentForm &&
        evidencePlan
      ) {
        const raw = await generateContent(
          buildCourseAssessmentSeedPrompt(
            assessmentForm,
            selectedIndicator ?? null,
            assessmentDesignContext,
          ),
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: "npdl_course_assessment_seed",
              schema: COURSE_ASSESSMENT_SEED_SCHEMA,
            },
          },
        );
        let nextSeed: CourseAssessmentSeedV1;
        try {
          nextSeed = parseCourseAssessmentSeed(raw, {
            model: settings.model,
            sourceFingerprint: courseAssessmentSourceFingerprint,
            evidencePlan,
          });
        } catch (caught) {
          const repairedRaw = await generateContent(
            buildCourseAssessmentSeedRepairPrompt(
              raw,
              toUserErrorMessage(caught),
              assessmentForm,
              selectedIndicator ?? null,
              assessmentDesignContext,
            ),
            settings.model,
            settings.geminiKey,
            settings.openaiKey,
            settings.xaiKey,
            {
              structured: {
                name: "npdl_course_assessment_seed_repair",
                schema: COURSE_ASSESSMENT_SEED_SCHEMA,
              },
            },
          );
          nextSeed = parseCourseAssessmentSeed(repairedRaw, {
            model: settings.model,
            sourceFingerprint: courseAssessmentSourceFingerprint,
            evidencePlan,
          });
        }
        const seedErrors = validateCourseAssessmentSeed(
          nextSeed,
          courseAssessmentSourceFingerprint,
        );
        if (seedErrors.length > 0) {
          throw new CourseIdeationResponseError(seedErrors[0]);
        }
        setCourseAssessmentSeed(nextSeed);
        setAssessmentSeedError(null);
        setUnitBlueprintConfirmedAt(null);
        setLessonPromptStatus([]);
        setPromptPreview(null);
        setActiveDesignTab("assessment-seed");
        setManualDesignTab(true);
        setAlignmentAudit((current) => ({
          ...current,
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
            appliedLessonReference,
            courseAssessmentSeed,
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
              courseAssessmentSeed,
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
        setActiveDesignTab("delivery");
        setManualDesignTab(true);
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
      } else if (action === "assessment_seed") {
        setAssessmentSeedError(detailedMessage);
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
      curriculumSelection?.mode === "teacher_edited" &&
      curriculumSelection.performanceIds.some((id) => !optionPerformanceIds.has(id))
    ) {
      setError("所選學習表現不在目前科目可用清單中，請清除後重選或略過課綱。");
      return;
    }
    if (
      action === "align" &&
      curriculumSelection?.mode === "teacher_edited" &&
      curriculumSelection.contentIds.some((id) => !optionContentIds.has(id))
    ) {
      setError("所選學習內容不在目前科目可用清單中，請清除後重選或略過課綱。");
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
      action === "assessment_seed" &&
      (!assessmentDesignContext ||
        !assessmentForm ||
        !evidencePlanConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        alignmentAudit.evidencePlan !== "current")
    ) {
      scrollToDesignStep(
        "learning-design-evidence",
        "請先建立、編修並確認評量證據，再產生課程敘述語與診斷題組。",
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
        !selectedIndicatorId ||
        !assessmentSeedCurrent)
    ) {
      scrollToDesignStep(
        assessmentSeedCurrent
          ? "learning-design-evidence"
          : "learning-design-assessment-seed",
        assessmentSeedCurrent
          ? "請先建立、編修並確認評量證據，再產生單元節次藍圖。"
          : "請先產生最新的課程敘述語與診斷題組，再產生單元節次藍圖。",
      );
      return;
    }
    if (action === "blueprint" && unitConstraintErrors.length > 0) {
      setError(unitConstraintErrors[0]);
      return;
    }
    if (!hasModelAccess) {
      setError(`請先設定 ${providerName(settings.model)} API Key。`);
      onOpenAiSettings();
      return;
    }
    if (!consentGranted) {
      setPendingAction(action);
      setConsentOpen(true);
      return;
    }
    void executeAction(action);
  };

  const openAiRevision = (target: CourseCardRevisionTarget) => {
    const parent = revisionParentForTarget(target, {
      analysis,
      alignment,
      evidencePlan,
      courseAssessmentSeed,
      unitBlueprint,
    });
    if (!parent || getCourseCardValue(parent, target) === undefined) return;
    setRevisionTarget(target);
    setRevisionInstruction("");
    setRevisionDraft(null);
    setRevisionError(null);
  };

  const validateRevisedParent = (
    target: CourseCardRevisionTarget,
    parent: CourseRevisionParent,
    cardValue: unknown,
  ): CourseRevisionParent => {
    const currentCard = getCourseCardValue(parent, target);
    const merged = replaceCourseCardValue(parent, target, cardValue);
    if (
      target.kind === "keyword_summary" ||
      target.kind === "keyword_theme" ||
      target.kind === "curriculum_signal" ||
      target.kind === "suggested_keywords"
    ) {
      return parseKeywordAnalysis(
        JSON.stringify(merged),
        settings.model,
        input.coreKeywords,
      );
    }
    if (
      target.kind === "curriculum_rationale" ||
      target.kind === "six_c_recommendation" ||
      target.kind === "desired_result" ||
      target.kind === "learning_outcome" ||
      target.kind === "four_element" ||
      target.kind === "evidence_tools"
    ) {
      const revised = parseCourseAlignment(
        JSON.stringify(merged),
        settings.model,
        curriculumCandidates,
        (parent as CourseAlignmentResult).curriculumSelection.mode,
      );
      const original = parent as CourseAlignmentResult;
      if (
        !sameIds(
          revised.curriculumSelection.performanceIds,
          original.curriculumSelection.performanceIds,
        ) ||
        !sameIds(
          revised.curriculumSelection.contentIds,
          original.curriculumSelection.contentIds,
        )
      ) {
        throw new CourseIdeationResponseError(
          "單卡修改不得變更受控課綱選擇。",
        );
      }
      if (
        target.kind === "six_c_recommendation" &&
        (cardValue as { indicatorId?: unknown }).indicatorId !==
          (currentCard as { indicatorId?: unknown }).indicatorId
      ) {
        throw new CourseIdeationResponseError("單卡修改不得更換 6Cs ID。");
      }
      if (
        target.kind === "four_element" &&
        (cardValue as { name?: unknown }).name !==
          (currentCard as { name?: unknown }).name
      ) {
        throw new CourseIdeationResponseError("單卡修改不得更換四要素名稱。");
      }
      return revised;
    }
    if (target.kind === "unit_arc" || target.kind === "lesson") {
      if (!desiredResults || !evidencePlan) {
        throw new Error("評量證據資料不完整，無法驗證單元藍圖。");
      }
      if (target.kind === "lesson") {
        const next = cardValue as Record<string, unknown>;
        const original = currentCard as Record<string, unknown>;
        for (const field of [
          "id",
          "lessonNumber",
          "minutes",
          "primaryIndicatorId",
        ]) {
          if (next[field] !== original[field]) {
            throw new CourseIdeationResponseError(
              `單卡修改不得變更節次的 ${field}。`,
            );
          }
        }
      }
      return {
        ...parseUnitBlueprint(
          JSON.stringify(merged),
          settings.model,
          desiredResults,
          evidencePlan,
          unitConstraints,
          selectedIndicatorId,
        ),
        mode: "teacher_edited",
      };
    }
    if (target.kind === "course_narrative_level") {
      const revisedSeed = merged as CourseAssessmentSeedV1;
      const errors = validateCourseAssessmentSeed(
        revisedSeed,
        courseAssessmentSourceFingerprint,
      );
      if (errors.length > 0) {
        throw new CourseIdeationResponseError(errors[0]);
      }
      return revisedSeed;
    }
    if (!desiredResults) {
      throw new Error("學習終點資料不完整，無法驗證評量證據。");
    }
    if (
      target.kind === "question_purpose" &&
      ((cardValue as { id?: unknown }).id !==
        (currentCard as { id?: unknown }).id ||
        (cardValue as { focus?: unknown }).focus !==
          (currentCard as { focus?: unknown }).focus)
    ) {
      throw new CourseIdeationResponseError(
        "單卡修改不得變更題號或固定能力焦點。",
      );
    }
    if (
      target.kind === "evidence_item" &&
      ((cardValue as { id?: unknown }).id !==
        (currentCard as { id?: unknown }).id ||
        (cardValue as { type?: unknown }).type !==
          (currentCard as { type?: unknown }).type)
    ) {
      throw new CourseIdeationResponseError(
        "單卡修改不得變更證據 ID 或證據類型。",
      );
    }
    if (
      target.kind === "rubric" &&
      (cardValue as { criterionId?: unknown }).criterionId !==
        (currentCard as { criterionId?: unknown }).criterionId
    ) {
      throw new CourseIdeationResponseError("單卡修改不得更換成功指標 ID。");
    }
    return {
      ...parseEvidencePlan(
        JSON.stringify(merged),
        settings.model,
        desiredResults,
      ),
      mode: "teacher_edited",
    };
  };

  const executeAiRevision = async (target: CourseCardRevisionTarget) => {
    const parent = revisionParentForTarget(target, {
      analysis,
      alignment,
      evidencePlan,
      courseAssessmentSeed,
      unitBlueprint,
    });
    const currentCard = parent
      ? getCourseCardValue(parent, target)
      : undefined;
    if (!parent || currentCard === undefined) {
      setRevisionError("目前沒有可修改的內容，請先完成這個階段。");
      return;
    }
    if (!hasModelAccess) {
      setRevisionError(`請先設定 ${providerName(settings.model)} API Key。`);
      onOpenAiSettings();
      return;
    }

    setRevisionBusy(true);
    setRevisionError(null);
    try {
      const context = {
        target,
        input,
        instruction: revisionInstruction,
        currentCard,
        parent,
        desiredResults,
        evidencePlan,
        unitConstraints,
        selectedIndicatorId,
      };
      const prompt = buildCourseCardRevisionPrompt(context);
      const raw = await generateContent(
        prompt,
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
        {
          structured: {
            name: getCourseCardRevisionStructuredName(target),
            schema: getCourseCardRevisionSchema(target),
          },
        },
      );
      let cardValue: unknown;
      let revisedParent: CourseRevisionParent;
      try {
        cardValue = parseCourseCardRevisionPatch(raw);
        revisedParent = validateRevisedParent(target, parent, cardValue);
      } catch (caught) {
        const repairPrompt = buildCourseCardRevisionRepairPrompt(
          context,
          raw,
          toUserErrorMessage(caught),
        );
        const repairedRaw = await generateContent(
          repairPrompt,
          settings.model,
          settings.geminiKey,
          settings.openaiKey,
          settings.xaiKey,
          {
            structured: {
              name: `${getCourseCardRevisionStructuredName(target)}_repair`.slice(
                0,
                64,
              ),
              schema: getCourseCardRevisionSchema(target),
            },
          },
        );
        cardValue = parseCourseCardRevisionPatch(repairedRaw);
        revisedParent = validateRevisedParent(target, parent, cardValue);
      }
      setRevisionDraft({
        target,
        before: currentCard,
        value: getCourseCardValue(revisedParent, target),
        parent: revisedParent,
      });
    } catch (caught) {
      setRevisionError(
        caught instanceof CourseIdeationResponseError
          ? caught.message
          : toUserErrorMessage(caught),
      );
    } finally {
      setRevisionBusy(false);
      setPendingRevisionTarget(null);
    }
  };

  const requestAiRevision = () => {
    if (!revisionTarget) return;
    const parent = revisionParentForTarget(revisionTarget, {
      analysis,
      alignment,
      evidencePlan,
      courseAssessmentSeed,
      unitBlueprint,
    });
    if (!parent) {
      setRevisionError("目前沒有可修改的內容。");
      return;
    }
    const isEvidenceTarget = !(
      revisionTarget.kind.startsWith("keyword_") ||
      revisionTarget.kind === "curriculum_signal" ||
      revisionTarget.kind === "suggested_keywords" ||
      revisionTarget.kind === "curriculum_rationale" ||
      revisionTarget.kind === "six_c_recommendation" ||
      revisionTarget.kind === "desired_result" ||
      revisionTarget.kind === "learning_outcome" ||
      revisionTarget.kind === "four_element" ||
      revisionTarget.kind === "evidence_tools" ||
      revisionTarget.kind === "course_narrative_level" ||
      revisionTarget.kind === "unit_arc" ||
      revisionTarget.kind === "lesson"
    );
    if (
      isEvidenceTarget &&
      (!desiredResultsConfirmedAt ||
        alignmentAudit.desiredResults !== "current")
    ) {
      setRevisionError("請先確認目前的學習終點，再用 AI 修改評量證據。");
      return;
    }
    if (
      (revisionTarget.kind === "unit_arc" ||
        revisionTarget.kind === "lesson") &&
      (!evidencePlanConfirmedAt ||
        alignmentAudit.desiredResults !== "current" ||
        alignmentAudit.evidencePlan !== "current")
    ) {
      setRevisionError("請先確認目前的評量證據，再用 AI 修改單元節次藍圖。");
      return;
    }
    try {
      const currentCard = getCourseCardValue(parent, revisionTarget);
      if (currentCard === undefined) throw new Error("目前沒有可修改的內容。");
      buildCourseCardRevisionPrompt({
        target: revisionTarget,
        input,
        instruction: revisionInstruction,
        currentCard,
        parent,
        desiredResults,
        evidencePlan,
        unitConstraints,
        selectedIndicatorId,
      });
    } catch (caught) {
      setRevisionError(toUserErrorMessage(caught));
      return;
    }
    if (!hasModelAccess) {
      setRevisionError(`請先設定 ${providerName(settings.model)} API Key。`);
      onOpenAiSettings();
      return;
    }
    if (!consentGranted) {
      setPendingAction(null);
      setPendingRevisionTarget(revisionTarget);
      setConsentOpen(true);
      return;
    }
    void executeAiRevision(revisionTarget);
  };

  const applyAiRevision = () => {
    if (!revisionDraft || revisionDraft.target !== revisionTarget) return;
    const target = revisionDraft.target;
    if (
      target.kind === "keyword_summary" ||
      target.kind === "keyword_theme" ||
      target.kind === "curriculum_signal" ||
      target.kind === "suggested_keywords"
    ) {
      setAnalysis(revisionDraft.parent as KeywordAnalysisResult);
      setAlignment(null);
      setCurriculumSelection(null);
      setCurriculumRecommendation(null);
      setSelectedIndicatorId("");
      invalidateDesignAfterEndpointChange();
    } else if (
      target.kind === "curriculum_rationale" ||
      target.kind === "six_c_recommendation" ||
      target.kind === "desired_result" ||
      target.kind === "learning_outcome" ||
      target.kind === "four_element" ||
      target.kind === "evidence_tools"
    ) {
      const nextAlignment = revisionDraft.parent as CourseAlignmentResult;
      const nextIndicatorId =
        nextAlignment.recommendations.find(
          (item) => item.indicatorId === selectedIndicatorId,
        )?.indicatorId ?? nextAlignment.recommendations[0].indicatorId;
      setAlignment(nextAlignment);
      setCurriculumSelection(nextAlignment.curriculumSelection);
      setSelectedIndicatorId(nextIndicatorId);
      setDesiredResults(buildDesiredResults(nextAlignment));
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
    } else if (target.kind === "course_narrative_level") {
      setCourseAssessmentSeed(
        revisionDraft.parent as CourseAssessmentSeedV1,
      );
      setAssessmentSeedError(null);
      setUnitBlueprintConfirmedAt(null);
      setLessonPromptStatus([]);
      setPromptPreview(null);
      setAlignmentAudit((current) => ({
        ...current,
        unitBlueprint: unitBlueprint ? "stale" : "empty",
      }));
    } else if (target.kind !== "unit_arc" && target.kind !== "lesson") {
      setEvidencePlan(revisionDraft.parent as EvidencePlanResult);
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
    } else {
      const nextBlueprint = revisionDraft.parent as UnitBlueprintResult;
      setUnitBlueprint(nextBlueprint);
      setUnitBlueprintConfirmedAt(null);
      setLessonPromptStatus([]);
      setPromptPreview(null);
      setBlueprintError(null);
      setAlignmentAudit((current) => ({
        ...current,
        unitBlueprint: "current",
      }));
    }
    setRevisionTarget(null);
    setRevisionInstruction("");
    setRevisionDraft(null);
    setRevisionError(null);
  };

  const closeAiRevision = () => {
    if (revisionBusy) return;
    setRevisionTarget(null);
    setPendingRevisionTarget(null);
    setRevisionInstruction("");
    setRevisionDraft(null);
    setRevisionError(null);
  };

  const confirmConsent = () => {
    const action = pendingAction;
    const revision = pendingRevisionTarget;
    writeJson(KEYS.courseIdeationConsent, {
      version: CONSENT_VERSION,
      acceptedAt: Date.now(),
    });
    setConsentGranted(true);
    setConsentOpen(false);
    setPendingAction(null);
    setPendingRevisionTarget(null);
    if (action) void executeAction(action);
    if (revision) void executeAiRevision(revision);
  };

  const revokeConsent = () => {
    removeStorage(KEYS.courseIdeationConsent);
    setConsentGranted(false);
  };

  const loadTestExample = (exampleId: string) => {
    setCourseOriginMode("new");
    setInput(createCourseIdeationExampleInput(exampleId));
    setAnalysis(null);
    setAlignment(null);
    setCurriculumSelection(null);
    setCurriculumRecommendation(null);
    setCustomCurriculumEntries([]);
    setLessonReferenceAnalysis(null);
    setAppliedLessonReference(null);
    setExtractedLessonReference(null);
    setReferenceFileName("");
    setLessonPasteDraft("");
    setReferenceSelection(new Set());
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
    setDesiredResults(null);
    setDesiredResultsConfirmedAt(null);
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

  const generateDesiredResults = () => {
    if (!alignment || !selectedIndicatorId) {
      setError("請先完成 6Cs 校準並選擇子向度。");
      setActiveDesignTab("alignment");
      setManualDesignTab(true);
      return;
    }
    setDesiredResults(buildDesiredResults(alignment));
    setDesiredResultsConfirmedAt(null);
    setAlignmentAudit((current) => ({
      ...current,
      desiredResults: "empty",
      evidencePlan: evidencePlan ? "stale" : "empty",
      unitBlueprint: unitBlueprint ? "stale" : "empty",
    }));
    setError(null);
    setActiveDesignTab("desired-results");
    setManualDesignTab(true);
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
    } else if (id === "learning-design-assessment-seed") {
      setAssessmentSeedError(message);
    }
  };

  const markEvidenceEdited = () => {
    setEvidencePlanConfirmedAt(null);
    setUnitBlueprintConfirmedAt(null);
    setLessonPromptStatus([]);
    setPromptPreview(null);
    setEvidenceError(null);
    setAssessmentSeedError(null);
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
      const target = document.getElementById(
        "learning-design-assessment-seed",
      );
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
      void copyPromptText(
        promptPackage,
        promptPackage.fullPrompt,
        "教師備課提示詞",
      );
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
    anchor.download = `NPDL-${input.unitName}-${unitBlueprint.lessons.length}節教師備課教案-Gemini-Canvas提示詞.md`
      .replace(/[\\/:*?"<>|]/g, "-");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError(null);
  };

  const createWorksheetPromptPackage = (): LessonPromptPackage | null => {
    try {
      return buildUnitWorksheetPromptPackage(currentProject);
    } catch (caught) {
      setError(toUserErrorMessage(caught));
      return null;
    }
  };

  const createPrepCoachGemPackage = (): LessonPromptPackage | null => {
    try {
      return buildUnitPrepCoachGemPackage(currentProject);
    } catch (caught) {
      setError(toUserErrorMessage(caught));
      return null;
    }
  };

  const previewPrepCoachGem = () => {
    const promptPackage = createPrepCoachGemPackage();
    if (promptPackage) {
      setPromptPreview(promptPackage);
      setCopyNotice(null);
    }
  };

  const copyPrepCoachGemInstructions = () => {
    const promptPackage = createPrepCoachGemPackage();
    if (promptPackage) {
      void copyPromptText(
        promptPackage,
        promptPackage.gemInstructions,
        "備課諮詢 Gem 指令（含設計錨點）",
      );
    }
  };

  const downloadPrepCoachGemPackage = () => {
    const promptPackage = createPrepCoachGemPackage();
    if (!promptPackage || !unitBlueprint) return;
    const blob = new Blob([promptPackage.gemInstructions], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `NPDL-${input.unitName}-備課諮詢Gem指令.md`.replace(
      /[\\/:*?"<>|]/g,
      "-",
    );
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError(null);
  };

  const openGeminiGemsManager = () => {
    window.open("https://gemini.google.com/gems/view", "_blank", "noopener,noreferrer");
    setCopyNotice(
      "已開啟 Gemini Gem 管理頁。請把剛複製的「Gem 指令（含設計錨點）」整段貼進自訂指令即可，無需另附檔。",
    );
  };

  const previewWorksheetPrompt = () => {
    const promptPackage = createWorksheetPromptPackage();
    if (promptPackage) {
      setPromptPreview(promptPackage);
      setCopyNotice(null);
    }
  };

  const copyWorksheetPrompt = () => {
    const promptPackage = createWorksheetPromptPackage();
    if (promptPackage) {
      void copyPromptText(
        promptPackage,
        promptPackage.fullPrompt,
        "學習單提示詞",
      );
    }
  };

  const downloadWorksheetPrompt = () => {
    const promptPackage = createWorksheetPromptPackage();
    if (!promptPackage || !unitBlueprint) return;
    const blob = new Blob([promptPackage.fullPrompt], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `NPDL-${input.unitName}-${unitBlueprint.lessons.length}節學習單學生版與教師參考解答-Gemini-Canvas提示詞.md`
      .replace(/[\\/:*?"<>|]/g, "-");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setError(null);
  };

  const openGeminiCanvasDocument = async (kind: UnitCanvasDocumentKind) => {
    if (!canvasReady || canvasGeneratingKind) return;
    const promptPackage =
      kind === "teacher_prep"
        ? createPromptPackage()
        : createWorksheetPromptPackage();
    if (!promptPackage || !unitBlueprint) return;

    const statusLessonId =
      kind === "teacher_prep" ? "unit-all" : "unit-worksheets";
    const progressLabel =
      kind === "teacher_prep" ? "教師備課教案" : "學生學習單";

    setCanvasGeneratingKind(kind);
    setCopyNotice(null);
    setError(null);

    try {
      if (settings.geminiKey.trim()) {
        setCopyNotice(`正在透過 Gemini 產生全部節次${progressLabel}…`);
      }
      const result = await launchUnitDocumentInCanvas({
        prompt: promptPackage.fullPrompt,
        unitName: input.unitName,
        lessonCount: unitBlueprint.lessons.length,
        kind,
        geminiKey: settings.geminiKey,
        model: settings.model,
        onProgress: (progress) => {
          setCopyNotice(
            `正在產生全部節次${progressLabel}…（已收到 ${progress.receivedChars.toLocaleString()} 字）`,
          );
        },
      });
      updateLessonPromptStatus(statusLessonId, {
        generatedExternally: result.mode === "generated",
        lastCopiedAt: Date.now(),
      });
      setCopyNotice(result.message);
      if (!result.canvasOpened) {
        setError(
          "瀏覽器可能封鎖了彈出視窗。請允許本站彈出視窗後再按一次，或手動開啟 https://gemini.google.com/canvas 後貼上。",
        );
      }
    } catch (caught) {
      setError(toUserErrorMessage(caught));
      setCopyNotice(null);
    } finally {
      setCanvasGeneratingKind(null);
    }
  };

  const getDiagnosticExportContext = () => {
    if (!canExportDiagnosticDocuments || !courseAssessmentSeed || !assessmentForm) {
      setDiagnosticDocStatus("請先產生診斷題組後再下載 Word。");
      setAssessmentSeedError("請先產生最新的課程敘述語與診斷題組。");
      return null;
    }
    setAssessmentSeedError(null);
    return {
      seed: courseAssessmentSeed,
      form: assessmentForm,
      options: {
        indicatorName: diagnosticIndicatorName,
        unitName: input.unitName,
        preContent: preAssessmentContent,
      },
    };
  };

  const downloadDiagnosticQuestionsDocx = async () => {
    const context = getDiagnosticExportContext();
    if (!context) return;
    setDiagnosticDocExporting("questions");
    setDiagnosticDocStatus("正在產生診斷題目 Word…");
    setAssessmentSeedError(null);
    try {
      const markdown = renderDiagnosticQuestionsMarkdown({
        form: context.form,
        unitName: context.options.unitName,
        indicatorName: context.options.indicatorName,
        preContent: context.options.preContent,
      });
      if (!markdown.trim()) {
        throw new Error("診斷題目內容為空，請重新產生診斷題組。");
      }
      await downloadTeacherDocumentDocx({
        title: `${input.unitName}｜診斷題組（題目卷）`,
        markdown,
        fileName: `NPDL-${input.unitName}-診斷題目.docx`.replace(
          /[\\/:*?"<>|]/g,
          "-",
        ),
      });
      setDiagnosticDocStatus("診斷題目 Word 已開始下載。");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "診斷題目 Word 產生失敗，請稍後再試。";
      setDiagnosticDocStatus(message);
      setAssessmentSeedError(message);
    } finally {
      setDiagnosticDocExporting(null);
    }
  };

  const downloadDiagnosticGuideDocx = async () => {
    const context = getDiagnosticExportContext();
    if (!context) return;
    setDiagnosticDocExporting("guide");
    setDiagnosticDocStatus("正在產生診斷指南 Word…");
    setAssessmentSeedError(null);
    try {
      const markdown = renderDiagnosticTeacherGuideMarkdown(
        context.seed,
        context.form,
        context.options,
      );
      if (!markdown.trim()) {
        throw new Error("診斷指南內容為空，請重新產生診斷題組。");
      }
      await downloadTeacherDocumentDocx({
        title: `${input.unitName}｜診斷指南（教師用）`,
        markdown,
        fileName: `NPDL-${input.unitName}-診斷指南.docx`.replace(
          /[\\/:*?"<>|]/g,
          "-",
        ),
      });
      setDiagnosticDocStatus("診斷指南 Word 已開始下載。");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "診斷指南 Word 產生失敗，請稍後再試。";
      setDiagnosticDocStatus(message);
      setAssessmentSeedError(message);
    } finally {
      setDiagnosticDocExporting(null);
    }
  };

  const persistDiagnosticFormsRecord = (record: GoogleFormsExportRecord) => {
    const records = readJson<Record<string, GoogleFormsExportRecord>>(
      KEYS.googleFormsExports,
      {},
    );
    records[record.fingerprint] = record;
    writeJson(KEYS.googleFormsExports, records);
    setFormsExportRecord(record);
  };

  const exportDiagnosticGoogleForm = async () => {
    if (!googleOAuth.ready) {
      setFormsExportStatus("正在載入 Google Forms 設定…");
      return;
    }
    if (diagnosticFormsExportIssue) {
      setFormsExportStatus(diagnosticFormsExportIssue);
      return;
    }
    if (googleClientIdIssue) {
      if (googleClientIdManaged) {
        setFormsExportStatus(
          "Google Forms 部署設定未完成，請聯絡管理者確認 OAuth Client ID。",
        );
      } else {
        setGoogleFormsSettingsOpen(true);
      }
      return;
    }
    if (!assessmentForm || !preAssessmentContent.trim()) return;
    setFormsExporting(true);
    setFormsExportStatus("正在登入 Google，授權後會建立診斷題組問卷。");
    try {
      const result = await createGoogleFormsFromAssessment({
        clientId: googleClientId,
        form: assessmentForm,
        indicatorName: diagnosticIndicatorName,
        preContent: preAssessmentContent,
        postContent: "",
        existing: formsExportRecord,
        onProgress: persistDiagnosticFormsRecord,
      });
      persistDiagnosticFormsRecord(result);
      setFormsExportStatus(
        isGoogleFormExportEntryComplete(result.pre)
          ? "診斷題組問卷已建立。"
          : result.pre
            ? "問卷尚未完成，可按同一按鈕重試；已完成者不會重建。"
            : "問卷建立失敗，請重試。",
      );
    } catch (error) {
      setFormsExportStatus(
        error instanceof Error ? error.message : "Google 問卷建立失敗。",
      );
    } finally {
      setFormsExporting(false);
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
      alignmentAudit.evidencePlan !== "current" ||
      !assessmentSeedCurrent
    ) {
      setError(
        "請先確認學習終點、評量證據，並產生最新的課程敘述語與診斷題組。",
      );
      return;
    }
    if (
      !unitBlueprint ||
      !unitBlueprintConfirmedAt ||
      alignmentAudit.unitBlueprint !== "current"
    ) {
      scrollToDesignStep(
        "learning-design-blueprint",
        "請先完成最新的單元節次藍圖，再進入課後評量。",
      );
      return;
    }
    setError(null);
    setHandoffPreviewOpen(true);
  };

  const confirmHandoffToAssessment = () => {
    if (!alignment || !assessmentSeedCurrent) {
      setHandoffPreviewOpen(false);
      setError("課程端評量資料已變更，請重新檢查後再繼續。");
      return;
    }
    try {
      const projectForHandoff: LearningDesignProjectV1 = {
        ...currentProject,
        updatedAt: Date.now(),
      };
      writeJson(KEYS.learningDesignProject, projectForHandoff);
      // 合併版不再寫跨工作區 one-shot handoff；保留專案為單一真相。
      removeStorage(KEYS.courseIdeationHandoff);
      setHandoffPreviewOpen(false);
      setActiveDesignTab("post-assessment");
      setManualDesignTab(true);
    } catch (caught) {
      setError(toUserErrorMessage(caught));
    }
  };

  const handoffReady =
    alignmentAudit.desiredResults === "current" &&
    alignmentAudit.evidencePlan === "current" &&
    Boolean(evidencePlanConfirmedAt) &&
    assessmentSeedCurrent &&
    alignmentAudit.unitBlueprint === "current" &&
    Boolean(unitBlueprintConfirmedAt);
  const canvasReady =
    alignmentAudit.desiredResults === "current" &&
    alignmentAudit.evidencePlan === "current" &&
    alignmentAudit.unitBlueprint === "current" &&
    Boolean(evidencePlanConfirmedAt) &&
    Boolean(unitBlueprintConfirmedAt);
  const unitPromptGenerated = lessonPromptStatus.find(
    (status) => status.lessonId === "unit-all",
  )?.generatedExternally;
  const worksheetPromptGenerated = lessonPromptStatus.find(
    (status) => status.lessonId === "unit-worksheets",
  )?.generatedExternally;

  const alignmentStatus: WorkflowStepStatus = busyAction === "align"
    ? "working"
    : curriculumSelectionNeedsRecalibration
      ? "stale"
      : alignment
        ? "done"
        : analysis
          ? "ready"
          : "locked";
  const desiredResultsStatus: WorkflowStepStatus = !alignment
    ? "locked"
    : alignmentAudit.desiredResults === "current" && desiredResultsConfirmedAt
      ? "done"
      : desiredResults
        ? "review"
        : "ready";
  const evidenceStatus: WorkflowStepStatus = busyAction === "evidence"
    ? "working"
    : alignmentAudit.desiredResults !== "current" || !desiredResultsConfirmedAt
      ? "locked"
      : alignmentAudit.evidencePlan === "stale"
        ? "stale"
        : alignmentAudit.evidencePlan === "current" && evidencePlanConfirmedAt
          ? "done"
          : evidencePlan
            ? "review"
            : "ready";
  const assessmentSeedStatus: WorkflowStepStatus =
    busyAction === "assessment_seed"
      ? "working"
      : !evidencePlanConfirmedAt || alignmentAudit.evidencePlan !== "current"
        ? "locked"
        : assessmentSeedCurrent
          ? "done"
          : courseAssessmentSeed
            ? "stale"
            : "ready";
  const blueprintStatus: WorkflowStepStatus = busyAction === "blueprint"
    ? "working"
    : !evidencePlanConfirmedAt ||
        alignmentAudit.evidencePlan !== "current" ||
        !assessmentSeedCurrent
      ? "locked"
      : alignmentAudit.unitBlueprint === "stale"
        ? "stale"
        : alignmentAudit.unitBlueprint === "current" && unitBlueprintConfirmedAt
          ? "done"
          : unitBlueprint
            ? "review"
            : "ready";

  const selectDesignTab = (tab: CourseDesignTabId) => {
    setActiveDesignTab(tab);
    setManualDesignTab(true);
    window.setTimeout(() => {
      document
        .getElementById(`course-design-tab-${tab}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const busyActionLabel: Record<AiAction, string> = {
    analyze: "正在分析關鍵字…",
    align: "正在校準課綱與 6Cs…",
    evidence: "正在建立評量證據…",
    assessment_seed: "正在產生課程敘述與診斷題組…",
    blueprint: "正在倒推單元節次…",
    reference: "正在分析教案…",
  };

  const nextAction: WorkflowAction = busyAction
    ? {
        label: busyActionLabel[busyAction],
        description: "AI 正在處理目前步驟；完成後會自動顯示下一個可執行動作。",
        busy: true,
        onClick: () => undefined,
      }
    : !hasModelAccess
      ? {
          label: `設定 ${providerName(settings.model)} API Key`,
          description: "目前選用的 AI 供應商尚未設定 API Key，完成後即可開始課程流程。",
          icon: Settings2,
          onClick: onOpenAiSettings,
        }
      : inputErrors.length > 0
        ? {
            label: "補齊課程欄位",
            description: inputErrors[0],
            icon: Pencil,
            onClick: () => {
              setError(inputErrors[0]);
              setInputDrawerOpen(true);
            },
          }
        : !analysis
          ? {
              label: "開始分析課程關鍵字",
              description: "AI 會先整理課程重點與主題群，完成後再進入 108 課綱與 6Cs 校準。",
              icon: BrainCircuit,
              onClick: () => requestAction("analyze"),
            }
          : !alignment || curriculumSelectionNeedsRecalibration
            ? {
                label:
                  curriculumSelection?.mode === "teacher_edited"
                    ? "依教師調整重新校準"
                    : hasOfficialCurriculumPool
                      ? "進行 6Cs 校準（108 課綱可選）"
                      : "進行 6Cs 校準（可不選 108 課綱）",
                description: hasOfficialCurriculumPool
                  ? "可依建議梯隊選 0–2 項課綱，或不選課綱；AI 會產生 6Cs 主軸與學習成果。"
                  : "目前科目尚無官方課綱候選，可直接校準 6Cs；也可改選科目或加入自訂依據。",
                disabled: false,
                tone: "amber",
                icon: Target,
                onClick: () => requestAction("align"),
              }
            : !selectedIndicatorId
              ? {
                  label: "選擇 6Cs 子向度",
                  description: "選擇一個 6Cs 子向度作為主軸；108 課綱可不選或稍後調整。",
                  tone: "amber",
                  icon: Target,
                  onClick: () => selectDesignTab("alignment"),
                }
            : !desiredResults
              ? {
                  label: "生成學習終點",
                  description: "依已選定的 6Cs 子向度（及可選的 108 課綱）建立遷移目標、核心理解、核心問題與成功指標。",
                  tone: "sky",
                  icon: Sparkles,
                  onClick: generateDesiredResults,
                }
            : alignmentAudit.desiredResults !== "current" ||
                !desiredResultsConfirmedAt
              ? {
                  label: "確認學習終點，開放評量證據",
                  description: "先確認遷移目標、三層學習成果、NPDL 四要素與成功指標，後續評量才會開放。",
                  tone: "sky",
                  icon: Check,
                  onClick: confirmDesiredResults,
                }
              : alignmentAudit.evidencePlan !== "current" || !evidencePlan
                ? {
                    label: evidencePlan
                      ? "重新建立並校準評量證據"
                      : "AI 建立完整評量證據",
                    description: "依學習終點建立真實任務、診斷／遷移四階參照、形成性四階參照與四級規準。",
                    tone: "amber",
                    icon: ListChecks,
                    onClick: () => requestAction("evidence"),
                  }
                : !evidencePlanConfirmedAt
                  ? {
                      label: "確認證據，前往課程敘述與診斷題組",
                      description: "確認後會鎖定目前證據系統，並開放課程敘述語與診斷題組生成。",
                      tone: "amber",
                      icon: Check,
                      onClick: confirmEvidencePlan,
                    }
                  : !assessmentSeedCurrent
                    ? {
                        label: courseAssessmentSeed
                          ? "重新產生並校準診斷題組"
                          : "AI 產生課程敘述與診斷題組",
                        description: "產生四級課程敘述語與正式診斷題組（診斷一～四），評量端會唯讀沿用。",
                        tone: "cyan",
                        icon: BookOpenCheck,
                        onClick: () => requestAction("assessment_seed"),
                      }
                    : alignmentAudit.unitBlueprint !== "current" ||
                        !unitBlueprint
                      ? {
                          label: unitBlueprint
                            ? "重新產生單元節次藍圖"
                            : "AI 產生單元節次藍圖",
                          description: "依已確認的證據倒推節次，並分開準備教師備課與學習單的 Gemini Canvas 提示詞。",
                          tone: "indigo",
                          icon: Map,
                          disabled: unitConstraintErrors.length > 0,
                          onClick: () => requestAction("blueprint"),
                        }
                      : !unitBlueprintConfirmedAt
                        ? {
                            label: "確認藍圖並更新 Canvas",
                            description: "確認節次順序、成功指標覆蓋與證據配置後，交付中心會開放 Canvas。",
                            tone: "indigo",
                            icon: Check,
                            onClick: confirmUnitBlueprint,
                          }
                        : {
                            label: "進入課後評量與匯出",
                            description: "課程敘述語、診斷題組、遷移性四階參照與節次藍圖都已準備好。",
                            icon: ArrowRight,
                            onClick: handoffToAssessment,
                          };
  const currentCourseSummary =
    [input.grade, input.subject, input.unitName || input.teachingTopic]
      .filter(Boolean)
      .join(" · ") || "尚未完成課程設定";
  const hasPostAssessment =
    Boolean(evidencePlan?.assessmentDocument?.post) ||
    Boolean(currentProject.evidencePlan?.assessmentDocument?.post);
  const postAssessmentStatus: WorkflowStepStatus = !handoffReady
    ? "locked"
    : hasPostAssessment
      ? "ready"
      : "ready";
  const recommendedDesignTab: CourseDesignTabId = !analysis || !alignment
    ? "alignment"
    : !desiredResults ||
        alignmentAudit.desiredResults !== "current" ||
        !desiredResultsConfirmedAt
      ? "desired-results"
      : alignmentAudit.evidencePlan !== "current" || !evidencePlanConfirmedAt
        ? "evidence"
        : !assessmentSeedCurrent
          ? "assessment-seed"
          : !handoffReady
            ? "delivery"
            : "post-assessment";
  const courseTabs = [
    {
      id: "alignment" as const,
      label: "校準與選擇",
      status: alignmentStatus,
      disabled: false,
    },
    {
      id: "desired-results" as const,
      label: "學習終點",
      status: desiredResultsStatus,
      disabled: !alignment || !selectedIndicatorId,
    },
    {
      id: "evidence" as const,
      label: "評量證據",
      status: evidenceStatus,
      disabled:
        !desiredResultsConfirmedAt ||
        alignmentAudit.desiredResults !== "current",
    },
    {
      id: "assessment-seed" as const,
      label: "診斷題組",
      status: assessmentSeedStatus,
      disabled:
        !evidencePlanConfirmedAt ||
        alignmentAudit.evidencePlan !== "current",
    },
    {
      id: "delivery" as const,
      label: "節次與交付",
      status: handoffReady ? ("ready" as const) : blueprintStatus,
      disabled: !assessmentSeedCurrent,
    },
    {
      id: "post-assessment" as const,
      label: "課後與匯出",
      status: postAssessmentStatus,
      disabled: !handoffReady,
    },
  ];

  useEffect(() => {
    if (!manualDesignTab) {
      setActiveDesignTab(recommendedDesignTab);
      return;
    }
    const activeTabLocked = courseTabs.some(
      (tab) => tab.id === activeDesignTab && tab.disabled,
    );
    if (activeTabLocked) {
      setActiveDesignTab(recommendedDesignTab);
      setManualDesignTab(false);
    }
  }, [activeDesignTab, courseTabs, manualDesignTab, recommendedDesignTab]);

  return (
    <div
      className={`${embedded ? "h-full" : "h-[100dvh]"} overflow-y-auto bg-[#f3f7f4] text-zinc-900 custom-scrollbar`}
      aria-label="課程設計工作區"
      aria-hidden={!active}
    >
      {!embedded && <header className="sticky top-0 z-40 border-b border-white/50 bg-[#f3f7f4]/80 px-4 py-3 shadow-[0_1px_12px_rgba(15,45,38,0.06)] backdrop-blur-xl backdrop-saturate-150">
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
              onClick={onOpenAiSettings}
              className="rounded-xl border border-[#dfe8e2] bg-white p-2 text-zinc-600 hover:bg-[#f7faf8]"
              aria-label="開啟 AI 設定"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>}

      <main className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
        {!courseOriginMode ? (
          <section
            aria-label="選擇課程起點"
            className="mx-auto max-w-3xl rounded-3xl border border-[#dfe8e2] bg-white p-6 shadow-sm sm:p-8"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
              開始之前
            </p>
            <h2 className="mt-2 text-2xl font-black text-[#173f36]">
              先決定課程方向
            </h2>
            <p className="mt-2 text-sm font-medium leading-7 text-zinc-600">
              兩條路徑最後都會進入同一套 NPDL 構造（課綱／6Cs 校準 → 學習終點 → 評量證據 → 課前題組 → 節次藍圖），再於同頁完成課後遷移與匯出。
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => selectCourseOriginMode("existing")}
                className="flex flex-col items-start gap-3 rounded-2xl border-2 border-[#9fc2b4] bg-[#f7faf8] p-5 text-left transition hover:border-[#2f7d68] hover:bg-emerald-50 active:scale-[0.99]"
              >
                <span className="rounded-xl bg-emerald-100 p-2 text-emerald-800">
                  <FileUp className="h-5 w-5" />
                </span>
                <span className="text-base font-black text-[#173f36]">
                  已有課程
                </span>
                <span className="text-xs font-medium leading-6 text-zinc-600">
                  上傳或貼上既有教案，轉換成符合 NPDL 敘述方式的課程設計。
                </span>
              </button>
              <button
                type="button"
                onClick={() => selectCourseOriginMode("new")}
                className="flex flex-col items-start gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-5 text-left transition hover:border-amber-400 hover:bg-amber-50 active:scale-[0.99]"
              >
                <span className="rounded-xl bg-amber-100 p-2 text-amber-900">
                  <Lightbulb className="h-5 w-5" />
                </span>
                <span className="text-base font-black text-[#173f36]">
                  未有課程
                </span>
                <span className="text-xs font-medium leading-6 text-zinc-600">
                  從核心關鍵字發想，設計符合 NPDL 敘述的全新課程。
                </span>
              </button>
            </div>
          </section>
        ) : (
          <>
        <div className="mb-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#dfe8e2] bg-white/80 px-4 py-2.5">
            <p className="text-xs font-black text-[#173f36]">
              目前方向：
              {courseOriginMode === "existing"
                ? "已有課程 → 轉換為 NPDL 敘述"
                : "未有課程 → 關鍵字發想"}
            </p>
            <button
              type="button"
              onClick={requestChangeCourseOriginMode}
              className="text-[11px] font-black text-[#9a6617] underline"
            >
              更改方向
            </button>
          </div>
          <NextActionPanel
            action={nextAction}
            summary={currentCourseSummary}
          />
          <div className="flex flex-col gap-3 rounded-2xl border border-[#dfe8e2]/80 bg-white/70 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {input.coreKeywords.length > 0 ? (
                input.coreKeywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-900"
                  >
                    {keyword}
                  </span>
                ))
              ) : (
                <span className="text-xs font-bold text-zinc-500">
                  尚未輸入核心關鍵字
                </span>
              )}
              {(referenceFileName || appliedLessonReference) && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-900">
                  {referenceFileName
                    ? `已附加教案：${referenceFileName}`
                    : "已帶入既有教案參考"}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setInputDrawerOpen(true)}
              className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#b9ccc2] bg-white px-3 text-xs font-black text-[#173f36] transition active:scale-[0.97] hover:bg-emerald-50"
            >
              <Pencil className="h-3.5 w-3.5" />
              編輯課程輸入
            </button>
          </div>
          <CourseTabs
            tabs={courseTabs}
            activeTab={activeDesignTab}
            onChange={selectDesignTab}
          />
        </div>

        {error && (
          <div className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="關閉錯誤">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-4">
          <InputDrawer
            open={inputDrawerOpen}
            onClose={() => setInputDrawerOpen(false)}
          >
          <section
            id="course-input"
            className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
                  階段一
                </p>
                <h2 className="mt-1 text-xl font-black">
                  {courseOriginMode === "existing"
                    ? "既有教案 → NPDL 轉換"
                    : "輸入與啟航"}
                </h2>
                <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                  {courseOriginMode === "existing"
                    ? "上傳或貼上教案，分析後勾選可沿用內容，再補齊欄位與關鍵字並進入同一 NPDL 構造。"
                    : "四個課程欄位，加上 3–5 個核心關鍵字，發想符合 NPDL 的課程設計。"}
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

            {courseOriginMode === "existing" && (
            <section className="mt-5 rounded-xl border border-[#b9ccc2] bg-[#f7faf8] p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-emerald-100 p-2 text-emerald-800">
                  <FileUp className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-black text-[#173f36]">
                    轉換為 NPDL 敘述
                  </h3>
                  <p className="mt-1 text-[11px] font-medium leading-5 text-zinc-600">
                    上傳文字型 PDF、DOCX、UTF-8 TXT（單檔 10 MB），或直接貼上教案文字。分析前請移除學生姓名與個資；內容會傳送到目前選擇的 AI 供應商。
                  </p>
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#9fc2b4] bg-white px-3 py-3 text-xs font-black text-[#175247] hover:bg-emerald-50">
                <FileText className="h-4 w-4" />
                {referenceFileName && referenceFileName !== "貼上的教案文字"
                  ? referenceFileName
                  : "選擇一份教案附件"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  className="sr-only"
                  disabled={referenceBusy}
                  onChange={(event) => {
                    void handleLessonReferenceFile(
                      event.target.files?.[0] ?? null,
                    );
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-black text-zinc-600">
                  或貼上教案文字
                </label>
                <textarea
                  value={lessonPasteDraft}
                  onChange={(event) => setLessonPasteDraft(event.target.value)}
                  rows={5}
                  placeholder="貼上既有教案、學習目標、活動與評量說明…"
                  className="w-full resize-y rounded-xl border border-[#dfe8e2] bg-white px-3 py-2 text-xs font-medium leading-6 text-zinc-800 outline-none focus:border-[#2f7d68] focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  onClick={handleLessonReferencePaste}
                  disabled={referenceBusy || !lessonPasteDraft.trim()}
                  className="mt-2 rounded-xl border border-[#2f7d68] bg-white px-3 py-2 text-[11px] font-black text-[#175247] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  使用貼上文字
                </button>
              </div>
              {extractedLessonReference && (
                <p className="mt-2 text-[10px] font-bold text-zinc-500">
                  已擷取 {extractedLessonReference.characterCount.toLocaleString()} 字
                  {extractedLessonReference.pageCount
                    ? `／${extractedLessonReference.pageCount} 頁`
                    : ""}
                  {extractedLessonReference.truncated
                    ? "；只會傳送前 40,000 字"
                    : ""}
                </p>
              )}
              {referenceError && (
                <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] font-bold leading-5 text-red-800">
                  {referenceError}
                </p>
              )}
              <button
                type="button"
                onClick={requestLessonReferenceAnalysis}
                disabled={!extractedLessonReference || referenceBusy}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#2f7d68] bg-white py-2.5 text-xs font-black text-[#175247] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {referenceBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {referenceBusy ? "正在轉換教案…" : "AI 轉換為 NPDL 可沿用內容"}
              </button>

              {lessonReferenceAnalysis && (
                <div className="mt-4 space-y-3 border-t border-[#dfe8e2] pt-4">
                  <p className="text-xs font-black text-zinc-700">
                    勾選要帶入後續 NPDL 設計的內容
                  </p>
                  {([
                    ["course:grade", "年級", lessonReferenceAnalysis.inferredCourse.grade],
                    ["course:subject", "學科", lessonReferenceAnalysis.inferredCourse.subject],
                    ["course:unitName", "單元", lessonReferenceAnalysis.inferredCourse.unitName],
                    ["course:teachingTopic", "主題", lessonReferenceAnalysis.inferredCourse.teachingTopic],
                    [
                      "course:coreKeywords",
                      "關鍵字",
                      lessonReferenceAnalysis.inferredCourse.coreKeywords.join("、"),
                    ],
                  ] as Array<[string, string, string | undefined]>)
                    .filter(
                      (item): item is [string, string, string] =>
                        Boolean(item[2]),
                    )
                    .map(([key, label, value]) => (
                      <label key={key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#dfe8e2] bg-white p-2 text-[11px] leading-5">
                        <input
                          type="checkbox"
                          checked={referenceSelection.has(key)}
                          onChange={(event) =>
                            toggleReferenceSelection(key, event.target.checked)
                          }
                          className="mt-1 accent-emerald-700"
                        />
                        <span>
                          <strong>{label}：</strong>
                          {value}
                        </span>
                      </label>
                    ))}
                  {(
                    [
                      ["learningGoals", "學習目標"],
                      ["reusableActivities", "可沿用活動"],
                      ["assessmentIdeas", "評量構想"],
                      ["resources", "設備與資源"],
                      ["constraints", "場地／時間限制"],
                      ["differentiationSupports", "差異化支持"],
                    ] as const
                  ).map(([field, label]) =>
                    lessonReferenceAnalysis[field].length > 0 ? (
                      <fieldset key={field} className="rounded-lg border border-[#dfe8e2] bg-white p-3">
                        <legend className="px-1 text-[11px] font-black text-zinc-700">
                          {label}
                        </legend>
                        <div className="space-y-2">
                          {lessonReferenceAnalysis[field].map((value, index) => {
                            const key = `${field}:${index}`;
                            return (
                              <label key={key} className="flex cursor-pointer items-start gap-2 text-[11px] leading-5 text-zinc-700">
                                <input
                                  type="checkbox"
                                  checked={referenceSelection.has(key)}
                                  onChange={(event) =>
                                    toggleReferenceSelection(
                                      key,
                                      event.target.checked,
                                    )
                                  }
                                  className="mt-1 accent-emerald-700"
                                />
                                {value}
                              </label>
                            );
                          })}
                        </div>
                      </fieldset>
                    ) : null,
                  )}
                  {lessonReferenceAnalysis.cautions.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[10px] font-black text-amber-900">分析提醒</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4 text-[10px] font-medium leading-5 text-amber-900">
                        {lessonReferenceAnalysis.cautions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={applyLessonReferenceSelection}
                    disabled={referenceSelection.size === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173f36] py-2.5 text-xs font-black text-white disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                    帶入並繼續 NPDL 構造
                  </button>
                </div>
              )}
              {appliedLessonReference && (
                <p className="mt-3 rounded-lg bg-emerald-100 p-2 text-[11px] font-black text-emerald-900">
                  已將老師確認的教案參考加入後續課綱、評量與節次藍圖提示；請確認欄位與關鍵字後執行關鍵字分析。
                </p>
              )}
            </section>
            )}

            <button
              type="button"
              onClick={() => requestAction("analyze")}
              disabled={busyAction !== null || inputErrors.length > 0}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-[#173f36] bg-white py-3 text-sm font-black text-[#173f36] transition active:scale-[0.97] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-45"
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
          </InputDrawer>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeDesignTab}
              id={`course-design-tab-${activeDesignTab}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : tabFade}
              className="scroll-mt-24 space-y-6"
            >
            {!analysis && activeDesignTab === "alignment" && (
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

            {analysis && activeDesignTab === "alignment" && (
              <section
                id="course-keyword-analysis"
                className="scroll-mt-24 rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
                      階段一結果
                    </p>
                    <h2 className="mt-1 text-xl font-black">創意孵化與關鍵字提取器</h2>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <span className="rounded-full bg-[#eef4f0] px-3 py-2 text-[10px] font-black text-[#175247]">
                      {modelLabel.split("（")[0]}
                    </span>
                  </div>
                </div>
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold leading-7 text-amber-950">
                      {analysis.summary}
                    </p>
                    <AiRevisionButton
                      label="AI 修改這張卡"
                      onClick={() =>
                        openAiRevision({ kind: "keyword_summary" })
                      }
                      disabled={revisionBusy || busyAction !== null}
                    />
                  </div>
                </div>
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-900">
                  現場可行性基準：以台灣高中一般班級、50 分鐘課時、一般教室與少量共用裝置為預設；自然科可依物理、化學、生物或地科選用一般高中可能具備的基本實驗器材，但須確認數量、安全與可用狀態，並提供校內低科技替代方案。
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {analysis.themes.map((theme, index) => (
                    <article key={theme.label} className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-black">{theme.label}</h3>
                        <AiRevisionButton
                          label="AI 修改這張卡"
                          onClick={() =>
                            openAiRevision({ kind: "keyword_theme", index })
                          }
                          disabled={revisionBusy || busyAction !== null}
                        />
                      </div>
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
                    {analysis.curriculumSignals.map((signal, index) => (
                      <li key={signal} className="flex items-start justify-between gap-2 rounded-lg bg-[#f7faf8] p-2">
                        <span className="flex items-start gap-2">
                          <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-700" />
                          {signal}
                        </span>
                        <AiRevisionButton
                          label="AI 修改這張卡"
                          onClick={() =>
                            openAiRevision({ kind: "curriculum_signal", index })
                          }
                          disabled={revisionBusy || busyAction !== null}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
                {analysis.suggestedKeywords.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-zinc-600">可補充關鍵字</p>
                      <AiRevisionButton
                        label="AI 修改這張卡"
                        onClick={() =>
                          openAiRevision({ kind: "suggested_keywords" })
                        }
                        disabled={revisionBusy || busyAction !== null}
                      />
                    </div>
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

            {analysis && activeDesignTab === "alignment" && (
              <section
                id="course-curriculum-alignment"
                className="scroll-mt-24 rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
                      課程校準
                    </p>
                    <h2 className="mt-1 text-xl font-black">108 課綱校準</h2>
                    <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">
                      官方 108 課綱為可選。已依年級與學科篩選，再依建議梯隊（建議優先 →
                      同科類似概念 → 同科其他）排序；可不選，或最多各選 2
                      項。完成上方 6Cs 校準後仍可調整課綱並重新校準。
                    </p>
                  </div>
                  <span className="w-fit rounded-full bg-[#eef4f0] px-3 py-1 text-[10px] font-black text-[#175247]">
                    資料快照 {CURRICULUM_SNAPSHOT_VERSION}
                  </span>
                </div>

                {curriculumSelectionNeedsRecalibration && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-6 text-amber-950">
                    教師已調整課綱選擇。階段二與後續內容會保留顯示，但目前仍是舊版本；可維持不選或最多各選
                    2 項後，於下方重新校準。
                  </div>
                )}
                {curriculumSelection &&
                  alignment &&
                  !curriculumSelectionNeedsRecalibration && (
                  <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold leading-6 text-emerald-950">
                    <p>
                      {curriculumSelection.mode === "ai_auto"
                        ? "AI 自動採用"
                        : "教師調整後採用"}
                      {curriculumSelection.performanceIds.length === 0 &&
                      curriculumSelection.contentIds.length === 0
                        ? "（未選官方 108 課綱）"
                        : ""}
                      ：{curriculumSelection.rationale}
                    </p>
                    <AiRevisionButton
                      label="AI 修改這張卡"
                      onClick={() =>
                        openAiRevision({ kind: "curriculum_rationale" })
                      }
                      disabled={revisionBusy || busyAction !== null}
                    />
                  </div>
                )}

                {!alignment && !curriculumSelectionNeedsRecalibration && (
                  <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs font-bold leading-6 text-amber-950">
                    可直接按上方主按鈕完成 6Cs
                    校準（108 課綱可不選）。若要對應課綱，可先依建議梯隊勾選，或搜尋／加入自訂依據。
                  </p>
                )}

                <CurriculumMultiSelect
                  title="學習表現"
                  entries={curriculumOptions.performances}
                  selectedIds={curriculumSelection?.performanceIds ?? []}
                  recommendedIds={
                    curriculumRecommendation?.performanceIds ?? []
                  }
                  tierById={curriculumTierById}
                  maximum={2}
                  onToggle={(id, checked) =>
                    adjustCurriculumSelection(
                      "learning_performance",
                      id,
                      checked,
                    )
                  }
                />
                <CurriculumMultiSelect
                  title="學習內容"
                  entries={curriculumOptions.contents}
                  selectedIds={curriculumSelection?.contentIds ?? []}
                  recommendedIds={curriculumRecommendation?.contentIds ?? []}
                  tierById={curriculumTierById}
                  maximum={2}
                  onToggle={(id, checked) =>
                    adjustCurriculumSelection(
                      "learning_content",
                      id,
                      checked,
                    )
                  }
                />

                {curriculumSelectionNeedsRecalibration && (
                  <button
                    type="button"
                    onClick={() => requestAction("align")}
                    disabled={busyAction !== null}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white py-3 text-sm font-black text-amber-950 transition active:scale-[0.97] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busyAction === "align" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Target className="h-4 w-4" />
                    )}
                    {busyAction === "align"
                      ? "正在校準課綱與 6Cs…"
                      : "依教師調整重新校準"}
                  </button>
                )}

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
              </section>
            )}

            {alignment && (
              <>
                {false && <nav
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
                </nav>}

                {activeDesignTab === "alignment" && (
                <section className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
                        階段二
                      </p>
                      <h2 className="mt-1 text-xl font-black">6Cs 子向度推薦</h2>
                      <p className="mt-1 text-xs font-bold text-zinc-500">
                        選擇一個子向度作為後續評量設計主軸。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    {alignment.recommendations.map((recommendation) => {
                      const indicator = getIndicatorById(recommendation.indicatorId);
                      if (!indicator) return null;
                      const selected = selectedIndicatorId === recommendation.indicatorId;
                      return (
                        <article
                          key={recommendation.indicatorId}
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-[#173f36] bg-[#173f36] text-white shadow-md"
                              : "border-[#dfe8e2] bg-[#f7faf8] hover:border-[#b9ccc2]"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${selected ? "text-emerald-200" : "text-emerald-700"}`}>
                                {indicator.dimension} · {indicator.id}
                              </p>
                              <h3 className="mt-1 text-base font-black">{indicator.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <AiRevisionButton
                                label="AI 修改這張卡"
                                onClick={() =>
                                  openAiRevision({
                                    kind: "six_c_recommendation",
                                    indicatorId: recommendation.indicatorId,
                                  })
                                }
                                disabled={revisionBusy || busyAction !== null}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  chooseIndicator(recommendation.indicatorId)
                                }
                                className={`rounded-lg border px-3 py-2 text-xs font-black ${
                                  selected
                                    ? "border-white bg-white text-[#173f36]"
                                    : "border-[#b9ccc2] bg-white text-[#173f36]"
                                }`}
                              >
                                {selected ? "已選主軸" : "選為主軸"}
                              </button>
                            </div>
                          </div>
                          <p className={`mt-3 text-sm font-medium leading-7 ${selected ? "text-emerald-50" : "text-zinc-600"}`}>
                            {recommendation.reason}
                          </p>
                          <p className={`mt-3 text-xs font-black ${selected ? "text-amber-200" : "text-[#9a6617]"}`}>
                            註：關鍵字｜{recommendation.matchedKeywords.join("、")}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                  {selectedIndicator && <ProgressionPanel indicatorId={selectedIndicator.id} />}
                </section>
                )}

                {!desiredResults && activeDesignTab === "desired-results" && (
                  <section
                    id="learning-design-desired-results"
                    className="rounded-2xl border border-sky-200 bg-white p-6 text-center shadow-sm"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                      步驟 04
                    </p>
                    <h2 className="mt-2 text-xl font-black text-sky-950">
                      生成學習終點
                    </h2>
                    <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-7 text-zinc-600">
                      已完成課綱與 6Cs 校準。請先確認學習表現、學習內容及 6Cs
                      子向度，再生成遷移目標、核心理解、核心問題與成功指標。
                    </p>
                    <button
                      type="button"
                      onClick={generateDesiredResults}
                      className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-800 px-6 text-sm font-black text-white hover:bg-sky-900"
                    >
                      <Sparkles className="h-4 w-4" />
                      生成學習終點
                    </button>
                  </section>
                )}

                {desiredResults && alignment && activeDesignTab === "desired-results" && (
                  <section
                    id="learning-design-desired-results"
                    tabIndex={-1}
                    className="scroll-mt-24 space-y-6 outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-sm sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                            步驟 04 · 學習終點與設計依據
                          </p>
                          <h2 className="mt-1 text-xl font-black tracking-tight text-sky-950">
                            鎖定學習終點
                          </h2>
                          <p className="mt-1 text-xs font-bold leading-6 text-sky-800">
                            確認後才會開放評量證據；若更動課程、課綱或 6Cs，後續內容會標示需要重新校準。
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
                          {
                            label: "遷移目標",
                            field: "transferGoals" as const,
                            items: desiredResults.transferGoals,
                          },
                          {
                            label: "核心理解",
                            field: "enduringUnderstandings" as const,
                            items: desiredResults.enduringUnderstandings,
                          },
                          {
                            label: "核心問題",
                            field: "essentialQuestions" as const,
                            items: desiredResults.essentialQuestions,
                          },
                        ].map(({ label, field, items }) => (
                          <article
                            key={label}
                            className="rounded-xl border border-sky-200 bg-white p-4"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="text-xs font-black text-sky-900">
                                {label}
                              </h3>
                              <AiRevisionButton
                                label="AI 修改這張卡"
                                onClick={() =>
                                  openAiRevision({
                                    kind: "desired_result",
                                    field,
                                  })
                                }
                                disabled={revisionBusy || busyAction !== null}
                              />
                            </div>
                            <ul className="mt-2 space-y-2 text-xs font-medium leading-6 text-zinc-700">
                              {items.map((item) => (
                                <li key={item} className="flex items-start gap-2">
                                  <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-sky-700" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-violet-100 p-2 text-violet-800">
                          <BookOpenCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black tracking-tight text-zinc-950">
                            三層學習成果
                          </h2>
                          <p className="text-xs font-bold leading-6 text-zinc-500">
                            成功指標在此為唯一權威顯示；評量證據分頁只引用勾選。
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <article className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                              01 知識基礎
                            </p>
                            <AiRevisionButton
                              label="AI 修改這張卡"
                              onClick={() =>
                                openAiRevision({
                                  kind: "learning_outcome",
                                  outcomeId: "knowledge-foundation",
                                })
                              }
                              disabled={revisionBusy || busyAction !== null}
                            />
                          </div>
                          <details className="mt-3 rounded-lg border border-violet-100 bg-white p-3">
                            <summary className="cursor-pointer text-xs font-black text-violet-700">
                              已選課綱{" "}
                              {alignment.curriculumSelection.performanceIds.length +
                                alignment.curriculumSelection.contentIds.length}{" "}
                              項 · 查看完整內容
                            </summary>
                            <div className="mt-2 flex flex-wrap gap-2">
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
                                  <span
                                    key={id}
                                    className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-black text-[#173f36] ring-1 ring-violet-200"
                                  >
                                    {entry.code}
                                  </span>
                                );
                              })}
                            </div>
                            <ul className="mt-3 space-y-2 text-xs font-medium leading-6 text-zinc-700">
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
                          </details>
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
                            {sanitizeGeneratedText(
                              alignment.learningOutcomes.knowledgeFoundation
                                .evidence,
                            )}
                          </p>
                        </article>
                        {[
                          {
                            label: "02 素養子向度",
                            outcomeId: "competency-subdimension",
                            outcome:
                              alignment.learningOutcomes.competencySubdimension,
                          },
                          {
                            label: "03 四要素整合實踐",
                            outcomeId: "four-elements-practice",
                            outcome:
                              alignment.learningOutcomes.fourElementsPractice,
                          },
                        ].map(({ label, outcomeId, outcome }) => (
                          <article
                            key={label}
                            className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[10px] font-black uppercase tracking-widest text-violet-700">
                                {label}
                              </p>
                              <AiRevisionButton
                                label="AI 修改這張卡"
                                onClick={() =>
                                  openAiRevision({
                                    kind: "learning_outcome",
                                    outcomeId,
                                  })
                                }
                                disabled={revisionBusy || busyAction !== null}
                              />
                            </div>
                            <p className="mt-2 text-sm font-black leading-7 text-zinc-800">
                              {sanitizeGeneratedText(outcome.statement)}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-6 text-zinc-600">
                              <span className="font-black">可觀察證據：</span>
                              {sanitizeGeneratedText(outcome.evidence)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#dfe8e2] bg-white p-5 shadow-sm sm:p-6">
                      <h2 className="text-xl font-black tracking-tight text-zinc-950">
                        NPDL 學習設計四要素
                      </h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-zinc-500">
                        不是 4E 教學循環；四個要素共同支撐深度學習設計。
                      </p>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {alignment.fourElements.map((element) => (
                          <article
                            key={element.name}
                            className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-black text-[#173f36]">
                                {element.name}
                              </h3>
                              <AiRevisionButton
                                label="AI 修改這張卡"
                                onClick={() =>
                                  openAiRevision({
                                    kind: "four_element",
                                    name: element.name,
                                  })
                                }
                                disabled={revisionBusy || busyAction !== null}
                              />
                            </div>
                            <div className="mt-3 space-y-2">
                              <DrawerText
                                label={`${element.name}｜設計動作`}
                                text={element.designMove}
                                tone="emerald"
                                onOpen={setContentDrawer}
                              />
                              <DrawerText
                                label={`${element.name}｜學生證據`}
                                text={element.studentEvidence}
                                tone="zinc"
                                onOpen={setContentDrawer}
                              />
                            </div>
                          </article>
                        ))}
                      </div>
                      <article className="mt-4 rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-black text-[#173f36]">
                            證據工具
                          </h3>
                          <AiRevisionButton
                            label="AI 修改這張卡"
                            onClick={() =>
                              openAiRevision({ kind: "evidence_tools" })
                            }
                            disabled={revisionBusy || busyAction !== null}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {alignment.evidenceTools.map((tool) => (
                            <span
                              key={tool}
                              className="rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-zinc-700 ring-1 ring-[#dfe8e2]"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      </article>
                    </div>

                    <button
                      type="button"
                      onClick={confirmDesiredResults}
                      disabled={alignmentAudit.desiredResults === "current"}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white py-3 text-sm font-black text-sky-950 transition active:scale-[0.97] hover:bg-sky-50 disabled:cursor-default disabled:border-emerald-300 disabled:bg-emerald-50 disabled:text-emerald-900"
                    >
                      <Check className="h-4 w-4" />
                      {alignmentAudit.desiredResults === "current"
                        ? "學習終點已確認，評量證據已開放"
                        : "確認學習終點，開放評量證據"}
                    </button>
                  </section>
                )}

                {activeDesignTab === "evidence" && (
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
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
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
                  </div>

                  {alignmentAudit.desiredResults !== "current" && (
                    <p className="mt-4 rounded-xl border border-amber-300 bg-white p-3 text-xs font-bold leading-6 text-amber-950">
                      請先確認「學習終點」，才能讓 AI 依成功指標建立證據系統。
                    </p>
                  )}
                  {alignmentAudit.desiredResults === "current" && !evidencePlan && (
                    <p className="mt-4 rounded-xl border border-amber-200 bg-white p-3 text-xs font-bold leading-6 text-amber-950">
                      請先用上方主按鈕建立完整評量證據；產生後再於此處審閱與確認。
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
                      <div
                        role="tablist"
                        aria-label="評量證據內容切換"
                        className="flex gap-2 overflow-x-auto rounded-xl border border-amber-200 bg-white p-2 custom-scrollbar"
                      >
                        {[
                          ["performance-task", "真實任務"],
                          ["questions", "四階參照"],
                          ["evidence-items", "證據項目"],
                          ["rubric", "四級規準"],
                          ["edit", evidencePlanConfirmedAt ? "查看已鎖定內容" : "逐項編修"],
                        ].map(([id, label]) => {
                          const selected = evidencePanel === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="tab"
                              aria-selected={selected}
                              onClick={() => setEvidencePanel(id as EvidencePanelId)}
                              className={`min-h-10 shrink-0 rounded-lg px-3 text-xs font-black transition ${
                                selected
                                  ? "bg-amber-800 text-white shadow-sm"
                                  : "bg-amber-50 text-amber-950 hover:bg-amber-100"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {evidencePanel === "performance-task" && (
                      <article className="rounded-xl border border-amber-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-black text-amber-950">
                            真實總結任務
                          </h3>
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-900">
                            台灣高中現場可行
                          </span>
                          <AiRevisionButton
                            label="AI 修改這張卡"
                            onClick={() =>
                              openAiRevision({ kind: "performance_task" })
                            }
                            disabled={revisionBusy || busyAction !== null}
                          />
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
                              formatSuccessCriteriaLabels(
                                evidencePlan.performanceTask.criterionIds,
                                desiredResults?.successCriteria,
                              ),
                            ],
                          ].map(([label, value]) => (
                            <EvidenceText
                              key={label}
                              label={label}
                              text={value}
                              tone="amber"
                            />
                          ))}
                        </dl>
                      </article>
                      )}

                      {evidencePanel === "questions" && (
                      <div className="grid gap-3 lg:grid-cols-2">
                        {evidencePlan.questionMaps.map((map) => (
                          <article
                            key={map.phase}
                            className="rounded-xl border border-amber-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-sm font-black text-amber-950">
                                {designReferenceLabel(map.phase)}
                              </h3>
                              <AiRevisionButton
                                label="AI 修改這張卡"
                                onClick={() =>
                                  openAiRevision({
                                    kind: "question_context",
                                    phase: map.phase,
                                  })
                                }
                                disabled={revisionBusy || busyAction !== null}
                              />
                            </div>
                            <div className="mt-2">
                              <EvidenceText
                                label="共同問題"
                                text={map.sharedProblem}
                                tone="amber"
                              />
                            </div>
                            {map.phase === "post" && (
                              <div className="mt-2">
                                <EvidenceText
                                  label="新情境差異"
                                  text={map.transferDifference}
                                  tone="sky"
                                />
                              </div>
                            )}
                            <div className="mt-3 space-y-2">
                              {map.questions.map((question, questionIndex) => (
                                <div
                                  key={question.id}
                                  className="rounded-lg bg-amber-50 p-3 text-xs leading-6"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="font-black text-amber-900">
                                      {designStageWithFocus(
                                        questionIndex,
                                        question.focus,
                                      )}
                                    </p>
                                    <AiRevisionButton
                                      label="AI 修改這張卡"
                                      onClick={() =>
                                        openAiRevision({
                                          kind: "question_purpose",
                                          phase: map.phase,
                                          questionId: question.id,
                                        })
                                      }
                                      disabled={
                                        revisionBusy || busyAction !== null
                                      }
                                    />
                                  </div>
                                  <div className="mt-2 space-y-2">
                                    <EvidenceText
                                      label="評量目的"
                                      text={question.purpose}
                                      tone="amber"
                                    />
                                    <EvidenceText
                                      label="預期證據"
                                      text={question.observableEvidence}
                                      tone="zinc"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                      )}

                      {evidencePanel === "evidence-items" && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {evidencePlan.evidenceItems.map((item) => (
                          <article
                            key={item.id}
                            className="rounded-xl border border-amber-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="text-sm font-black text-zinc-800">
                                {item.title}
                              </h3>
                              <div className="flex items-center gap-2">
                                <span className="rounded-full bg-amber-100 px-2 py-1 text-[9px] font-black text-amber-900">
                                  {evidenceItemTypeLabel(item.type)}
                                </span>
                                <AiRevisionButton
                                  label="AI 修改這張卡"
                                  onClick={() =>
                                    openAiRevision({
                                      kind: "evidence_item",
                                      evidenceId: item.id,
                                    })
                                  }
                                  disabled={revisionBusy || busyAction !== null}
                                />
                              </div>
                            </div>
                            <div className="mt-3 space-y-2">
                              <EvidenceText
                                label="證據"
                                text={item.artifact}
                                tone="amber"
                              />
                              <EvidenceText
                                label="蒐集方式"
                                text={`${item.method}（${item.timing}）`}
                                tone="zinc"
                              />
                              <EvidenceText
                                label="教學決策"
                                text={item.decisionRule}
                                tone="emerald"
                              />
                            </div>
                            <p className="mt-2 text-[10px] font-bold leading-5 text-zinc-500">
                              對應{" "}
                              {formatSuccessCriteriaLabels(
                                item.criterionIds,
                                desiredResults?.successCriteria,
                              )}
                            </p>
                          </article>
                        ))}
                      </div>
                      )}

                      {evidencePanel === "rubric" && (
                      <section className="rounded-xl border border-amber-200 bg-white">
                        <div className="px-4 py-3 text-sm font-black text-amber-950">
                          學科成功指標四級規準
                        </div>
                        <div className="space-y-4 border-t border-amber-200 p-4">
                          <p className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold leading-6 text-cyan-900">
                            四級課程敘述語請至「診斷題組」分頁編修。
                            <button
                              type="button"
                              onClick={() => selectDesignTab("assessment-seed")}
                              className="ml-2 font-black underline transition active:scale-[0.97]"
                            >
                              前往診斷題組
                            </button>
                          </p>

                          <section className="grid gap-3">
                            {evidencePlan.rubric.map((criterion) => (
                              <article
                                key={criterion.criterionId}
                                className="rounded-lg bg-amber-50 p-3"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <h4 className="text-xs font-black text-amber-900">
                                    {successCriterionLabel(
                                      criterion.criterionId,
                                      desiredResults?.successCriteria,
                                    )}
                                  </h4>
                                  <AiRevisionButton
                                    label="AI 修改這張卡"
                                    onClick={() =>
                                      openAiRevision({
                                        kind: "rubric",
                                        criterionId: criterion.criterionId,
                                      })
                                    }
                                    disabled={revisionBusy || busyAction !== null}
                                  />
                                </div>
                                <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                                  {[
                                    ["證據有限", criterion.levels.evidenceLimited],
                                    ["萌芽", criterion.levels.emerging],
                                    ["發展", criterion.levels.developing],
                                    ["精熟", criterion.levels.mastering],
                                  ].map(([level, text]) => (
                                    <EvidenceText
                                      key={level}
                                      label={`${successCriterionLabel(
                                        criterion.criterionId,
                                        desiredResults?.successCriteria,
                                      )}｜${level}`}
                                      text={text}
                                      tone="amber"
                                    />
                                  ))}
                                </div>
                              </article>
                            ))}
                          </section>
                        </div>
                      </section>
                      )}

                      {evidencePanel === "edit" && (
                      <section
                        className="rounded-xl border border-amber-300 bg-white"
                      >
                        <div className="flex items-center gap-2 px-4 py-3 text-sm font-black text-amber-950">
                          <Pencil className="h-4 w-4" />
                          {evidencePlanConfirmedAt
                            ? "查看已鎖定的評量證據內容"
                            : "逐項編修評量證據草稿"}
                        </div>
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
                                  {designReferenceLabel(map.phase)}
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
                                  {map.questions.map((question, questionIndex) => (
                                    <article
                                      key={question.id}
                                      className="rounded-lg border border-amber-200 bg-white p-3"
                                    >
                                      <h5 className="text-xs font-black text-amber-900">
                                        {designStageWithFocus(
                                          questionIndex,
                                          question.focus,
                                        )}
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
                                      {successCriterionLabel(
                                        criterion.criterionId,
                                        desiredResults?.successCriteria,
                                      )}
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
                      </section>
                      )}

                      {evidencePlanConfirmedAt ? (
                        <button
                          type="button"
                          onClick={reopenEvidencePlan}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400 bg-white py-3 text-sm font-black text-amber-900 transition active:scale-[0.97] hover:bg-amber-50"
                        >
                          <Pencil className="h-4 w-4" />
                          重新編輯評量證據
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={confirmEvidencePlan}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400 bg-white py-3 text-sm font-black text-emerald-950 transition active:scale-[0.97] hover:bg-emerald-50"
                        >
                          <Check className="h-4 w-4" />
                          確認證據，前往課程敘述與診斷題組
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => requestAction("evidence")}
                        disabled={busyAction !== null}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white py-2.5 text-xs font-black text-amber-950 transition active:scale-[0.97] hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {busyAction === "evidence" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ListChecks className="h-3.5 w-3.5" />
                        )}
                        {busyAction === "evidence"
                          ? "正在建立評量證據…"
                          : "重新建立並校準評量證據"}
                      </button>
                    </div>
                  )}
                </section>
                )}

                {activeDesignTab === "assessment-seed" && (
                <section
                  id="learning-design-assessment-seed"
                  tabIndex={-1}
                  className="scroll-mt-24 rounded-2xl border border-cyan-200 bg-cyan-50/55 p-5 shadow-sm outline-none focus:ring-2 focus:ring-cyan-400 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">
                        逆向設計 · 第三步
                      </p>
                      <h2 className="mt-1 text-xl font-black text-cyan-950">
                        課程敘述與診斷題組
                      </h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-cyan-900/80">
                        依已確認的診斷性四階參照，產生四級學習進程與可直接使用的診斷題組（診斷一～四）。後續課後步驟會唯讀沿用課前，並依「課後遷移對齊」（plannedPostMappings）產生緊密對應的課後題組。
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black ${
                        assessmentSeedCurrent
                          ? "bg-emerald-100 text-emerald-900"
                          : courseAssessmentSeed
                            ? "bg-red-100 text-red-900"
                            : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {assessmentSeedCurrent
                        ? "診斷題組已對齊"
                        : courseAssessmentSeed
                          ? "上游已變更，需重新產生"
                          : "尚未建立"}
                    </span>
                  </div>

                  {assessmentSeedError && (
                    <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold leading-6 text-red-800">
                      {assessmentSeedError}
                    </p>
                  )}

                  {!courseAssessmentSeed && evidencePlanConfirmedAt && (
                    <p className="mt-4 rounded-xl border border-cyan-200 bg-white px-4 py-3 text-xs font-bold leading-6 text-cyan-900">
                      請先用上方主按鈕產生課程敘述語與診斷題組；產生後再於此處審閱。
                    </p>
                  )}

                  {courseAssessmentSeed &&
                    assessmentForm &&
                    assessmentSeedModules.length >= 2 && (
                      <div className="mt-5 space-y-5">
                        {!assessmentSeedCurrent && (
                          <p className="rounded-xl border border-red-200 bg-white px-4 py-3 text-xs font-bold leading-6 text-red-800">
                            學習終點或評量證據已更新。下列舊內容保留供比較；仍可下載 Word，但不可進入課後、節次藍圖或 Google Form。
                          </p>
                        )}

                        {courseNarrativeSlices.length > 0 && (
                          <div className="rounded-2xl border border-cyan-200 bg-white p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h3 className="text-sm font-black tracking-tight text-cyan-950">
                                  四級課程敘述語
                                </h3>
                                <p className="mt-1 text-[10px] font-bold leading-5 text-zinc-500">
                                  本頁為唯一權威版本：三欄全文、NPDL 指標原文對照與 AI 微調。
                                </p>
                              </div>
                              <span className="w-fit rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black text-cyan-900">
                                {courseAssessmentSeed.mode === "teacher_edited"
                                  ? "教師已調整"
                                  : "AI 草稿"}
                              </span>
                            </div>
                            <div
                              className="mt-3 flex flex-wrap gap-2"
                              role="tablist"
                              aria-label="四級課程敘述語"
                            >
                              {courseNarrativeSlices.map((slice, index) => (
                                <button
                                  key={slice.levelName}
                                  type="button"
                                  role="tab"
                                  aria-selected={assessmentNarrativeTab === index}
                                  onClick={() => setAssessmentNarrativeTab(index)}
                                  className={`min-h-10 rounded-xl px-4 py-2 text-xs font-black transition active:scale-[0.97] ${
                                    assessmentNarrativeTab === index
                                      ? "bg-[#173f36] text-white shadow-sm"
                                      : "bg-[#eef4f0] text-zinc-600 hover:bg-[#e2ebe5]"
                                  }`}
                                >
                                  {slice.levelName}
                                </button>
                              ))}
                            </div>
                            {courseNarrativeSlices.map((slice, index) =>
                              assessmentNarrativeTab === index ? (
                                <article
                                  key={slice.levelName}
                                  className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-4"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-black text-cyan-950">
                                      {slice.levelName} · 本課改寫
                                    </h4>
                                    {assessmentSeedCurrent && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const level = narrativeLevelKey(slice.levelName);
                                          if (level) {
                                            openAiRevision({
                                              kind: "course_narrative_level",
                                              level,
                                            });
                                          }
                                        }}
                                        disabled={revisionBusy || busyAction !== null}
                                        className="rounded-lg border border-[#9fc2b4] bg-white px-2.5 py-1 text-[10px] font-black text-[#175247] transition active:scale-[0.97] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                                      >
                                        微調此段
                                      </button>
                                    )}
                                  </div>
                                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                                    {[
                                      ["進程辨識線索", slice.sub.life],
                                      ["學生內在思考", slice.sub.emotion],
                                      ["教學引導與鷹架", slice.sub.practice],
                                    ].map(([label, text]) => (
                                      <section
                                        key={label}
                                        className="rounded-xl border border-[#dfe8e2] bg-white p-3"
                                      >
                                        <h5 className="text-xs font-black text-zinc-900">
                                          {label}
                                        </h5>
                                        <div className="mt-2 text-xs font-medium leading-6 text-zinc-700">
                                          <NarrativeSectionBody text={text} />
                                        </div>
                                      </section>
                                    ))}
                                  </div>
                                  {slice.originalText && (
                                    <section className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
                                      <h5 className="text-xs font-black text-cyan-950">
                                        NPDL 指標原文對照
                                      </h5>
                                      <p className="mt-2 whitespace-pre-wrap text-xs font-medium leading-6 text-zinc-700">
                                        {slice.originalText}
                                      </p>
                                    </section>
                                  )}
                                </article>
                              ) : null,
                            )}
                          </div>
                        )}

                        <div className="rounded-2xl border border-cyan-200 bg-white p-3 sm:p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <h3 className="text-sm font-black text-cyan-950">
                                {implementationGroupLabel("pre")}
                              </h3>
                              <p className="mt-1 text-[10px] font-bold leading-5 text-zinc-500">
                                主畫面只顯示題組摘要；點開抽屜查看共用情境、選項與教師判讀。
                              </p>
                            </div>
                            <span className="w-fit rounded-full bg-cyan-100 px-3 py-1 text-[10px] font-black text-cyan-900">
                              {preAssessmentPreview?.questions.length ?? 0} 題
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {(preAssessmentPreview?.questions ?? []).map(
                              (question, index) => {
                                const mapping =
                                  courseAssessmentSeed.preMappings[index];
                                const itemLabel = implementationItemWithFocus(
                                  "pre",
                                  index,
                                  mapping?.focus,
                                );
                                return (
                                  <article
                                    key={question.rawTitle}
                                    className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-cyan-700">
                                          {itemLabel}
                                        </p>
                                        <h4 className="mt-1 text-xs font-black text-cyan-950">
                                          {mapping?.purpose ?? "診斷題目"}
                                        </h4>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setContentDrawer({
                                            eyebrow: implementationGroupLabel("pre"),
                                            title: `${itemLabel} · 題目內容`,
                                            body: (
                                              <AssessmentQuestionDetail
                                                phase="pre"
                                                index={index}
                                                question={question}
                                                scenario={preAssessmentPreview?.scenario}
                                                focus={mapping?.focus}
                                                purpose={mapping?.purpose}
                                                criterionIds={mapping?.criterionIds}
                                                criterionLabels={
                                                  mapping?.criterionIds?.map(
                                                    (id) =>
                                                      successCriterionLabel(
                                                        id,
                                                        desiredResults?.successCriteria,
                                                      ),
                                                  ) ?? []
                                                }
                                                observableEvidence={mapping?.observableEvidence}
                                              />
                                            ),
                                          })
                                        }
                                        className="shrink-0 rounded-lg border border-cyan-200 bg-white px-2.5 py-1 text-[10px] font-black text-cyan-950 hover:bg-cyan-100"
                                      >
                                        查看完整內容
                                      </button>
                                    </div>
                                    <p className="mt-2 line-clamp-2 text-xs font-medium leading-6 text-zinc-700">
                                      {assessmentQuestionPreviewLine(question) ||
                                        "（尚未解析題幹）"}
                                    </p>
                                    {mapping && (
                                      <p className="mt-2 line-clamp-2 text-[10px] font-bold leading-5 text-cyan-800">
                                        預期證據：{mapping.observableEvidence}
                                      </p>
                                    )}
                                  </article>
                                );
                              },
                            )}
                          </div>
                        </div>

                        <article className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
                          <h3 className="text-sm font-black text-cyan-950">
                            產出診斷文件
                          </h3>
                          <p className="mt-1 text-xs font-bold leading-6 text-cyan-800">
                            分別下載可編輯 Word 版學生題目卷與教師診斷指南，或建立
                            Google Form 問卷供線上填答。
                          </p>
                          {!canExportDiagnosticDocuments && (
                            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold leading-5 text-amber-900">
                              請先產生診斷題組，Word 下載才會啟用。
                            </p>
                          )}
                          {canExportDiagnosticDocuments && !assessmentSeedCurrent && (
                            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold leading-5 text-amber-900">
                              目前為舊版診斷題組；Word 仍可下載，但建議重新產生後再進入課後。
                            </p>
                          )}
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => void downloadDiagnosticQuestionsDocx()}
                              disabled={
                                !canExportDiagnosticDocuments ||
                                diagnosticDocExporting !== null
                              }
                              title={
                                !canExportDiagnosticDocuments
                                  ? "請先產生診斷題組"
                                  : undefined
                              }
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 text-xs font-black text-cyan-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {diagnosticDocExporting === "questions" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              {diagnosticDocExporting === "questions"
                                ? "產生 Word 中…"
                                : "下載診斷題目 Word"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void downloadDiagnosticGuideDocx()}
                              disabled={
                                !canExportDiagnosticDocuments ||
                                diagnosticDocExporting !== null
                              }
                              title={
                                !canExportDiagnosticDocuments
                                  ? "請先產生診斷題組"
                                  : undefined
                              }
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300 bg-white px-4 text-xs font-black text-cyan-950 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {diagnosticDocExporting === "guide" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                              {diagnosticDocExporting === "guide"
                                ? "產生 Word 中…"
                                : "下載診斷指南 Word"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void exportDiagnosticGoogleForm()}
                              disabled={
                                !googleOAuth.ready ||
                                formsExporting ||
                                Boolean(diagnosticFormsExportIssue)
                              }
                              title={
                                diagnosticFormsExportIssue ??
                                googleClientIdIssue ??
                                undefined
                              }
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173f36] px-4 text-xs font-black text-white hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2"
                            >
                              {formsExporting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                              {!googleOAuth.ready
                                ? "載入 Google Forms 設定…"
                                : formsExporting
                                  ? "建立問卷中…"
                                  : googleClientIdIssue
                                    ? googleClientIdManaged
                                      ? "Google Forms 尚未完成部署"
                                      : "設定 Google Forms"
                                    : isGoogleFormExportEntryComplete(
                                          formsExportRecord?.pre,
                                        )
                                      ? "診斷問卷已建立"
                                      : formsExportRecord?.pre
                                        ? "重試診斷問卷"
                                        : "登入 Google 並建立診斷問卷"}
                            </button>
                          </div>
                          {diagnosticDocStatus && (
                            <p className="mt-2 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-[10px] font-bold leading-5 text-cyan-900">
                              {diagnosticDocStatus}
                            </p>
                          )}
                          {googleClientIdManaged && !googleClientIdIssue && (
                            <p className="mt-3 rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-bold text-cyan-900">
                              已由部署管理者完成 Google Forms 設定；教師只需登入 Google
                              帳號即可一鍵建立問卷。
                            </p>
                          )}
                          {diagnosticFormsExportIssue && (
                            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                              {diagnosticFormsExportIssue} Google 問卷匯出已停用。
                            </p>
                          )}
                          {!diagnosticFormsExportIssue &&
                            !googleClientIdManaged &&
                            googleClientIdIssue && (
                            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                              <span>
                                尚未完成 Google Forms OAuth 設定；請先填入 Google
                                OAuth Web Client ID。
                              </span>
                              <button
                                type="button"
                                onClick={() => setGoogleFormsSettingsOpen(true)}
                                className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-black hover:bg-amber-100"
                              >
                                開啟設定
                              </button>
                            </div>
                          )}
                          {formsExportStatus && (
                            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#7a4d0b]">
                              {formsExportStatus}
                            </p>
                          )}
                          {formsExportRecord?.pre && (
                            <div className="mt-3 rounded-lg border border-cyan-200 bg-white p-3 text-xs">
                              <p className="font-black text-zinc-800">
                                診斷問卷｜
                                {isGoogleFormExportEntryComplete(
                                  formsExportRecord.pre,
                                )
                                  ? "已發布並接受回應"
                                  : formsExportRecord.pre.stage ===
                                      "content_applied"
                                    ? "題目已完成，等待發布"
                                    : formsExportRecord.pre.stage === "created"
                                      ? "表單已建立，等待填入題目"
                                      : "尚未建立完成"}
                              </p>
                              {formsExportRecord.pre.error && (
                                <p className="mt-1 font-bold leading-relaxed text-red-700">
                                  {formsExportRecord.pre.error}
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-3 font-black text-[#175247]">
                                {formsExportRecord.pre.editUrl && (
                                  <a
                                    href={formsExportRecord.pre.editUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    編輯連結
                                  </a>
                                )}
                                {isGoogleFormExportEntryComplete(
                                  formsExportRecord.pre,
                                ) &&
                                  formsExportRecord.pre.responderUri && (
                                    <a
                                      href={formsExportRecord.pre.responderUri}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      學生作答連結
                                    </a>
                                  )}
                              </div>
                            </div>
                          )}
                        </article>

                        <details className="rounded-xl border border-cyan-200 bg-white">
                          <summary className="cursor-pointer px-4 py-3 text-sm font-black text-cyan-950">
                            查看四階參照對齊同步狀態
                          </summary>
                          <div className="space-y-3 border-t border-cyan-200 p-4">
                            <p className="rounded-lg bg-cyan-50 px-3 py-2 text-[11px] font-bold leading-5 text-cyan-950">
                              課後將依「課後遷移對齊」對應產生，與課前診斷題組緊密結合；進入課後步驟後可再依設計差異說明改寫課後。
                            </p>
                            {[
                              [
                                implementationGroupLabel("pre"),
                                courseAssessmentSeed.preMappings,
                              ],
                              [
                                designReferenceLabel("post"),
                                courseAssessmentSeed.plannedPostMappings,
                              ],
                            ].map(([title, mappings], sectionIndex) => (
                              <div key={title as string}>
                                <h4 className="text-xs font-black text-cyan-900">
                                  {title as string}
                                </h4>
                                <ul className="mt-2 space-y-2">
                                  {(
                                    mappings as CourseAssessmentSeedV1["preMappings"]
                                  ).map((mapping) => (
                                    <li
                                      key={mapping.questionKey}
                                      className="flex flex-wrap items-center gap-2 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-bold leading-6 text-zinc-700"
                                    >
                                      <span className="font-black text-cyan-950">
                                        {implementationItemLabel(
                                          sectionIndex === 0 ? "pre" : "post",
                                          questionKeyToIndex(mapping.questionKey),
                                        )}
                                      </span>
                                      <span className="text-zinc-500">·</span>
                                      <span className="min-w-0 flex-1 truncate">
                                        {mapping.purpose}
                                      </span>
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-900">
                                        已同步
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => selectDesignTab("evidence")}
                              className="text-xs font-black text-amber-900 underline transition active:scale-[0.97]"
                            >
                              詳情請至評量證據分頁
                            </button>
                          </div>
                        </details>
                      </div>
                    )}
                </section>
                )}

                {activeDesignTab === "delivery" && (
                <section
                  id="learning-design-blueprint"
                  tabIndex={-1}
                  className="scroll-mt-24 rounded-2xl border border-indigo-200 bg-indigo-50/55 p-5 shadow-sm outline-none focus:ring-2 focus:ring-indigo-400 sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                        逆向設計 · 第四步
                      </p>
                      <h2 className="mt-1 text-xl font-black text-indigo-950">
                        單元節次藍圖
                      </h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-indigo-900/80">
                        每節連結成果、成功指標、可觀察證據與教學決策，並同步準備「知識基礎＋NPDL 子向度思考」學習單；通過檢查後提供一份完整 Canvas 提示詞。
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-black ${
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
                      alignmentAudit.evidencePlan === "current" &&
                      assessmentSeedCurrent
                        ? requestAction("blueprint")
                        : scrollToDesignStep(
                            assessmentSeedCurrent
                              ? "learning-design-evidence"
                              : "learning-design-assessment-seed",
                            assessmentSeedCurrent
                              ? "請先建立、編修並確認評量證據，再產生單元節次藍圖。"
                              : "請先產生最新的課程敘述語與診斷題組。",
                          )
                    }
                    disabled={
                      busyAction !== null || unitConstraintErrors.length > 0
                    }
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-800 py-3.5 text-sm font-black text-white transition active:scale-[0.97] hover:bg-indigo-900 disabled:cursor-not-allowed disabled:opacity-45"
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
                        : !assessmentSeedCurrent
                          ? "先產生課程敘述與診斷題組"
                          : unitBlueprint
                            ? "重新產生單元節次藍圖"
                            : "AI 產生單元節次藍圖"}
                  </button>

                  {unitBlueprint && (
                    <div className="mt-5 space-y-3">
                      <div className="flex items-start justify-between gap-3 rounded-xl border border-indigo-200 bg-white p-4">
                        <p className="text-sm font-bold leading-7 text-indigo-950">
                          {unitBlueprint.unitArc}
                        </p>
                        <AiRevisionButton
                          label="AI 修改這張卡"
                          onClick={() => openAiRevision({ kind: "unit_arc" })}
                          disabled={revisionBusy || busyAction !== null}
                        />
                      </div>

                      <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                              Gemini Canvas · 分開交付
                            </p>
                            <h3 className="mt-1 text-lg font-black text-emerald-950">
                              {unitBlueprint.lessons.length} 節教師備課與學習單提示詞已分開準備
                            </h3>
                            <p className="mt-1 text-xs font-medium leading-6 text-emerald-800">
                              教師備課教案與學生學習單各有獨立提示詞；請到頁面底部「交付中心」分別預覽、複製、下載或開啟 Canvas。
                            </p>
                          </div>
                        </div>

                        {canvasReady ? (
                          <p className="mt-4 rounded-lg border border-emerald-200 bg-white p-3 text-xs font-bold leading-6 text-emerald-900">
                            Canvas 預覽、複製、下載與外部產生標記已集中到頁面底部「交付中心」。
                          </p>
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
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[10px] font-black uppercase text-indigo-700">
                                  第 {lesson.lessonNumber} 節 · {lesson.minutes} 分鐘
                                </p>
                                <AiRevisionButton
                                  label="AI 修改這張卡"
                                  onClick={() =>
                                    openAiRevision({
                                      kind: "lesson",
                                      lessonId: lesson.id,
                                    })
                                  }
                                  disabled={revisionBusy || busyAction !== null}
                                />
                              </div>
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

                      {!unitBlueprintConfirmedAt &&
                        alignmentAudit.unitBlueprint === "current" && (
                          <div className="rounded-xl border-2 border-indigo-300 bg-indigo-100/70 p-4 shadow-sm">
                            <p className="text-sm font-black text-indigo-950">
                              單卡已更新，請確認藍圖並更新 Canvas
                            </p>
                            <p className="mt-1 text-xs font-medium leading-6 text-indigo-800">
                              系統會重新檢查節次順序、成功指標覆蓋、診斷、總結與遷移證據。
                            </p>
                            <button
                              type="button"
                              onClick={confirmUnitBlueprint}
                              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400 bg-white py-3 text-sm font-black text-indigo-950 transition active:scale-[0.97] hover:bg-indigo-50"
                            >
                              <Check className="h-4 w-4" />
                              確認藍圖並更新 Canvas
                            </button>
                          </div>
                        )}

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
                                        className="flex max-w-full cursor-pointer items-start gap-2 rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-[10px] font-bold leading-5 text-zinc-700"
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
                                          className="mt-0.5 shrink-0 accent-indigo-700"
                                        />
                                        <span className="min-w-0">{option.label}</span>
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
                            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-indigo-400 bg-white py-3 text-sm font-black text-indigo-950 transition active:scale-[0.97] hover:bg-indigo-50"
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
                            <p className="mt-3 text-[10px] font-bold leading-5 text-zinc-500">
                              成果{" "}
                              {(
                                desiredResults?.outcomes.filter((outcome) =>
                                  lesson.outcomeIds.includes(outcome.id),
                                ) ?? []
                              )
                                .map((outcome) => outcome.statement)
                                .join("；") || lesson.outcomeIds.join("、")}{" "}
                              · 成功指標{" "}
                              {formatSuccessCriteriaLabels(
                                lesson.criterionIds,
                                desiredResults?.successCriteria,
                              )}{" "}
                              · 證據{" "}
                              {(
                                evidencePlan?.evidenceItems.filter((item) =>
                                  lesson.evidenceItemIds.includes(item.id),
                                ) ?? []
                              )
                                .map((item) => item.title)
                                .join("；") || lesson.evidenceItemIds.join("、")}
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
                )}

                {activeDesignTab === "delivery" && (
                <section
                  id="course-delivery-center"
                  className="scroll-mt-24 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        交付中心
                      </p>
                      <h2 className="mt-1 text-xl font-black text-emerald-950">
                        {handoffReady
                          ? "已可進入課後與匯出"
                          : "完成診斷題組與節次藍圖後可進入課後"}
                      </h2>
                      <p className="mt-1 max-w-3xl text-xs font-bold leading-6 text-emerald-800">
                        教師備課教案與學生學習單分開交付；各自可預覽、複製、下載 Markdown，或開啟 Gemini Canvas 產生。有 API Key 時可直接產生對應文件。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <SectionStatusBadge
                        status={blueprintStatus}
                        label={canvasReady ? "Canvas 可用" : "Canvas 未就緒"}
                      />
                      <SectionStatusBadge
                        status={handoffReady ? "ready" : "locked"}
                        label={handoffReady ? "可交接" : "交接未開放"}
                      />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="grid gap-3 lg:grid-cols-2">
                      <article className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-black text-emerald-950">
                              教師備課教案
                            </h3>
                            <p className="mt-1 text-xs font-bold leading-6 text-emerald-800">
                              {unitBlueprint
                                ? `${unitBlueprint.lessons.length} 節完整逐節教案提示詞（不含學習單）`
                                : "確認節次藍圖後開放教師備課提示詞。"}
                            </p>
                          </div>
                          {unitPromptGenerated && (
                            <span className="shrink-0 rounded-full bg-emerald-200 px-3 py-1 text-[10px] font-black text-emerald-950">
                              已在外部產生
                            </span>
                          )}
                        </div>
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={previewUnitPrompt}
                            disabled={!canvasReady}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FileText className="h-4 w-4" />
                            預覽備課提示詞
                          </button>
                          <button
                            type="button"
                            onClick={copyUnitPrompt}
                            disabled={!canvasReady}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-xs font-black text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Clipboard className="h-4 w-4" />
                            複製備課提示詞
                          </button>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={downloadUnitPrompt}
                              disabled={!canvasReady}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Download className="h-4 w-4" />
                              下載 Markdown
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void openGeminiCanvasDocument("teacher_prep")
                              }
                              disabled={!canvasReady || Boolean(canvasGeneratingKind)}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {canvasGeneratingKind === "teacher_prep" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                              {canvasGeneratingKind === "teacher_prep"
                                ? "正在產生…"
                                : "開啟 Canvas 產生教案"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const status = lessonPromptStatus.find(
                                (candidate) => candidate.lessonId === "unit-all",
                              );
                              updateLessonPromptStatus("unit-all", {
                                generatedExternally:
                                  !status?.generatedExternally,
                              });
                            }}
                            disabled={!canvasReady}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 text-xs font-black text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Check className="h-4 w-4" />
                            {unitPromptGenerated
                              ? "取消外部標記"
                              : "標記外部產生"}
                          </button>
                        </div>

                        <div className="mt-4 rounded-xl border border-emerald-300 bg-white/80 p-3">
                          <h4 className="text-xs font-black text-emerald-950">
                            備課諮詢 Gem
                          </h4>
                          <p className="mt-1 text-[11px] font-bold leading-5 text-emerald-800">
                            一鍵複製後，整段貼進 Gemini Gem「自訂指令」即可使用；已內嵌校準、學習終點、評量證據與節次藍圖，不必另附檔。課堂中可直接問時間不夠、學生卡關、證據不足等實施問題。
                          </p>
                          <div className="mt-3 grid gap-2">
                            <button
                              type="button"
                              onClick={copyPrepCoachGemInstructions}
                              disabled={!canvasReady}
                              className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-3 text-[11px] font-black text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                              一鍵複製 Gem 指令（含設計錨點）
                            </button>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <button
                                type="button"
                                onClick={previewPrepCoachGem}
                                disabled={!canvasReady}
                                className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-[11px] font-black text-emerald-950 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                預覽
                              </button>
                              <button
                                type="button"
                                onClick={downloadPrepCoachGemPackage}
                                disabled={!canvasReady}
                                className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-[11px] font-black text-emerald-950 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Download className="h-3.5 w-3.5" />
                                下載指令
                              </button>
                              <button
                                type="button"
                                onClick={openGeminiGemsManager}
                                disabled={!canvasReady}
                                className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 text-[11px] font-black text-emerald-950 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                開啟 Gem
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>

                      <article className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-black text-sky-950">
                              學習單
                            </h3>
                            <p className="mt-1 text-xs font-bold leading-6 text-sky-800">
                              {unitBlueprint
                                ? `${unitBlueprint.lessons.length} 節：學生版（可直接列印）＋教師參考解答版`
                                : "確認節次藍圖後開放學習單提示詞。"}
                            </p>
                          </div>
                          {worksheetPromptGenerated && (
                            <span className="shrink-0 rounded-full bg-sky-200 px-3 py-1 text-[10px] font-black text-sky-950">
                              已在外部產生
                            </span>
                          )}
                        </div>
                        <div className="mt-3 grid gap-2">
                          <button
                            type="button"
                            onClick={previewWorksheetPrompt}
                            disabled={!canvasReady}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 text-xs font-black text-sky-950 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <FileText className="h-4 w-4" />
                            預覽學習單提示詞
                          </button>
                          <button
                            type="button"
                            onClick={copyWorksheetPrompt}
                            disabled={!canvasReady}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-800 px-4 text-xs font-black text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Clipboard className="h-4 w-4" />
                            複製學習單提示詞
                          </button>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={downloadWorksheetPrompt}
                              disabled={!canvasReady}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 text-xs font-black text-sky-950 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Download className="h-4 w-4" />
                              下載 Markdown
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void openGeminiCanvasDocument("worksheets")
                              }
                              disabled={!canvasReady || Boolean(canvasGeneratingKind)}
                              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 text-xs font-black text-sky-950 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {canvasGeneratingKind === "worksheets" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ExternalLink className="h-4 w-4" />
                              )}
                              {canvasGeneratingKind === "worksheets"
                                ? "正在產生…"
                                : "開啟 Canvas 產生學習單"}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const status = lessonPromptStatus.find(
                                (candidate) =>
                                  candidate.lessonId === "unit-worksheets",
                              );
                              updateLessonPromptStatus("unit-worksheets", {
                                generatedExternally:
                                  !status?.generatedExternally,
                              });
                            }}
                            disabled={!canvasReady}
                            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-300 bg-white px-4 text-xs font-black text-sky-950 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Check className="h-4 w-4" />
                            {worksheetPromptGenerated
                              ? "取消外部標記"
                              : "標記外部產生"}
                          </button>
                        </div>
                      </article>
                    </div>

                    <article className="rounded-xl border border-[#b9ccc2] bg-[#f7faf8] p-4">
                      <h3 className="text-sm font-black text-[#173f36]">
                        課後評量與匯出
                      </h3>
                      <p className="mt-1 text-xs font-bold leading-6 text-zinc-600">
                        確認藍圖後，於下一步產生課後遷移、選填設計差異並匯出或建立 Google Forms。
                      </p>
                      <button
                        type="button"
                        onClick={handoffToAssessment}
                        disabled={!handoffReady}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173f36] px-5 text-sm font-black text-white hover:bg-[#0f312a] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        進入課後評量與匯出
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </article>
                  </div>
                </section>
                )}

                {activeDesignTab === "post-assessment" && (
                  <section
                    id="course-post-assessment"
                    className="scroll-mt-24 space-y-4"
                  >
                    <CoursePostAssessmentPanel
                      project={currentProject}
                      designContext={assessmentDesignContext}
                      form={assessmentForm}
                      aiSettings={settings}
                      onOpenAiSettings={onOpenAiSettings}
                      ready={handoffReady}
                    />
                  </section>
                )}
              </>
            )}
            </motion.div>
          </AnimatePresence>
        </div>
          </>
        )}
      </main>

      <AnimatePresence>
        {handoffPreviewOpen &&
          assessmentDesignContext &&
          courseAssessmentSeed &&
          unitBlueprint && (
            <motion.div
              className="fixed inset-0 z-[70] flex items-center justify-center bg-zinc-950/45 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="handoff-preview-title"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 border-b border-emerald-100 px-5 py-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                      不呼叫 AI · 進入下一步
                    </p>
                    <h2
                      id="handoff-preview-title"
                      className="mt-1 text-xl font-black text-emerald-950"
                    >
                      確認進入課後評量與匯出
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHandoffPreviewOpen(false)}
                    className="rounded-lg border border-zinc-200 p-2 text-zinc-500 hover:bg-zinc-50"
                    aria-label="關閉交接預覽"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto p-5 custom-scrollbar">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      [
                        "課綱與成功指標",
                        `${assessmentDesignContext.curriculum.length} 項課綱 · ${assessmentDesignContext.successCriteria.length} 項指標`,
                      ],
                      [
                        "課程敘述與診斷題組",
                        `4 級敘述 · ${courseAssessmentSeed.preMappings.length} 題診斷題組`,
                      ],
                      [
                        "節次藍圖",
                        `${unitBlueprint.lessons.length} 節 · ${unitBlueprint.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)} 分鐘`,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-emerald-100 bg-emerald-50 p-4"
                      >
                        <p className="text-[10px] font-black text-emerald-700">
                          {label}
                        </p>
                        <p className="mt-1 text-sm font-black text-emerald-950">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <details
                    open
                    className="rounded-xl border border-zinc-200 bg-white"
                  >
                    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-zinc-800">
                      課綱、學習終點與真實總結任務
                    </summary>
                    <div className="space-y-3 border-t border-zinc-100 p-4 text-xs leading-6 text-zinc-700">
                      {assessmentDesignContext.curriculum.map((entry) => (
                        <p key={entry.id}>
                          <span className="font-black">{entry.code}</span>｜
                          {entry.text}
                        </p>
                      ))}
                      <div className="rounded-lg bg-zinc-50 p-3">
                        <p className="font-black">成功指標</p>
                        {assessmentDesignContext.successCriteria.map(
                          (criterion) => (
                            <p key={criterion.id}>
                              {criterion.id}｜{criterion.text}
                            </p>
                          ),
                        )}
                      </div>
                      {assessmentDesignContext.performanceTask && (
                        <p className="rounded-lg bg-amber-50 p-3">
                          <span className="font-black">真實總結任務：</span>
                          {
                            assessmentDesignContext.performanceTask
                              .situation
                          }
                          ；成果為
                          {assessmentDesignContext.performanceTask.product}。
                        </p>
                      )}
                    </div>
                  </details>

                  <details className="rounded-xl border border-zinc-200 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-zinc-800">
                      診斷性四階參照與遷移性四階參照
                    </summary>
                    <div className="grid gap-3 border-t border-zinc-100 p-4 sm:grid-cols-2">
                      {[
                        [designReferenceLabel("pre"), courseAssessmentSeed.preMappings],
                        [designReferenceLabel("post"), courseAssessmentSeed.plannedPostMappings],
                      ].map(([label, mappings], sectionIndex) => (
                        <div key={label as string}>
                          <p className="text-xs font-black text-zinc-800">
                            {label as string}
                          </p>
                          <div className="mt-2 space-y-2">
                            {(
                              mappings as CourseAssessmentSeedV1["preMappings"]
                            ).map((mapping) => (
                              <p
                                key={mapping.questionKey}
                                className="rounded-lg bg-zinc-50 p-3 text-xs leading-6 text-zinc-700"
                              >
                                <span className="font-black">
                                  {implementationItemLabel(
                                    sectionIndex === 0 ? "pre" : "post",
                                    questionKeyToIndex(mapping.questionKey),
                                  )}
                                </span>
                                ｜{mapping.purpose}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
                <div className="grid gap-2 border-t border-emerald-100 bg-emerald-50/70 p-4 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setHandoffPreviewOpen(false)}
                    className="min-h-11 rounded-xl border border-emerald-200 bg-white text-sm font-black text-emerald-900 hover:bg-emerald-50"
                  >
                    返回節次與交付
                  </button>
                  <button
                    type="button"
                    onClick={confirmHandoffToAssessment}
                    className="min-h-11 rounded-xl bg-[#173f36] text-sm font-black text-white hover:bg-[#0f312a]"
                  >
                    確認，進入課後與匯出
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
      </AnimatePresence>

      <ContentDrawer
        content={contentDrawer}
        onClose={() => setContentDrawer(null)}
      />

      <ConsentModal
        open={consentOpen}
        provider={providerName(settings.model)}
        modelLabel={modelLabel}
        purpose={
          pendingRevisionTarget
            ? `AI 輔助修改${courseCardRevisionLabel(pendingRevisionTarget)}`
            : pendingAction === "reference"
              ? "轉換既有教案為 NPDL 可沿用內容"
            : pendingAction === "align"
            ? "108 課綱與 6Cs 校準、學習成果生成"
            : pendingAction === "evidence"
              ? "逆向設計評量證據生成"
              : pendingAction === "assessment_seed"
                ? "課程敘述語與診斷題組生成"
              : pendingAction === "blueprint"
                ? "單元節次藍圖生成"
                : "核心關鍵字分析"
        }
        payload={pendingPrompt ? promptText(pendingPrompt) : ""}
        onCancel={() => {
          setConsentOpen(false);
          setPendingAction(null);
          setPendingRevisionTarget(null);
        }}
        onConfirm={confirmConsent}
      />
      <AiRevisionModal
        target={revisionTarget}
        instruction={revisionInstruction}
        draft={revisionDraft}
        busy={revisionBusy}
        error={revisionError}
        onInstructionChange={(value) => {
          setRevisionInstruction(value);
          setRevisionDraft(null);
          setRevisionError(null);
        }}
        onGenerate={requestAiRevision}
        onApply={applyAiRevision}
        onClose={closeAiRevision}
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
      <GoogleFormsSettingsModal
        open={googleFormsSettingsOpen}
        clientId={googleClientId}
        managed={googleClientIdManaged}
        onClose={() => setGoogleFormsSettingsOpen(false)}
        onChange={googleOAuth.updateStoredClientId}
      />
    </div>
  );
}
