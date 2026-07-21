import { useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import {
  parseAssessmentModule,
  parseGuidedQ4Text,
  getChoiceQuestionScores,
  formatOptionScore,
  extractTeacherParse,
} from "@/lib/parse-assessment";
import { parseTeacherQ4Content, getQuestionPreviewSummary } from "@/lib/assessment-teacher-display";
import { hasStructuredQ4Scaffold } from "@/lib/q4-guidance";
import {
  formatImplementationQuestionTitle,
  implementationGroupLabel,
  implementationItemLabel,
} from "@/lib/assessment-terminology";
import {
  AssessmentQuestionStudentView,
  GuidedQ4StepsView,
  TeacherQ4RubricView,
} from "@/features/output/AssessmentQuestionDisplay";
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
    : null;
  const barColor = accent === "teal" ? "bg-teal-500" : "bg-indigo-500";
  const scenarioLabel = implementationGroupLabel(type);

  const saveCurrent = (q: ParsedQuestion) => {
    onSaveQuestion({
      ...q,
      createdAt: Date.now(),
      tags: [implementationGroupLabel(type), form.subject, indicatorName].filter(Boolean),
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
              {implementationItemLabel(type, index)}
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
                <h3 className="text-sm font-black text-zinc-900">
                  {formatImplementationQuestionTitle(type, activeQ, question.rawTitle)}
                </h3>
                {question.rawTitle.includes("Q4") && isValidGuidedQ4 && !q4Invalid ? (
                  <div className="mt-3">
                    <GuidedQ4StepsView stem={guidedQ4.stem} steps={[...guidedQ4.steps]} />
                  </div>
                ) : question.rawTitle.includes("Q4") && isInvalidGuidedQ4 ? (
                  <div
                    data-testid="q4-invalid-card"
                    className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-4 text-amber-900"
                    role="alert"
                  >
                    <p className="text-sm font-black">
                      {implementationItemLabel(type, 3)}未通過品質檢查，請重新生成評量
                    </p>
                    <p className="mt-1 text-xs font-medium leading-relaxed">
                      為避免學生看到答案化問句或錯誤格式，本題內容與教師判讀已暫時隱藏。
                    </p>
                  </div>
                ) : question.options.length > 0 ? (
                  <p className="mt-2 text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                    {getQuestionPreviewSummary(question.text, question.rawTitle)}
                  </p>
                ) : (
                  <div className="mt-2">
                    <AssessmentQuestionStudentView
                      question={question}
                      phase={type}
                      index={activeQ}
                    />
                  </div>
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
                {question.rawTitle.includes("Q4") && teacherQ4 ? (
                  <details className="rounded-xl border border-[#dfe8e2] bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-xs font-black text-zinc-700">
                      {t.rubricToggle}
                    </summary>
                    <div className="border-t border-[#dfe8e2] px-4 py-3">
                      <TeacherQ4RubricView
                        content={teacherQ4}
                        fallbackExplanation={question.explanation}
                      />
                    </div>
                  </details>
                ) : null}
              </div>
            )}
          </article>
        )}

        {scoringBlock && (
          <ScoringAnchor raw={scoringBlock} accent={accent} phase={type} />
        )}
      </div>
    </div>
  );
}
