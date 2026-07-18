import type { StudioWorkspace } from "@/types/studio";

export function resolveStudioWorkspace(search: string): StudioWorkspace {
  const workspace = new URLSearchParams(search).get("workspace");
  return workspace === "assessment" ? "assessment" : "course";
}
