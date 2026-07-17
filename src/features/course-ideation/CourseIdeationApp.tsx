import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BrainCircuit,
  Check,
  ChevronDown,
  Lightbulb,
  Loader2,
  Plus,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
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
  COURSE_IDEATION_MODEL_OPTIONS,
  getCourseIdeationProvider,
  resolveCourseIdeationModel,
} from "@/lib/course-ideation-ai";
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
  KeywordAnalysisResult,
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
  selectedIndicatorId: string;
  savedAt: number;
}

type AiAction = "analyze" | "align";

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
                將傳送課程欄位、核心關鍵字與後續產生的關鍵字分析。API Key、學生姓名與本機檔案不會成為生成提示內容。若日後切換供應商，後續資料會送往新選擇的供應商。
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

export default function CourseIdeationApp() {
  const [initialDraft] = useState(readDraft);
  const [input, setInput] = useState<CourseIdeationInput>(
    initialDraft?.input ?? DEFAULT_INPUT,
  );
  const [analysis, setAnalysis] = useState<KeywordAnalysisResult | null>(
    initialDraft?.analysis ?? null,
  );
  const [alignment, setAlignment] = useState<CourseAlignmentResult | null>(
    initialDraft?.alignment ?? null,
  );
  const [selectedIndicatorId, setSelectedIndicatorId] = useState(
    initialDraft?.selectedIndicatorId ?? "",
  );
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
  const selectedIndicator = getIndicatorById(selectedIndicatorId);
  const pendingPrompt = useMemo(() => {
    if (pendingAction === "analyze") return buildKeywordAnalysisPrompt(input);
    if (pendingAction === "align" && analysis) {
      return buildCourseAlignmentPrompt(input, analysis);
    }
    return null;
  }, [analysis, input, pendingAction]);

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
      selectedIndicatorId,
      savedAt: Date.now(),
    };
    writeJson(KEYS.courseIdeationDraft, draft);
  }, [alignment, analysis, input, selectedIndicatorId]);

  const updateInput = (patch: Partial<CourseIdeationInput>) => {
    setInput((current) => ({ ...current, ...patch }));
    setAnalysis(null);
    setAlignment(null);
    setSelectedIndicatorId("");
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
        setSelectedIndicatorId("");
      } else if (analysis) {
        const raw = await generateContent(
          buildCourseAlignmentPrompt(input, analysis),
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
        const nextAlignment = parseCourseAlignment(raw, settings.model);
        setAlignment(nextAlignment);
        setSelectedIndicatorId(nextAlignment.recommendations[0].indicatorId);
      }
    } catch (caught) {
      setError(
        caught instanceof CourseIdeationResponseError
          ? COURSE_IDEATION_RESPONSE_ERROR_MESSAGE
          : toUserErrorMessage(caught),
      );
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
    setSelectedIndicatorId("");
    setKeywordDraft("");
    setError(null);
    removeStorage(KEYS.courseIdeationDraft);
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
    if (!alignment || !selectedIndicatorId) {
      setError("請先完成階段二並選擇一個子向度。");
      return;
    }
    try {
      const handoff = buildCourseIdeationHandoff(
        input,
        alignment,
        selectedIndicatorId,
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
                先整理 3–5 個核心關鍵字，再由 AI 導航至 1–2 個 6Cs 子向度；正式四級進程直接取自受控資料，不由 AI 改寫。
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
                  <h3 className="text-xs font-black text-zinc-700">後續素養對齊訊號</h3>
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
                <button
                  type="button"
                  onClick={() => requestAction("align")}
                  disabled={busyAction !== null}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#b7791f] py-3.5 text-sm font-black text-white hover:bg-[#946114] disabled:opacity-45"
                >
                  {busyAction === "align" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4" />
                  )}
                  {busyAction === "align" ? "正在對齊 6Cs…" : "進入 6Cs 對齊與進程導航"}
                </button>
              </section>
            )}

            {alignment && (
              <>
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
                          onClick={() => setSelectedIndicatorId(recommendation.indicatorId)}
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
                    {[
                      ["01 知識基礎", alignment.learningOutcomes.knowledgeFoundation],
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

                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-black text-emerald-950">已可帶入評量設計</h2>
                      <p className="mt-1 text-xs font-bold leading-6 text-emerald-800">
                        將帶入年級、學科、課程名稱、核心關鍵字、證據工具與所選子向度；現有評量不會被直接覆寫。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handoffToAssessment}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#173f36] px-5 py-3 text-sm font-black text-white hover:bg-[#0f312a]"
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
            ? "6Cs 對齊與學習成果生成"
            : "核心關鍵字分析"
        }
        payload={pendingPrompt ? promptText(pendingPrompt) : ""}
        onCancel={() => {
          setConsentOpen(false);
          setPendingAction(null);
        }}
        onConfirm={confirmConsent}
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
