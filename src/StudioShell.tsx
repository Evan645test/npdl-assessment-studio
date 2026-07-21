import { useEffect, useMemo, useState } from "react";
import { Settings2, Sparkles } from "lucide-react";
import CourseIdeationApp from "@/features/course-ideation/CourseIdeationApp";
import { CourseIdeationSettingsModal } from "@/features/course-ideation/CourseIdeationSettingsModal";
import {
  SHARED_AI_MODEL_OPTIONS,
  useSharedAiSettings,
} from "@/hooks/useSharedAiSettings";
import { stripLegacyAssessmentWorkspaceFromUrl } from "@/lib/studio-workspace";
import type { LearningDesignProjectV1 } from "@/types/course-ideation";

export default function StudioShell() {
  const ai = useSharedAiSettings();
  const [courseProject, setCourseProject] =
    useState<LearningDesignProjectV1 | null>(null);

  useEffect(() => {
    stripLegacyAssessmentWorkspaceFromUrl();
  }, []);

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
            <div className="min-w-0">
              <h1 className="truncate text-sm font-black">NPDL Studio</h1>
              <p className="truncate text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                課程設計與評量 · 單一流程
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden max-w-52 rounded-xl border border-[#dbe7e0] bg-white px-3 py-2 sm:block">
              <p className="truncate text-[10px] font-black text-zinc-500">
                {courseProject?.input.unitName ?? "尚未建立課程專案"}
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

      <main className="relative min-h-0 flex-1" aria-label="NPDL 課程與評量流程">
        <CourseIdeationApp
          embedded
          active
          aiSettings={ai.settings}
          onOpenAiSettings={ai.openSettings}
          onProjectChange={setCourseProject}
        />
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
