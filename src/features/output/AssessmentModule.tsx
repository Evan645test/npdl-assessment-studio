import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import {
  parseAssessmentModule,
  parseGuidedQ4Text,
  getChoiceQuestionScores,
  formatOptionScore,
  extractTeacherParse,
  stripQ4RubricTail,
} from "@/lib/parse-assessment";
import { hasStructuredQ4Scaffold } from "@/lib/q4-guidance";
import { t } from "@/locales/zh-Hant";
import type { CourseForm, ParsedQuestion, RefineTarget, SavedQuestion } from "@/types";
import { ScoringAnchor } from "./ScoringAnchor";

interface AssessmentModuleProps {
  content: string;
  type: "pre" | "post";
  accent: "teal" | "violet";
  form: CourseForm;
  indicatorName: string;
  highlightKey: string | null;
  bankIds: Set<string>;
  q4Invalid: boolean;
  onRefine?: (target: RefineTarget) => void;
  onSaveQuestion: (question: SavedQuestion) => void;
}

const QUESTION_TAGS = ["基礎", "策略", "轉移", "簡答"];

function extractScoringBlock(content: string): string {
  const match = content.match(/【統計規格與總分落點標準[\s\S]*/);
  return match?.[0]?.trim() ?? "";
}

const RUBRIC_LEVEL_ORDER = ["證據有限", "萌芽", "發展", "精熟"] as const;

function mapRubricLevel(label: string): (typeof RUBRIC_LEVEL_ORDER)[number] | null {
  const text = label.replace(/\*\*/g, "").trim();
  const lower = text.toLowerCase();
  if (text.includes("證據有限") || lower.includes("evidence")) return "證據有限";
  if (text.includes("萌芽") || lower.includes("emerging")) return "萌芽";
  if (text.includes("精熟") || lower.includes("mastering") || lower.includes("mastery")) {
    return "精熟";
  }
  if (text.includes("發展") || lower.includes("developing")) return "發展";
  return null;
}

interface ParsedRubricItem {
  level: (typeof RUBRIC_LEVEL_ORDER)[number];
  body: string;
  example?: string;
  missing: boolean;
}

interface ParsedTransitionItem {
  label: "萌芽 → 發展" | "發展 → 精熟";
  achieved?: string;
  notYet?: string;
}

interface ParsedTeacherNote {
  label: string;
  body: string;
}

