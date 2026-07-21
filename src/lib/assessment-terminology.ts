import { humanizeQuestionTypeSuffix } from "@/lib/assessment-teacher-display";

/** 設計層（參照，不是題目）與實施層（問卷）的介面用語。內部 ID 仍為 Q1–Q4。 */

export const DESIGN_REFERENCE_LABELS = {
  pre: "診斷性四階參照",
  formative: "形成性四階參照",
  post: "遷移性四階參照",
} as const;

export const IMPLEMENTATION_GROUP_LABELS = {
  pre: "診斷題組",
  post: "遷移題組",
} as const;

export const DESIGN_STAGE_LABELS = ["階一", "階二", "階三", "階四"] as const;

export const IMPLEMENTATION_ITEM_LABELS = {
  pre: ["診斷一", "診斷二", "診斷三", "診斷四"] as const,
  post: ["遷移一", "遷移二", "遷移三", "遷移四"] as const,
};

export const FOCUS_LABELS = {
  conceptual_understanding: "概念理解",
  action_application: "行動應用",
  life_transfer: "生活遷移",
  guided_response: "引導式整合回應",
} as const;

export type AssessmentFocusKey = keyof typeof FOCUS_LABELS;

export function designReferenceLabel(phase: "pre" | "post"): string {
  return phase === "pre"
    ? DESIGN_REFERENCE_LABELS.pre
    : DESIGN_REFERENCE_LABELS.post;
}

export function designStageLabel(index: number): string {
  return DESIGN_STAGE_LABELS[index] ?? `階${index + 1}`;
}

export function designStageWithFocus(
  index: number,
  focus: AssessmentFocusKey | string,
): string {
  const focusLabel =
    FOCUS_LABELS[focus as AssessmentFocusKey] ?? String(focus);
  return `${designStageLabel(index)} · ${focusLabel}`;
}

export function implementationGroupLabel(phase: "pre" | "post"): string {
  return IMPLEMENTATION_GROUP_LABELS[phase];
}

export function implementationItemLabel(
  phase: "pre" | "post",
  index: number,
): string {
  const labels = IMPLEMENTATION_ITEM_LABELS[phase];
  return labels[index] ?? (phase === "pre" ? `診斷${index + 1}` : `遷移${index + 1}`);
}

export function implementationItemWithFocus(
  phase: "pre" | "post",
  index: number,
  focus?: AssessmentFocusKey | string,
): string {
  const base = implementationItemLabel(phase, index);
  if (!focus) return base;
  const focusLabel =
    FOCUS_LABELS[focus as AssessmentFocusKey] ?? String(focus);
  return `${base} · ${focusLabel}`;
}

export function evidenceItemTypeLabel(type: string): string {
  switch (type) {
    case "diagnostic":
      return DESIGN_REFERENCE_LABELS.pre;
    case "formative":
      return DESIGN_REFERENCE_LABELS.formative;
    case "summative":
      return "總結性任務";
    case "transfer":
      return DESIGN_REFERENCE_LABELS.post;
    default:
      return type;
  }
}

export function questionKeyToIndex(questionKey: string): number {
  const match = questionKey.match(/(?:^|\.)q(\d)$/i);
  return match ? Number(match[1]) - 1 : 0;
}

export function questionIdToIndex(id: string): number {
  const match = id.match(/^Q(\d)$/);
  return match ? Number(match[1]) - 1 : 0;
}

export function formatImplementationQuestionTitle(
  phase: "pre" | "post",
  index: number,
  rawTitle: string,
): string {
  const label = implementationItemLabel(phase, index);
  const humanized = humanizeQuestionTypeSuffix(rawTitle);
  if (humanized) return `${label} · ${humanized}`;
  const suffix = rawTitle
    .replace(/^Q\d+\.?\s*/i, "")
    .replace(/\[[^\]]+\]/g, "")
    .trim();
  return suffix ? `${label} · ${suffix}` : label;
}
