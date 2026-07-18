import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Lightbulb,
  Settings2,
  Sparkles,
} from "lucide-react";
import AssessmentApp from "@/App";
import CourseIdeationApp from "@/features/course-ideation/CourseIdeationApp";
import { CourseIdeationSettingsModal } from "@/features/course-ideation/CourseIdeationSettingsModal";
import {
  SHARED_AI_MODEL_OPTIONS,
  useSharedAiSettings,
} from "@/hooks/useSharedAiSettings";
import { isValidCourseIdeationHandoff } from "@/lib/course-ideation";
import { KEYS, readJson } from "@/lib/storage";
import { resolveStudioWorkspace } from "@/lib/studio-workspace";
import type {
  CourseIdeationHandoff,
  LearningDesignProjectV1,
} from "@/types/course-ideation";
import type { StudioWorkspace } from "@/types/studio";

function workspaceFromLocation(): StudioWorkspace {
  return resolveStudioWorkspace(window.location.search);
}

// React StrictMode remounts the shell during development. The assessment app
// consumes and removes a legacy one-shot handoff on its first mount, so cache
// the routing decision once at module load to keep the second mount on the
// assessment workspace.
const hasInitialLegacyHandoff = isValidCourseIdeationHandoff(
  readJson<CourseIdeationHandoff | null>(
    KEYS.courseIdeationHandoff,
    null,
  ),
);

function initialWorkspace(): StudioWorkspace {
  const search = new URLSearchParams(window.location.search);
  if (search.has("workspace")) return workspaceFromLocation();
  return hasInitialLegacyHandoff ? "assessment" : "course";
}

export default function StudioShell() {
  const ai = useSharedAiSettings();
  const [workspace, setWorkspace] = useState<StudioWorkspace>(
    initialWorkspace,
  );
  const [courseProject, setCourseProject] =
    useState<LearningDesignProjectV1 | null>(null);
  const [incomingProject, setIncomingProject] =
    useState<LearningDesignProjectV1 | null>(null);

  useEffect(() => {
    if (
      workspace === "assessment" &&
      !new URLSearchParams(window.location.search).has("workspace")
    ) {
      const url = new URL(window.location.href);
      url.searchParams.set("workspace", "assessment");
      window.history.replaceState({ workspace }, "", url);
    }
  }, [workspace]);

  useEffect(() => {
    const handlePopState = () => setWorkspace(workspaceFromLocation());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = useCallback((next: StudioWorkspace) => {
    const url = new URL(window.location.href);
    if (next === "assessment") {
      url.searchParams.set("workspace", "assessment");
    } else {
      url.searchParams.delete("workspace");
    }
    window.history.pushState({ workspace: next }, "", url);
    setWorkspace(next);
  }, []);

  const handleOpenAssessment = useCallback(
    (project: LearningDesignProjectV1) => {
      setCourseProject(project);
      setIncomingProject(project);
      navigate("assessment");
    },
    [navigate],
  );

  const modelLabel = useMemo(
    () =>
      SHARED_AI_MODEL_OPTIONS.find(
        (option) => option.value === ai.settings.model,
      )?.label.split("（")[0] ?? ai.settings.model,
    [ai.settings.model],
  );

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f3f7f4] text-zinc-900">
      <header className="relative z-50 shrink-0 border-b border-[#dfe8e2] bg-white/95 shadow-[0_1px_12px_rgba(15,45,38,0.06)] backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-3 py-2 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#173f36] text-white shadow-sm shadow-emerald-950/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <h1 className="truncate text-sm font-black">NPDL Studio</h1>
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                課程設計 × 評量設計
              </p>
            </div>
          </div>

          <nav
            className="flex min-w-0 flex-1 justify-center"
            aria-label="NPDL Studio 工作區"
          >
            <div className="grid w-full max-w-md grid-cols-2 rounded-xl border border-[#dbe7e0] bg-[#eef4f0] p-1">
              <button
                type="button"
                aria-current={workspace === "course" ? "page" : undefined}
                onClick={() => navigate("course")}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                  workspace === "course"
                    ? "bg-white text-[#173f36] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <Lightbulb className="h-4 w-4" />
                課程設計
              </button>
              <button
                type="button"
                aria-current={workspace === "assessment" ? "page" : undefined}
                onClick={() => navigate("assessment")}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                  workspace === "assessment"
                    ? "bg-white text-[#173f36] shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                評量設計
              </button>
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden max-w-52 rounded-xl border border-[#dbe7e0] bg-white px-3 py-2 lg:block">
              <p className="truncate text-[10px] font-black text-zinc-500">
                {courseProject?.input.unitName ?? "尚未帶入課程專案"}
              </p>
              <p className="truncate text-xs font-black text-[#175247]">
                {modelLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={ai.openSettings}
              aria-label="開啟共用 AI 設定"
              className="rounded-xl border border-[#dbe7e0] bg-white p-2.5 text-zinc-600 shadow-sm hover:bg-[#f7faf8]"
            >
              <Settings2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        {ai.migrationNotice && (
          <div className="flex items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900">
            <span>{ai.migrationNotice}</span>
            <button
              type="button"
              onClick={ai.dismissMigrationNotice}
              className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1 font-black"
            >
              知道了
            </button>
          </div>
        )}
      </header>

      <main className="relative min-h-0 flex-1">
        <section
          hidden={workspace !== "course"}
          className="h-full"
          aria-label="課程設計工作區"
        >
          <CourseIdeationApp
            embedded
            active={workspace === "course"}
            aiSettings={ai.settings}
            onOpenAiSettings={ai.openSettings}
            onOpenAssessment={handleOpenAssessment}
            onProjectChange={setCourseProject}
          />
        </section>
        <section
          hidden={workspace !== "assessment"}
          className="h-full"
          aria-label="評量設計工作區"
        >
          <AssessmentApp
            embedded
            active={workspace === "assessment"}
            aiSettings={ai.settings}
            incomingProject={incomingProject}
            onOpenAiSettings={ai.openSettings}
          />
        </section>
      </main>

      <CourseIdeationSettingsModal
        open={ai.settingsOpen}
        geminiKey={ai.settings.geminiKey}
        openaiKey={ai.settings.openaiKey}
        xaiKey={ai.settings.xaiKey}
        model={ai.settings.model}
        testing={ai.testing}
        connectionStatus={ai.connectionStatus}
        onClose={ai.closeSettings}
        onChange={(patch) =>
          ai.setSettings((current) => ({ ...current, ...patch }))
        }
        onTest={() => void ai.testConnection()}
        onClearProvider={ai.clearProviderKey}
        onClearAll={ai.clearAllKeys}
      />
    </div>
  );
}
