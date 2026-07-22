import {
  buildStudentResponseExample,
  formatTeacherExplanationFallback,
  getQuestionPreviewSummary,
  parseTeacherQ4Content,
  type ParsedTeacherQ4Content,
} from "@/lib/assessment-teacher-display";
import {
  formatImplementationQuestionTitle,
  implementationGroupLabel,
  implementationItemWithFocus,
  type AssessmentFocusKey,
} from "@/lib/assessment-terminology";
import { parseGuidedQ4Text } from "@/lib/parse-assessment";
import { hasStructuredQ4Scaffold } from "@/lib/q4-guidance";
import type { ParsedQuestion } from "@/types";

interface GuidedQ4StepsViewProps {
  stem: string;
  steps: Array<{
    number: number;
    label: string;
    prompt: string;
    focusHint?: string;
    sentenceStarter?: string;
  }>;
  compact?: boolean;
}

export function GuidedQ4StepsView({
  stem,
  steps,
  compact = false,
}: GuidedQ4StepsViewProps) {
  return (
    <div className="space-y-3">
      {stem && <p className="text-sm leading-relaxed text-zinc-700">{stem}</p>}
      <div
        className={`grid gap-3 ${compact ? "md:grid-cols-1" : "lg:grid-cols-3"}`}
      >
        {steps.map((step) => (
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
              <p className="text-[10px] font-black tracking-wide text-zinc-500">
                問題
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                {step.prompt}
              </p>
            </div>
            {step.focusHint && (
              <div className="mt-3 rounded-lg bg-[#eef5f1] px-3 py-2.5">
                <p className="text-[10px] font-black text-[#173f36]">先看哪裡</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-700">
                  {step.focusHint}
                </p>
              </div>
            )}
            {step.sentenceStarter && (
              <div className="mt-2 rounded-lg border border-dashed border-[#d9bc77] bg-[#fffaf0] px-3 py-2.5">
                <p className="text-[10px] font-black text-[#7a4d0b]">
                  可以這樣開始
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-700">
                  {step.sentenceStarter}
                </p>
              </div>
            )}
            {!compact && (
              <p className="mt-3 text-[10px] font-bold text-zinc-500">
                請用 1–2 句話回答
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface TeacherQ4RubricViewProps {
  content: ParsedTeacherQ4Content;
  fallbackExplanation?: string;
}

export function TeacherQ4RubricView({
  content,
  fallbackExplanation,
}: TeacherQ4RubricViewProps) {
  const hasStructuredRubrics = content.rubrics.some((item) => !item.missing);

  if (!hasStructuredRubrics && fallbackExplanation) {
    const lines = formatTeacherExplanationFallback(fallbackExplanation);
    return (
      <div className="space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-sm leading-relaxed text-zinc-700">
            {line}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {content.transitions.some((item) => item.achieved || item.notYet) && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-zinc-900">進程跨界線索</p>
            <span className="rounded-full bg-[#f8edcf] px-2.5 py-1 text-[10px] font-black text-[#7a4d0b]">
              供教師對照判讀
            </span>
          </div>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {content.transitions.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#d8e5de] bg-[#f7faf8] p-3"
              >
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
        <p className="mb-2 text-xs font-black text-zinc-900">
          四層進程判定與回應範例
        </p>
        <div className="space-y-2">
          {content.rubrics.map((item) => (
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
                  <span className="font-black text-zinc-700">學生可能回答：</span>{" "}
                  {item.example ??
                    buildStudentResponseExample(item.level, item.body).replace(
                      /^學生可能回答：/,
                      "",
                    )}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {(content.conceptNotes.length > 0 || content.transferNotes.length > 0) && (
        <div>
          <p className="text-xs font-black text-zinc-900">課後補充對照</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {content.conceptNotes.length > 0 && (
              <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
                <p className="text-xs font-black text-sky-950">概念理解</p>
                <div className="mt-2 space-y-2">
                  {content.conceptNotes.map((item) => (
                    <p key={item.label} className="text-xs leading-relaxed text-sky-950">
                      <span className="font-black">{item.label}：</span>
                      {item.body}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {content.transferNotes.length > 0 && (
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <p className="text-xs font-black text-violet-950">生活遷移</p>
                <div className="mt-2 space-y-2">
                  {content.transferNotes.map((item) => (
                    <p
                      key={item.label}
                      className="text-xs leading-relaxed text-violet-950"
                    >
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
  );
}

interface AssessmentQuestionStudentViewProps {
  question: ParsedQuestion;
  phase: "pre" | "post";
  index: number;
}

export function AssessmentQuestionStudentView({
  question,
}: AssessmentQuestionStudentViewProps) {
  const isQ4 = question.rawTitle.includes("Q4");
  const guided = isQ4 ? parseGuidedQ4Text(question.text) : null;
  const showGuided =
    isQ4 &&
    guided &&
    (guided.steps.length > 0 ||
      hasStructuredQ4Scaffold(question.rawTitle, guided.steps));

  if (showGuided && guided && guided.steps.length > 0) {
    return <GuidedQ4StepsView stem={guided.stem} steps={guided.steps} />;
  }

  if (question.options.length > 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-zinc-700">
          {getQuestionPreviewSummary(question.text, question.rawTitle)}
        </p>
        <div className="space-y-2">
          {question.options.map((option) => (
            <p
              key={option}
              className="rounded-lg border border-[#dfe8e2] bg-[#f7faf8] px-3 py-2 text-sm font-medium leading-7 text-zinc-700"
            >
              {option.replace(/^>\s?/, "").replace(/\*\*/g, "")}
            </p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
      {getQuestionPreviewSummary(question.text, question.rawTitle)}
    </p>
  );
}

interface AssessmentQuestionDetailProps {
  phase: "pre" | "post";
  index: number;
  question: ParsedQuestion;
  scenario?: string;
  focus?: AssessmentFocusKey | string;
  purpose?: string;
  criterionIds?: string[];
  criterionLabels?: string[];
  observableEvidence?: string;
}

export function AssessmentQuestionDetail({
  phase,
  index,
  question,
  scenario,
  focus,
  purpose,
  criterionIds,
  criterionLabels,
  observableEvidence,
}: AssessmentQuestionDetailProps) {
  const title = focus
    ? implementationItemWithFocus(phase, index, focus)
    : formatImplementationQuestionTitle(phase, index, question.rawTitle);
  const teacherContent = question.rawTitle.includes("Q4")
    ? parseTeacherQ4Content(question.explanation)
    : null;

  return (
    <div className="space-y-4">
      {scenario?.trim() && (
        <section className="rounded-xl border border-cyan-200 bg-cyan-50 p-3">
          <h3 className="text-sm font-black text-cyan-950">
            {implementationGroupLabel(phase)}共用情境
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-7 text-zinc-700">
            {scenario.trim()}
          </p>
        </section>
      )}

      <section>
        <h3 className="text-sm font-black text-zinc-900">{title}</h3>
        {purpose && (
          <p className="mt-1 text-xs font-bold leading-6 text-zinc-500">
            評量目的：{purpose}
          </p>
        )}
        <div className="mt-3 rounded-xl border border-[#dfe8e2] bg-white p-3">
          <AssessmentQuestionStudentView
            question={question}
            phase={phase}
            index={index}
          />
        </div>
      </section>

      {question.explanation && (
        <section className="rounded-xl border border-[#dfe8e2] bg-[#f7faf8] p-3">
          <h3 className="text-sm font-black text-zinc-900">教師判讀與規準</h3>
          <div className="mt-3">
            {teacherContent ? (
              <TeacherQ4RubricView
                content={teacherContent}
                fallbackExplanation={question.explanation}
              />
            ) : (
              <div className="space-y-2">
                {formatTeacherExplanationFallback(question.explanation).map(
                  (line) => (
                    <p key={line} className="text-sm leading-relaxed text-zinc-700">
                      {line}
                    </p>
                  ),
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {(criterionIds?.length || observableEvidence) && (
        <section className="rounded-xl border border-cyan-200 bg-white p-3">
          <h3 className="text-sm font-black text-cyan-950">證據對齊</h3>
          <p className="mt-2 text-sm font-medium leading-7 text-zinc-700">
            {criterionIds?.length ? (
              <>
                <span className="font-black">成功指標：</span>
                {(criterionLabels?.length
                  ? criterionLabels
                  : criterionIds
                ).join("；")}
                <br />
              </>
            ) : null}
            {observableEvidence ? (
              <>
                <span className="font-black">預期證據：</span>
                {observableEvidence}
              </>
            ) : null}
          </p>
        </section>
      )}
    </div>
  );
}

export function assessmentQuestionPreviewLine(question: ParsedQuestion): string {
  if (question.rawTitle.includes("Q4")) {
    const guided = parseGuidedQ4Text(question.text);
    if (guided.stem) return guided.stem;
    if (guided.steps[0]?.prompt) return guided.steps[0].prompt;
  }
  return getQuestionPreviewSummary(question.text, question.rawTitle);
}
