import {
  ArrowRight,
  Check,
  Lock,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type WorkflowStepStatus =
  | "locked"
  | "ready"
  | "working"
  | "review"
  | "done"
  | "stale";

export interface CourseWorkflowStep {
  id: string;
  label: string;
  description: string;
  status: WorkflowStepStatus;
  targetId?: string;
}

export interface WorkflowAction {
  label: string;
  description: string;
  disabled?: boolean;
  busy?: boolean;
  tone?: "emerald" | "amber" | "sky" | "cyan" | "indigo";
  icon?: LucideIcon;
  onClick: () => void;
}

const statusCopy: Record<WorkflowStepStatus, string> = {
  locked: "未開放",
  ready: "可進行",
  working: "進行中",
  review: "待確認",
  done: "完成",
  stale: "需更新",
};

const statusClasses: Record<WorkflowStepStatus, string> = {
  locked: "border-zinc-200 bg-zinc-50 text-zinc-500",
  ready: "border-[#b9ccc2] bg-white text-[#173f36]",
  working: "border-[#b9ccc2] bg-[#eef4f0] text-[#173f36]",
  review: "border-amber-200 bg-amber-50 text-amber-950",
  done: "border-emerald-200 bg-emerald-50 text-emerald-900",
  stale: "border-red-200 bg-red-50 text-red-900",
};

const actionToneClasses = {
  emerald: "bg-[#173f36] text-white hover:bg-[#0f312a]",
  amber: "bg-[#b7791f] text-white hover:bg-[#946114]",
  sky: "bg-sky-800 text-white hover:bg-sky-900",
  cyan: "bg-cyan-800 text-white hover:bg-cyan-900",
  indigo: "bg-indigo-800 text-white hover:bg-indigo-900",
};

export function SectionStatusBadge({
  status,
  label,
}: {
  status: WorkflowStepStatus;
  label?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black ${statusClasses[status]}`}
    >
      {status === "working" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "done" && <Check className="h-3 w-3" />}
      {status === "locked" && <Lock className="h-3 w-3" />}
      {label ?? statusCopy[status]}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  status,
  statusLabel,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  status: WorkflowStepStatus;
  statusLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-[#2f7d68]">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-black text-zinc-950">{title}</h2>
        <p className="mt-1 text-xs font-bold leading-6 text-zinc-600">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <SectionStatusBadge status={status} label={statusLabel} />
        {children}
      </div>
    </div>
  );
}

export function WorkflowRail({
  steps,
  onSelectStep,
}: {
  steps: CourseWorkflowStep[];
  onSelectStep: (step: CourseWorkflowStep) => void;
}) {
  return (
    <nav aria-label="課程設計流程" className="min-w-0">
      <ol className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar xl:grid xl:grid-cols-9 xl:overflow-visible xl:pb-0">
        {steps.map((step, index) => (
          <li key={step.id} className="min-w-[9.5rem] xl:min-w-0">
            <button
              type="button"
              onClick={() => onSelectStep(step)}
              className={`h-full w-full rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 ${statusClasses[step.status]}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[10px] font-black text-zinc-700 ring-1 ring-black/5">
                  {step.status === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="rounded-full bg-white/75 px-2 py-0.5 text-[9px] font-black">
                  {statusCopy[step.status]}
                </span>
              </span>
              <span className="mt-2 block text-xs font-black">
                {step.label}
              </span>
              <span className="mt-1 line-clamp-2 block text-[10px] font-bold leading-4 opacity-80">
                {step.description}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function NextActionPanel({
  action,
  summary,
}: {
  action: WorkflowAction;
  summary: string;
}) {
  const Icon = action.busy ? Loader2 : action.icon ?? ArrowRight;
  return (
    <section className="rounded-2xl border border-[#dfe8e2] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#b7791f]">
            目前課程
          </p>
          <h2 className="mt-1 truncate text-lg font-black text-zinc-950">
            {summary}
          </h2>
          <p className="mt-1 text-xs font-bold leading-6 text-zinc-600">
            {action.description}
          </p>
        </div>
        <button
          type="button"
          aria-label="目前流程下一步"
          onClick={action.onClick}
          disabled={action.disabled || action.busy}
          className={`flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black shadow-sm transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 ${actionToneClasses[action.tone ?? "emerald"]}`}
        >
          <Icon className={`h-4 w-4 ${action.busy ? "animate-spin" : ""}`} />
          {action.label}
        </button>
      </div>
    </section>
  );
}