function parseTeacherQ4Content(explanation: string): {
  rubrics: ParsedRubricItem[];
  transitions: ParsedTransitionItem[];
  conceptNotes: ParsedTeacherNote[];
  transferNotes: ParsedTeacherNote[];
} {
  const normalized = stripQ4RubricTail(explanation.replace(/\r\n/g, "\n")).trim();
  const rubricMap = new Map<(typeof RUBRIC_LEVEL_ORDER)[number], { body: string; example?: string }>();
  const transitionMap = new Map<ParsedTransitionItem["label"], ParsedTransitionItem>();
  const conceptMap = new Map<string, string>();
  const transferMap = new Map<string, string>();
  let currentLevel: (typeof RUBRIC_LEVEL_ORDER)[number] | null = null;

  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.replace(/^>\s?/, "").trim();
    const transition = line.match(
      /^-?\s*\*\*(萌芽\s*→\s*發展|發展\s*→\s*精熟)｜(已跨界證據|尚未跨界訊號)\*\*[:：]\s*(.+)$/,
    );
    if (transition) {
      const label = transition[1].replace(/\s*→\s*/, " → ").trim() as ParsedTransitionItem["label"];
      const current = transitionMap.get(label) ?? { label };
      if (transition[2] === "已跨界證據") current.achieved = transition[3].trim();
      else current.notYet = transition[3].trim();
      transitionMap.set(label, current);
      currentLevel = null;
      continue;
    }

    const teacherNote = line.match(
      /^-?\s*\*\*(概念正確|部分正確|有迷思|尚未遷移|開始遷移|能調整遷移)\*\*[:：]\s*(.+)$/,
    );
    if (teacherNote) {
      if (["概念正確", "部分正確", "有迷思"].includes(teacherNote[1])) {
        conceptMap.set(teacherNote[1], teacherNote[2].trim());
      } else {
        transferMap.set(teacherNote[1], teacherNote[2].trim());
      }
      currentLevel = null;
      continue;
    }

    const rubric = line.match(/^-?\s*\*\*(.+?)\*\*[:：]\s*(.+)$/);
    if (rubric) {
      const level = mapRubricLevel(rubric[1]);
      if (level) {
        rubricMap.set(level, { body: rubric[2].trim() });
        currentLevel = level;
        continue;
      }
    }

    const example = line.match(/^-?\s*\*\*學生可能回答\*\*[:：]\s*[「"]?(.+?)[」"]?$/);
    if (example && currentLevel) {
      const current = rubricMap.get(currentLevel);
      if (current) current.example = example[1].trim();
    }
  }

  return {
    rubrics: RUBRIC_LEVEL_ORDER.map((level) => ({
      level,
      body: rubricMap.get(level)?.body ?? "此層級尚未提供判定標準，建議點「微調此題」補齊。",
      example: rubricMap.get(level)?.example,
      missing: !rubricMap.has(level),
    })),
    transitions: (["萌芽 → 發展", "發展 → 精熟"] as const).map(
      (label) => transitionMap.get(label) ?? { label },
    ),
    conceptNotes: ["概念正確", "部分正確", "有迷思"]
      .filter((label) => conceptMap.has(label))
      .map((label) => ({ label, body: conceptMap.get(label) ?? "" })),
    transferNotes: ["尚未遷移", "開始遷移", "能調整遷移"]
      .filter((label) => transferMap.has(label))
      .map((label) => ({ label, body: transferMap.get(label) ?? "" })),
  };
}

function buildStudentResponseExample(level: string, body: string): string {
  const cleaned = body.replace(/\s+/g, " ").trim();
  const hint = cleaned.split(/[。；]/)[0]?.trim() ?? "";
  if (!hint) return "學生可能回答：我會先說清楚問題，再排出行動並檢查結果。";

  if (level === "證據有限") {
    return `學生可能回答：我覺得這樣做就可以了，先照自己的想法試試看。${hint}`;
  }
  if (level === "萌芽") {
    return `學生可能回答：我知道問題大概在哪裡，也想到一個做法，但還沒有排出完整步驟。${hint}`;
  }
  if (level === "發展") {
    return `學生可能回答：我會把想法排成具體步驟，說明理由，完成後再檢查結果。${hint}`;
  }
  return `學生可能回答：我會依新限制調整做法，把方法用到另一個生活情況，再用結果或回饋確認。${hint}`;
}

