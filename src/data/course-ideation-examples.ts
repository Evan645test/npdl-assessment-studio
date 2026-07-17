import type { CourseIdeationInput } from "@/types/course-ideation";

export interface CourseIdeationExample {
  id: string;
  label: string;
  input: CourseIdeationInput;
}

export const DEFAULT_COURSE_IDEATION_EXAMPLE_ID =
  "geography-climate-adaptation";

export const COURSE_IDEATION_EXAMPLES: readonly CourseIdeationExample[] = [
  {
    id: DEFAULT_COURSE_IDEATION_EXAMPLE_ID,
    label: "氣候調適倡議",
    input: {
      grade: "高一",
      subject: "地理",
      unitName: "全球氣候變遷",
      teachingTopic: "極端氣候與校園調適倡議",
      coreKeywords: ["極端氣候", "校園熱島", "數據證據", "小組倡議"],
    },
  },
  {
    id: "chemistry-reaction-rate",
    label: "反應速率探究",
    input: {
      grade: "高二",
      subject: "化學",
      unitName: "化學反應速率",
      teachingTopic: "探究溫度與濃度如何影響反應速率",
      coreKeywords: ["反應速率", "變因控制", "實驗數據", "證據推論"],
    },
  },
  {
    id: "biology-campus-biodiversity",
    label: "校園生物多樣性",
    input: {
      grade: "高一",
      subject: "生物",
      unitName: "生態系與生物多樣性",
      teachingTopic: "校園生物多樣性調查與棲地改善",
      coreKeywords: ["物種調查", "棲地條件", "生物多樣性", "改善方案"],
    },
  },
  {
    id: "physics-energy-conservation",
    label: "教室節能診斷",
    input: {
      grade: "高二",
      subject: "物理",
      unitName: "能量與電功率",
      teachingTopic: "以用電量測設計教室節能方案",
      coreKeywords: ["電功率", "能源轉換", "量測數據", "節能設計"],
    },
  },
  {
    id: "mathematics-food-waste-data",
    label: "剩食資料決策",
    input: {
      grade: "高一",
      subject: "數學",
      unitName: "統計與資料分析",
      teachingTopic: "以校園午餐剩食資料提出改善策略",
      coreKeywords: ["資料分布", "統計圖表", "抽樣偏差", "決策證據"],
    },
  },
  {
    id: "chinese-local-memory",
    label: "地方記憶書寫",
    input: {
      grade: "高一",
      subject: "國文",
      unitName: "敘事與地方書寫",
      teachingTopic: "從街區訪談重構地方記憶",
      coreKeywords: ["敘事觀點", "地方記憶", "口述訪談", "文本創作"],
    },
  },
  {
    id: "english-sustainable-campus",
    label: "永續校園倡議",
    input: {
      grade: "高一",
      subject: "英文",
      unitName: "Sustainable Communities",
      teachingTopic: "用英語設計步行友善校園倡議",
      coreKeywords: ["英文溝通", "永續社區", "受眾分析", "倡議簡報"],
    },
  },
  {
    id: "social-phone-policy-deliberation",
    label: "手機規範審議",
    input: {
      grade: "高一",
      subject: "社會",
      unitName: "公共政策與公民參與",
      teachingTopic: "校園手機使用規範的公民審議",
      coreKeywords: ["權利責任", "利害關係人", "公共審議", "政策方案"],
    },
  },
] as const;

export function createCourseIdeationExampleInput(
  exampleId: string,
): CourseIdeationInput {
  const example = COURSE_IDEATION_EXAMPLES.find(
    (candidate) => candidate.id === exampleId,
  );
  if (!example) {
    throw new Error(`找不到課程發想測試範例：${exampleId}`);
  }
  return {
    ...example.input,
    coreKeywords: [...example.input.coreKeywords],
  };
}
