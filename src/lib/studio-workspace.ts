import type { StudioWorkspace } from "@/types/studio";

/**
 * 合併版僅保留單一連續流程。舊書籤 `?workspace=assessment` 一律視為課程根路徑。
 */
export function resolveStudioWorkspace(_search: string): StudioWorkspace {
  return "course";
}

/** 清除舊雙工作區 query，避免書籤殘留 */
export function stripLegacyAssessmentWorkspaceFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has("workspace")) return;
  url.searchParams.delete("workspace");
  window.history.replaceState({}, "", url);
}