export function AssessmentModule({
  content,
  type,
  accent,
  form,
  indicatorName,
  highlightKey,
  bankIds,
  q4Invalid,
  onRefine,
  onSaveQuestion,
}: AssessmentModuleProps) {
  const { scenario, questions } = useMemo(() => parseAssessmentModule(content, type), [content, type]);
  const scoringBlock = useMemo(() => extractScoringBlock(content), [content]);
  const choiceScoresByQuestion = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getChoiceQuestionScores>>();
    for (const q of questions) {
      if (!q.rawTitle.includes("Q4")) {
        map.set(q.id, getChoiceQuestionScores(q));
      }
    }
    return map;
  }, [questions]);
  const [activeQ, setActiveQ] = useState(0);
  const question = questions[activeQ];
  const guidedQ4 = question?.rawTitle.includes("Q4")
    ? parseGuidedQ4Text(question.text)
    : { stem: "", steps: [] as const, scaffolded: false };
  const isNewGuidedQ4 = Boolean(question?.rawTitle.includes("[引導式簡答題]"));
  const isValidGuidedQ4 = Boolean(
    question && hasStructuredQ4Scaffold(question.rawTitle, guidedQ4.steps),
  );
  const isInvalidGuidedQ4 = isNewGuidedQ4 && (!isValidGuidedQ4 || q4Invalid);
  const teacherQ4 = question?.rawTitle.includes("Q4")
    ? parseTeacherQ4Content(question.explanation)
    : { rubrics: [], transitions: [], conceptNotes: [], transferNotes: [] };
  const barColor = accent === "teal" ? "bg-teal-500" : "bg-indigo-500";
  const scenarioLabel = type === "pre" ? "課前" : "課後";

  const saveCurrent = (q: ParsedQuestion) => {
    onSaveQuestion({
      ...q,
      createdAt: Date.now(),
      tags: [type === "pre" ? "課前" : "課後", form.subject, indicatorName].filter(Boolean),
    });
  };

  return (
    <div className="rounded-xl border border-[#dfe8e2] bg-white shadow-[0_1px_14px_rgba(15,45,38,0.06)]">
      <div className={`h-1 rounded-t-xl ${barColor}`} />
      <div className="p-5">
        <div className="sticky top-0 z-10 mb-4 rounded-xl border border-[#dfe8e2] bg-white/95 p-4 shadow-sm shadow-emerald-950/5 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {t.scenarioSticky} · {scenarioLabel}
            </p>
            <button
              type="button"
              disabled={!onRefine}
              onClick={() =>
                onRefine?.({
                  type: "scenario",
                  id: scenarioLabel,
                  title: `${scenarioLabel}共用情境`,
                  currentContent: scenario,
                })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8e2] bg-white px-2 py-1 text-[10px] font-black text-zinc-700 hover:border-[#e1bf69] hover:bg-[#fff8e8] hover:text-[#7a4d0b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-3 w-3" />
              微調情境
            </button>
          </div>
          <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{scenario || "（尚未解析情境）"}</p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="題目導覽">
          {questions.map((q, index) => (
            <button
              key={q.id}
              type="button"
              role="tab"
              aria-selected={activeQ === index}
              onClick={() => setActiveQ(index)}
              className={`min-h-11 rounded-xl px-4 py-2 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                activeQ === index
                  ? "bg-[#173f36] text-white shadow-sm shadow-emerald-950/15"
                  : "bg-[#eef4f0] text-zinc-600 hover:bg-[#e2ebe5] hover:text-zinc-800"
              }`}
            >
              {q.rawTitle.split(" ")[0]}
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {QUESTION_TAGS[index] ?? "題目"}
              </span>
            </button>
          ))}
        </div>

        {question && (
          <article
            className={`rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-4 ${
              highlightKey?.includes(question.id) ? "npdl-highlight-flash" : ""
            }`}
          >
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-black text-zinc-900">{question.rawTitle}</h3>
                {question.rawTitle.includes("Q4") && isValidGuidedQ4 && !q4Invalid ? (
                  <div className="mt-3">
                    <p className="text-sm leading-relaxed text-zinc-700">{guidedQ4.stem}</p>
                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      {guidedQ4.steps.map((step) => (
                        <div
                          key={step.number}
                          data-testid="q4-guide-card"
                          className="rounded-xl border border-[#d8e5de] bg-white p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#173f36] text-xs font-black text-white">
                              {step.number}
                            </span>
                            <p className="text-xs font-black text-[#173f36]">{step.label}</p>
                          </div>
                          <div className="mt-3">
                            <p className="text-[10px] font-black tracking-wide text-zinc-500">問題</p>
                            <p className="mt-1 text-sm leading-relaxed text-zinc-700">{step.prompt}</p>
                          </div>
                          <div className="mt-3 rounded-lg bg-[#eef5f1] px-3 py-2.5">
                            <p className="text-[10px] font-black text-[#173f36]">先看哪裡</p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-700">{step.focusHint}</p>
                          </div>
                          <div className="mt-2 rounded-lg border border-dashed border-[#d9bc77] bg-[#fffaf0] px-3 py-2.5">
                            <p className="text-[10px] font-black text-[#7a4d0b]">可以這樣開始</p>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-700">{step.sentenceStarter}</p>
                          </div>
                          <p className="mt-3 text-[10px] font-bold text-zinc-500">請用 1–2 句話回答</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : question.rawTitle.includes("Q4") && isInvalidGuidedQ4 ? (
                  <div
                    data-testid="q4-invalid-card"
                    className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-900"
                    role="alert"
                  >
                    <p className="text-sm font-black">Q4 未通過品質檢查，請重新生成評量</p>
                    <p className="mt-1 text-xs font-medium leading-relaxed">
                      為避免學生看到答案化問句或錯誤格式，本題內容與教師判讀已暫時隱藏。
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">{question.text}</p>
                )}
              </div>
              <div className="flex shrink-0 self-end gap-1 sm:self-auto">
                <button
                  type="button"
                  onClick={() => saveCurrent(question)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8e2] bg-white px-2 py-1 text-[10px] font-black text-zinc-700 hover:border-[#e1bf69] hover:bg-[#fff8e8] hover:text-[#7a4d0b]"
                  aria-label={bankIds.has(question.id) ? t.savedQuestion : t.saveQuestion}
                >
                  {bankIds.has(question.id) ? (
                    <BookmarkCheck className="h-4 w-4 text-[#b7791f]" />
                  ) : (
                    <Bookmark className="h-4 w-4" />
                  )}
                  {bankIds.has(question.id) ? "已收藏" : "收藏"}
                </button>
                <button
                  type="button"
                  disabled={!onRefine}
                  onClick={() =>
                    onRefine?.({
                      type: "question",
                      id: question.rawTitle.split(" ")[0],
                      title: question.rawTitle,
                      currentContent: question.rawBlock,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#dfe8e2] bg-white px-2 py-1 text-[10px] font-black text-zinc-700 hover:border-[#e1bf69] hover:bg-[#fff8e8] hover:text-[#7a4d0b] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-3 w-3" />
                  微調此題
                </button>
              </div>
            </div>

            {question.options.length > 0 && (
              <div className="space-y-2">
                {(() => {
                  const scores = choiceScoresByQuestion.get(question.id) ?? {};
                  const teacherParse =
                    question.explanation.trim() || extractTeacherParse(question.rawBlock);
                  const hasAnyScore = Object.keys(scores).length > 0;
                  return question.options.map((opt) => {
                    const letter = opt.match(/^\(([A-D])\)/)?.[1] ?? "";
                    const meta = scores[letter];
                    return (
                      <div key={opt} className="rounded-lg border border-[#dfe8e2] bg-white px-3 py-2.5">
                        <p className="text-sm leading-relaxed text-zinc-700">{opt}</p>
                        {meta ? (
                          <div className="mt-2 flex gap-2 border-t border-[#eef4f0] pt-2">
                            <span className="shrink-0 rounded-md bg-[#eef4f0] px-2 py-0.5 text-[10px] font-black text-zinc-700">
                              {formatOptionScore(meta.score)} 分
                            </span>
                            <p className="text-xs leading-relaxed text-zinc-600">
                              {meta.desc || "（此選項有配分，但缺少文字說明）"}
                            </p>
                          </div>
                        ) : hasAnyScore ? (
                          <p className="mt-2 text-[10px] font-bold text-amber-700">（尚未解析此選項配分）</p>
                        ) : teacherParse ? (
                          <p className="mt-2 border-t border-[#eef4f0] pt-2 text-xs leading-relaxed text-zinc-600">
                            {teacherParse}
                          </p>
                        ) : (
                          <p className="mt-2 text-[10px] font-bold text-amber-700">
                            此題缺少「教師解析」，請重新生成或微調此題補上 A–D 配分。
                          </p>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}

            {question.explanation && !isInvalidGuidedQ4 && (
              <div className="mt-4">
                {question.rawTitle.includes("Q4") ? (
                  <details className="rounded-xl border border-[#dfe8e2] bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-black text-zinc-700">
                      {t.rubricToggle}
                    </summary>
                    <div className="border-t border-[#dfe8e2] px-4 py-3">
                      {teacherQ4.rubrics.some((item) => !item.missing) ? (
                        <div className="space-y-4">
                          {teacherQ4.transitions.some((item) => item.achieved || item.notYet) && (
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-black text-zinc-900">系統判讀建議</p>
                                <span className="rounded-full bg-[#f8edcf] px-2.5 py-1 text-[10px] font-black text-[#7a4d0b]">
                                  供教師對照，非自動評分
                                </span>
                              </div>
                              <div className="mt-2 grid gap-3 md:grid-cols-2">
                                {teacherQ4.transitions.map((item) => (
                                  <div key={item.label} className="rounded-xl border border-[#d8e5de] bg-[#f7faf8] p-3">
                                    <p className="text-xs font-black text-[#173f36]">{item.label}</p>
                                    <div className="mt-2 space-y-2 text-xs leading-relaxed">
                                      <p className="rounded-lg bg-emerald-50 px-2.5 py-2 text-emerald-900">
                                        <span className="font-black">已跨界：</span>
                                        {item.achieved ?? "尚未提供已跨界證據。"}
                                      </p>
                                      <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900">
                                        <span className="font-black">尚未跨界：</span>
                                        {item.notYet ?? "尚未提供未跨界訊號。"}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="mb-2 text-xs font-black text-zinc-900">四層進程判定與學生語句範例</p>
                            <div className="space-y-2">
                              {teacherQ4.rubrics.map((item) => (
                            <div
                              key={item.level}
                              className={`rounded-lg border px-3 py-2.5 ${
                                item.missing
                                  ? "border-amber-200 bg-amber-50/60"
                                  : "border-[#dfe8e2] bg-[#f7faf8]"
                              }`}
                            >
                              <p className="text-xs font-black text-zinc-800">{item.level}</p>
                              <p
                                className={`mt-1 text-xs leading-relaxed ${
                                  item.missing ? "text-amber-800" : "text-zinc-700"
                                }`}
                              >
                                {item.body}
                              </p>
                              {!item.missing && (
                                <p className="mt-2 rounded-md border border-[#dfe8e2] bg-white px-2.5 py-2 text-xs leading-relaxed text-zinc-600">
                                  <span className="font-black text-zinc-700">學生可能回答：</span>
                                  {" "}
                                  {item.example ?? buildStudentResponseExample(item.level, item.body).replace(/^學生可能回答：/, "")}
                                </p>
                              )}
                            </div>
                              ))}
                            </div>
                          </div>

                          {(teacherQ4.conceptNotes.length > 0 || teacherQ4.transferNotes.length > 0) && (
                            <div>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs font-black text-zinc-900">課後補充對照</p>
                                <span className="rounded-full bg-[#eef4f0] px-2.5 py-1 text-[10px] font-black text-[#173f36]">
                                  不取代 NPDL 四層進程
                                </span>
                              </div>
                              <div className="mt-2 grid gap-3 md:grid-cols-2">
                                {teacherQ4.conceptNotes.length > 0 && (
                                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                                    <p className="text-xs font-black text-sky-950">概念理解</p>
                                    <div className="mt-2 space-y-2">
                                      {teacherQ4.conceptNotes.map((item) => (
                                        <p key={item.label} className="text-xs leading-relaxed text-sky-950">
                                          <span className="font-black">{item.label}：</span>
                                          {item.body}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {teacherQ4.transferNotes.length > 0 && (
                                  <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                                    <p className="text-xs font-black text-violet-950">生活遷移</p>
                                    <div className="mt-2 space-y-2">
                                      {teacherQ4.transferNotes.map((item) => (
                                        <p key={item.label} className="text-xs leading-relaxed text-violet-950">
                                          <span className="font-black">{item.label}：</span>
                                          {item.body}
                                        </p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <pre className="text-xs leading-relaxed text-zinc-700 whitespace-pre-wrap">
                          {question.explanation}
                        </pre>
                      )}
                    </div>
                  </details>
                ) : null}
              </div>
            )}
          </article>
        )}

        {scoringBlock && <ScoringAnchor raw={scoringBlock} accent={accent} />}
      </div>
    </div>
  );
}
