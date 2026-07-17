import type {
  AssessmentDocument,
  AssessmentModuleDocument,
  AssessmentQuestionDocument,
} from "@/types";

export type AssessmentQuestionNumber = 1 | 2 | 3;
export type AssessmentModuleType = "pre" | "post";

export interface QuestionAbilityContract {
  label: "概念理解" | "行動應用" | "生活遷移";
  cues: readonly string[];
  stemDescription: string;
  optionsDescription: string;
  rationaleDescription: string;
  promptRule: string;
}

export const QUESTION_ABILITY_CONTRACTS: Record<
  AssessmentQuestionNumber,
  QuestionAbilityContract
> = {
  1: {
    label: "概念理解",
    cues: ["問題", "概念", "方法", "理解", "原因", "關係", "重點", "影響", "線索"],
    stemDescription:
      "概念理解題的題幹核心；以直接問句要求學生辨認問題、概念、關係或重要線索。課後需確認真正理解課堂概念，不可只考名稱記憶。",
    optionsDescription:
      "四個選項依概念理解的正確度與完整度由低至高排列，且都必須能直接回答題幹。",
    rationaleDescription:
      "說明此選項呈現的概念理解程度，以及學生看見或忽略了哪些問題、關係或重要線索。",
    promptRule:
      "Q1／概念理解：題幹直接引出問題、概念、關係或重要線索；選項差異落在理解的正確度與完整度。",
  },
  2: {
    label: "行動應用",
    cues: [
      "步驟",
      "行動",
      "做法",
      "安排",
      "選擇",
      "比較",
      "負責",
      "表達",
      "判斷",
      "分工",
      "溝通",
    ],
    stemDescription:
      "行動應用題的題幹核心；以直接問句要求學生把理解轉為具體做法、選擇、步驟或行動。",
    optionsDescription:
      "四個選項依行動的可執行性、理由與完整度由低至高排列，且都必須能直接回答題幹。",
    rationaleDescription:
      "說明此選項把理解轉為行動的程度，包括步驟、理由、角色、資源或檢查方式是否完整。",
    promptRule:
      "Q2／行動應用：題幹要求具體做法、選擇、步驟或行動；選項差異落在可執行性與策略完整度。",
  },
  3: {
    label: "生活遷移",
    cues: ["生活", "另一", "新的", "新情境", "如果", "限制", "改變", "調整", "換"],
    stemDescription:
      "生活遷移題的題幹核心；以直接問句把同一能力移到新的生活情境或限制，要求學生調整方法並確認結果。",
    optionsDescription:
      "四個選項依跨情境遷移、限制處理、方法調整與結果確認的完整度由低至高排列，且都必須能直接回答題幹。",
    rationaleDescription:
      "說明此選項能否把同一能力遷移到新的生活情境，並處理限制、調整方法與確認結果。",
    promptRule:
      "Q3／生活遷移：題幹明確出現新的生活情境或限制，要求調整方法並確認結果；選項差異落在遷移深度。",
  },
};

const CANONICAL_PREFIXES: Record<
  AssessmentModuleType,
  Record<AssessmentQuestionNumber, string>
> = {
  pre: {
    1: "先理解目前的問題與重要線索：",
    2: "把理解化為可執行的行動：",
    3: "把目前的判斷做法用到新的生活情境並依限制調整：",
  },
  post: {
    1: "先用課堂概念理解目前的問題：",
    2: "把理解化為可執行的行動：",
    3: "把課堂方法用到新的生活情境並依限制調整：",
  },
};

function normalizeQuestionPunctuation(stem: string): string {
  const normalized = stem
    .trim()
    .replace(/^[「"]+|[」"]+$/g, "")
    .replace(/[。；;，,：:？！?!\s]+$/g, "")
    .trim();
  return normalized ? `${normalized}？` : "";
}

export function questionStemSatisfiesContract(
  stem: string,
  number: AssessmentQuestionNumber,
): boolean {
  return QUESTION_ABILITY_CONTRACTS[number].cues.some((cue) => stem.includes(cue));
}

export function normalizeQuestionStem(
  stem: string,
  number: AssessmentQuestionNumber,
  type: AssessmentModuleType,
): string {
  const normalized = normalizeQuestionPunctuation(stem);
  if (!normalized || questionStemSatisfiesContract(normalized, number)) return normalized;
  return `${CANONICAL_PREFIXES[type][number]}${normalized}`;
}

function normalizeQuestion(
  question: AssessmentQuestionDocument,
  number: AssessmentQuestionNumber,
  type: AssessmentModuleType,
): AssessmentQuestionDocument {
  const stem = normalizeQuestionStem(question.stem, number, type);
  return stem === question.stem ? question : { ...question, stem };
}

function normalizeModule(
  module: AssessmentModuleDocument,
  type: AssessmentModuleType,
): AssessmentModuleDocument {
  const q1 = normalizeQuestion(module.q1, 1, type);
  const q2 = normalizeQuestion(module.q2, 2, type);
  const q3 = normalizeQuestion(module.q3, 3, type);
  if (q1 === module.q1 && q2 === module.q2 && q3 === module.q3) return module;
  return { ...module, q1, q2, q3 };
}

export function normalizeAssessmentQuestionStems(
  document: AssessmentDocument,
): AssessmentDocument {
  const pre = normalizeModule(document.pre, "pre");
  const post = normalizeModule(document.post, "post");
  if (pre === document.pre && post === document.post) return document;
  return { ...document, pre, post };
}

export function buildQuestionContractPromptBlock(): string {
  return `【Q1–Q3 能力題幹契約】
${([1, 2, 3] as const)
  .map((number) => `- ${QUESTION_ABILITY_CONTRACTS[number].promptRule}`)
  .join("\n")}
- stem 只寫一個可直接作答的學生問句；不得輸出能力標籤、題號、配分或教師端說明。
- 題幹、四個選項與教師解析必須回答同一個問題，不得只在標籤或解析中提到能力。`;
}
