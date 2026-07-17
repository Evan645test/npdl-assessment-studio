export const COMPETENCY_DIMENSIONS = [
  { id: "品格", mark: "品", color: "#d97706" },
  { id: "公民素養", mark: "公", color: "#65a30d" },
  { id: "協作", mark: "協", color: "#2563eb" },
  { id: "溝通", mark: "溝", color: "#0f766e" },
  { id: "批判思考", mark: "思", color: "#7c3aed" },
  { id: "創造力", mark: "創", color: "#e11d48" },
] as const;

export const PROGRESSION_NAMES = ["證據有限", "萌芽", "發展", "精熟"] as const;

export const PROGRESSION_KEYS = [
  "evidence_limited",
  "emerging",
  "developing",
  "mastering",
] as const;

export const GRADES = [
  "國一",
  "國二",
  "國三",
  "高一",
  "高二",
  "高三",
] as const;

export const SUBJECT_CHIPS = [
  "化學",
  "生物",
  "物理",
  "地科",
  "數學",
  "國文",
  "英文",
  "社會",
] as const;

export const MODEL_OPTIONS = [
  { value: "puter:gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite（免費額度，建議）", group: "free" },
  { value: "puter:gpt-5.4-nano", label: "GPT-5.4 nano（免費額度）", group: "free" },
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash（最新，建議使用）", group: "gemini" },
  { value: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview（最強推理）", group: "gemini" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview（快速低成本）", group: "gemini" },
  { value: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite（低延遲低成本）", group: "gemini" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro（穩定深度推理）", group: "gemini" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash（穩定平衡）", group: "gemini" },
  { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite（穩定低成本）", group: "gemini" },
  { value: "gpt-5.6-sol", label: "GPT-5.6 Sol（最高能力）", group: "openai" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra（品質與成本平衡）", group: "openai" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna（快速高流量）", group: "openai" },
  { value: "gpt-5.5", label: "GPT-5.5（最新旗艦）", group: "openai" },
  { value: "gpt-5.5-pro", label: "GPT-5.5 Pro（最高精度推理）", group: "openai" },
  { value: "gpt-5.4", label: "GPT-5.4（高品質平衡）", group: "openai" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 mini（快速低成本）", group: "openai" },
  { value: "gpt-5.4-nano", label: "GPT-5.4 nano（最低延遲成本）", group: "openai" },
  { value: "gpt-4.1", label: "GPT-4.1（長上下文高品質）", group: "openai" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 mini", group: "openai" },
  { value: "gpt-4.1-nano", label: "GPT-4.1 nano", group: "openai" },
  { value: "o4-mini", label: "o4-mini（推理低成本）", group: "openai" },
  { value: "o3", label: "o3（進階推理）", group: "openai" },
  { value: "o3-pro", label: "o3-pro（高運算推理）", group: "openai" },
  { value: "gpt-4o", label: "GPT-4o（舊版相容）", group: "openai" },
  { value: "gpt-4o-mini", label: "GPT-4o mini（舊版相容）", group: "openai" },
  { value: "grok-4.5", label: "Grok 4.5（旗艦推理）", group: "xai" },
  { value: "grok-4.3", label: "Grok 4.3（穩定平衡）", group: "xai" },
] as const;

export type ModelProvider = (typeof MODEL_OPTIONS)[number]["group"];

export const DEFAULT_MODEL = "puter:gemini-3.1-flash-lite";

export const DEFAULT_FORM = {
  grade: "高二",
  subject: "化學",
  source: "資料庫" as const,
  indicatorId: "C5-P3",
  customIndicator: "",
  activityName: "反應速率 - 硫粒子生成實驗",
  lifeKeywords: "食物腐敗",
  tools: "手機計時、照片對照",
};

export const COURSE_CONTEXT_TEMPLATES = [
  {
    id: "chem-reaction-rate",
    label: "化學反應速率",
    description: "保留原本預設：硫粒子生成實驗",
    patch: {
      grade: "高二",
      subject: "化學",
      activityName: "反應速率 - 硫粒子生成實驗",
      lifeKeywords: "食物腐敗",
      tools: "手機計時、照片對照",
    },
  },
  {
    id: "civics-media-literacy",
    label: "公民媒體識讀",
    description: "同事件多來源資訊查核與判讀",
    patch: {
      grade: "高一",
      subject: "公民",
      activityName: "媒體識讀 - 同事件多來源查核與可信度判斷",
      lifeKeywords: "社群貼文、新聞截圖、資料圖表、事實查核",
      tools: "來源檢核表、反搜圖、時間軸比對、查核紀錄單",
    },
  },
] as const;

export const MODULES = [
  {
    title: "模組 1 · 課程敘述語",
    subtitle: "依 NPDL 四進程描述本堂課的學習表現；切換上方 pill 檢視各進程對照。",
    editHint: "編修方式：逐段微調",
    accent: "amber",
  },
  {
    title: "模組 2 · 課前思維診斷",
    subtitle: "測量學生尚未正式上課前的基準想法；教師解析預設收合，需要時再展開。",
    editHint: "編修方式：逐題微調",
    accent: "teal",
  },
  {
    title: "模組 3 · 課後轉折遷移",
    subtitle: "測量上課後的能力提升與遷移；落點計分標準置於模組底部。",
    editHint: "編修方式：逐題微調",
    accent: "violet",
  },
] as const;
