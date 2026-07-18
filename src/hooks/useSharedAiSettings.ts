import { useCallback, useEffect, useMemo, useState } from "react";
import { MODEL_OPTIONS } from "@/data/constants";
import { generateContent, getModelProvider } from "@/lib/ai/client";
import { toUserErrorMessage } from "@/lib/errors";
import {
  KEYS,
  readJson,
  readStorage,
  removeStorage,
  writeJson,
  writeStorage,
} from "@/lib/storage";
import type { SharedAiSettings } from "@/types/studio";

export const SHARED_AI_DEFAULT_MODEL = "gemini-2.5-flash";
export const SHARED_AI_MODEL_OPTIONS = MODEL_OPTIONS.filter(
  (option) => option.group !== "free",
);

const sharedModelValues = new Set<string>(
  SHARED_AI_MODEL_OPTIONS.map((option) => option.value),
);

export function isSharedModel(value: unknown): value is string {
  return typeof value === "string" && sharedModelValues.has(value);
}

export function resolveSharedAiModel(
  savedSharedModel: unknown,
  savedCourseModel: unknown,
): { model: string; migratedFromPuter: boolean } {
  const migratedFromPuter =
    typeof savedSharedModel === "string" &&
    savedSharedModel.startsWith("puter:");
  return {
    model: isSharedModel(savedSharedModel)
      ? savedSharedModel
      : isSharedModel(savedCourseModel)
        ? savedCourseModel
        : SHARED_AI_DEFAULT_MODEL,
    migratedFromPuter,
  };
}

function readInitialSettings(): {
  settings: SharedAiSettings;
  migratedFromPuter: boolean;
} {
  const savedSharedModel = readJson<string | null>(KEYS.model, null);
  const savedCourseModel = readJson<string | null>(
    KEYS.courseIdeationModel,
    null,
  );
  const { model, migratedFromPuter } = resolveSharedAiModel(
    savedSharedModel,
    savedCourseModel,
  );
  return {
    settings: {
      model,
      geminiKey: readStorage(KEYS.geminiKey) ?? "",
      openaiKey: readStorage(KEYS.openaiKey) ?? "",
      xaiKey: readStorage(KEYS.xaiKey) ?? "",
    },
    migratedFromPuter,
  };
}

function persistSecret(key: string, value: string): void {
  if (value.trim()) {
    writeStorage(key, value);
  } else {
    removeStorage(key);
  }
}

export function hasSharedModelKey(settings: SharedAiSettings): boolean {
  const provider = getModelProvider(settings.model);
  if (provider === "openai") return Boolean(settings.openaiKey.trim());
  if (provider === "xai") return Boolean(settings.xaiKey.trim());
  return Boolean(settings.geminiKey.trim());
}

export function useSharedAiSettings() {
  const [initial] = useState(readInitialSettings);
  const [settings, setSettings] = useState<SharedAiSettings>(initial.settings);
  const [migrationNotice, setMigrationNotice] = useState<string | null>(
    initial.migratedFromPuter
      ? "合併版已移除 Puter 免費模型，模型已改為 Gemini 2.5 Flash；既有評量文件仍可讀取，產生新內容前請設定 Gemini API Key。"
      : null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(
    null,
  );

  useEffect(() => {
    persistSecret(KEYS.geminiKey, settings.geminiKey);
    persistSecret(KEYS.openaiKey, settings.openaiKey);
    persistSecret(KEYS.xaiKey, settings.xaiKey);
    writeJson(KEYS.model, settings.model);
    removeStorage(KEYS.courseIdeationModel);
  }, [settings]);

  useEffect(() => {
    setConnectionStatus(null);
  }, [settings.model, settings.geminiKey, settings.openaiKey, settings.xaiKey]);

  const provider = useMemo(
    () => getModelProvider(settings.model),
    [settings.model],
  );

  const testConnection = useCallback(async () => {
    if (!hasSharedModelKey(settings)) {
      setConnectionStatus(
        provider === "openai"
          ? "請填寫 OpenAI API Key。"
          : provider === "xai"
            ? "請填寫 Grok API Key。"
            : "請填寫 Gemini API Key。",
      );
      return;
    }
    setTesting(true);
    setConnectionStatus(null);
    try {
      const result = await generateContent(
        "請只回覆一個字：「好」。",
        settings.model,
        settings.geminiKey,
        settings.openaiKey,
        settings.xaiKey,
      );
      setConnectionStatus(
        result.includes("好") ? "連線成功" : `已回應：${result.slice(0, 24)}`,
      );
    } catch (error) {
      setConnectionStatus(toUserErrorMessage(error));
    } finally {
      setTesting(false);
    }
  }, [provider, settings]);

  const clearProviderKey = useCallback(() => {
    setSettings((current) => {
      const currentProvider = getModelProvider(current.model);
      if (currentProvider === "openai") return { ...current, openaiKey: "" };
      if (currentProvider === "xai") return { ...current, xaiKey: "" };
      return { ...current, geminiKey: "" };
    });
  }, []);

  const clearAllKeys = useCallback(() => {
    setSettings((current) => ({
      ...current,
      geminiKey: "",
      openaiKey: "",
      xaiKey: "",
    }));
  }, []);

  return {
    settings,
    setSettings,
    provider,
    hasSelectedModelKey: hasSharedModelKey(settings),
    migrationNotice,
    dismissMigrationNotice: () => setMigrationNotice(null),
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    testing,
    connectionStatus,
    testConnection,
    clearProviderKey,
    clearAllKeys,
  };
}
