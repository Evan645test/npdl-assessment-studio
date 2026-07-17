import type { CourseForm } from "@/types";

export type AssessmentStrategyId =
  | "learning_reflection"
  | "perspective_impact"
  | "stakeholder_action"
  | "role_collaboration"
  | "audience_communication"
  | "idea_action_check"
  | "evidence_reason_revise";

export type GradeBand = "junior" | "senior";

export interface AssessmentStrategyProfile {
  id: AssessmentStrategyId;
  label: string;
  q1Focus: string;
  q2Focus: string;
  q3Focus: string;
  preOpenFocus: string;
  postOpenFocus: string;
  emergingToDeveloping: {
    achieved: string;
    notYet: string;
  };
  developingToMastering: {
    achieved: string;
    notYet: string;
  };
}

const STRATEGIES: Record<AssessmentStrategyId, AssessmentStrategyProfile> = {
  learning_reflection: {
    id: "learning_reflection",
    label: "了解做法 → 安排行動 → 反思調整",
    q1Focus: "辨認自己目前的想法、做法或卡住的位置",
    q2Focus: "選擇具體下一步，說明如何持續完成任務",
    q3Focus: "把做法用到另一個生活問題，依結果反思並調整",
    preOpenFocus: "從日常經驗說出目前做法，排出下一步，再想好如何看結果",
    postOpenFocus: "說明課堂方法，實際採取行動，再依生活情境的結果調整",
    emergingToDeveloping: {
      achieved: "學生能說清楚目前卡住的位置，排出可執行的下一步，並說明完成後要看什麼結果。",
      notYet: "學生只說要更努力或照做，沒有具體步驟、時間或可檢查的結果。",
    },
    developingToMastering: {
      achieved: "學生能根據結果反思原做法，在新限制下主動換方法，並說明如何確認調整有效。",
      notYet: "學生能完成原定步驟，但情況改變時仍重複同一做法，也沒有檢查調整是否有效。",
    },
  },
  perspective_impact: {
    id: "perspective_impact",
    label: "看見觀點 → 做出選擇 → 檢查影響",
    q1Focus: "辨認不同人的需要、感受、責任或數位使用影響",
    q2Focus: "在不同觀點間作出有理由的選擇並採取行動",
    q3Focus: "把選擇用到另一個生活情境，檢查對他人與自己的影響",
    preOpenFocus: "先看見誰受到影響，再說明選擇，最後想好如何減少負面影響",
    postOpenFocus: "用課堂概念解釋觀點，採取合宜行動，再到生活情境檢查影響",
    emergingToDeveloping: {
      achieved: "學生能同時說出兩種觀點或需要，提出具體選擇，並用情境中的資訊說明理由。",
      notYet: "學生只從自己立場下結論，或雖提到別人，卻沒有說明選擇會帶來什麼影響。",
    },
    developingToMastering: {
      achieved: "學生能預想選擇對不同人的影響，在新限制下調整做法，並用回饋確認是否更合宜。",
      notYet: "學生能說明原情境的理由，但換到新情境時無法調整，也沒有確認對他人的實際影響。",
    },
  },
  stakeholder_action: {
    id: "stakeholder_action",
    label: "辨認關係人 → 平衡行動 → 持續改善",
    q1Focus: "辨認真實問題、受到影響的人與重要條件",
    q2Focus: "提出兼顧不同需要且可執行的行動",
    q3Focus: "把行動移到另一個生活情境，檢查長期影響並調整",
    preOpenFocus: "找出要處理的問題與受影響的人，提出行動，再檢查可能影響",
    postOpenFocus: "說明課堂概念如何看問題，執行平衡行動，再處理生活中的新限制",
    emergingToDeveloping: {
      achieved: "學生能指出主要問題與至少兩方需要，提出可執行做法，並說明取捨理由。",
      notYet: "學生只看到單一目標，或提出口號式做法，沒有說明由誰、何時或如何執行。",
    },
    developingToMastering: {
      achieved: "學生能在新限制下調整行動，考量後續影響，並設計回饋或資料來確認改善結果。",
      notYet: "學生的做法只適用原情境，未處理新限制、長期影響或確認方法。",
    },
  },
  role_collaboration: {
    id: "role_collaboration",
    label: "看清共同任務 → 協調分工 → 合作調整",
    q1Focus: "辨認共同目標、角色與彼此需要配合的位置",
    q2Focus: "安排分工、溝通與互相支援的具體做法",
    q3Focus: "把合作方法用到另一個生活任務，遇到變化時重新協調",
    preOpenFocus: "先看清共同任務與角色，再排分工，最後想好遇到變化怎麼合作",
    postOpenFocus: "說明課堂合作概念，實際安排協作，再把方法用到新的共同任務",
    emergingToDeveloping: {
      achieved: "學生能說清楚共同目標、角色連結與溝通方式，並排出能互相支援的分工。",
      notYet: "學生只把工作切開，沒有說明角色如何配合、何時確認或遇到問題向誰求助。",
    },
    developingToMastering: {
      achieved: "學生能依團隊進度與新限制重新協調角色，用共同紀錄或回饋確認合作成效。",
      notYet: "學生能照原分工完成工作，但成員或條件改變時沒有協調、調整或確認機制。",
    },
  },
  audience_communication: {
    id: "audience_communication",
    label: "理解受眾 → 設計表達 → 依回應改進",
    q1Focus: "辨認受眾需要、目的與訊息中最重要的內容",
    q2Focus: "選擇合適的表達方式、媒介與具體訊息",
    q3Focus: "把表達方法用到另一個生活受眾，依回應調整",
    preOpenFocus: "先想清楚要對誰說，再設計表達，最後看回應改進",
    postOpenFocus: "說明課堂溝通概念，完成有目的的表達，再移到新受眾情境",
    emergingToDeveloping: {
      achieved: "學生能說出受眾需要與溝通目的，選擇合適方式，並說明訊息如何幫助對方理解或行動。",
      notYet: "學生只把資訊說完，沒有依受眾需要選內容、媒介或說明選擇理由。",
    },
    developingToMastering: {
      achieved: "學生能根據新受眾、媒介限制或實際回應調整訊息，並確認對方是否理解或採取行動。",
      notYet: "學生能完成原本表達，但換受眾或媒介後仍使用同一說法，也沒有檢查溝通效果。",
    },
  },
  idea_action_check: {
    id: "idea_action_check",
    label: "說清楚想法 → 化為行動 → 檢查改進",
    q1Focus: "辨認要解決的問題、目標與想法的關鍵",
    q2Focus: "把想法排成有順序、角色、資源與時間的行動",
    q3Focus: "把方法用到另一個生活問題，依結果與限制調整",
    preOpenFocus: "先說清楚想完成什麼，再排出行動，最後想好如何看效果",
    postOpenFocus: "說明課堂概念如何支持想法，真正執行，再把方法移到生活問題",
    emergingToDeveloping: {
      achieved: "學生能把想法轉成有先後順序、角色或資源的具體步驟，並說明要用什麼結果判斷是否做到。",
      notYet: "學生只有想法或目標，沒有可開始的步驟、負責方式、所需資源或檢查結果。",
    },
    developingToMastering: {
      achieved: "學生能依執行結果與新限制調整計畫，把同一做法移到生活情境，並用資料或回饋確認效果。",
      notYet: "學生能完成原計畫，但遇到新限制時無法調整，也沒有把做法用到其他情境或確認成效。",
    },
  },
  evidence_reason_revise: {
    id: "evidence_reason_revise",
    label: "找出證據 → 說明理由 → 補證修正",
    q1Focus: "辨認與問題最有關的資料、主張或線索",
    q2Focus: "使用共同條件比較資料並說明判斷理由",
    q3Focus: "把判斷方法用到另一個生活問題，補證、修正並確認",
    preOpenFocus: "先找重要資料，再用理由判斷，最後在限制下補證確認",
    postOpenFocus: "說明課堂判斷概念，實際比較資料，再移到新的生活問題驗證",
    emergingToDeveloping: {
      achieved: "學生能引用兩邊具體資料，使用相同條件比較，並用資料細節支持判斷理由。",
      notYet: "學生只指出資料不同或直接選一邊，沒有共同條件，理由仍停留在個人感覺。",
    },
    developingToMastering: {
      achieved: "學生能指出資料或方法限制，提出可行補證方式，把判斷移到新情境並獨立確認。",
      notYet: "學生只重複原本比較方式，或雖提出補充方法，卻沒有說明如何確認與修正。",
    },
  },
};

const INDICATOR_ROUTE: Record<string, AssessmentStrategyId> = {
  "C1-P1": "learning_reflection",
  "C1-P2": "learning_reflection",
  "C1-P3": "perspective_impact",
  "C1-P4": "perspective_impact",
  "C2-P1": "stakeholder_action",
  "C2-P2": "stakeholder_action",
  "C2-P3": "stakeholder_action",
  "C2-P4": "stakeholder_action",
  "C3-P1": "role_collaboration",
  "C3-P2": "role_collaboration",
  "C3-P3": "role_collaboration",
  "C3-P4": "role_collaboration",
  "C3-P5": "role_collaboration",
  "C4-P1": "audience_communication",
  "C4-P2": "audience_communication",
  "C4-P3": "audience_communication",
  "C4-P4": "audience_communication",
  "C4-P5": "audience_communication",
  "C5-P1": "idea_action_check",
  "C5-P2": "idea_action_check",
  "C5-P3": "idea_action_check",
  "C5-P4": "idea_action_check",
  "C6-P1": "evidence_reason_revise",
  "C6-P2": "evidence_reason_revise",
  "C6-P3": "evidence_reason_revise",
  "C6-P4": "evidence_reason_revise",
  "C6-P5": "evidence_reason_revise",
};

const CUSTOM_ROUTE: Array<{ pattern: RegExp; strategy: AssessmentStrategyId }> = [
  { pattern: /協作|合作|團隊|分工|人際|跨文化/, strategy: "role_collaboration" },
  { pattern: /溝通|受眾|表達|倡導|訊息|媒介/, strategy: "audience_communication" },
  { pattern: /創造|創意|想法|行動|領導|創業|探究|方案/, strategy: "idea_action_check" },
  { pattern: /批判|證據|資訊|論點|模式|知識|查證|判斷/, strategy: "evidence_reason_revise" },
  { pattern: /公民|永續|全球|和平|福祉|真實世界|環境|利害關係/, strategy: "stakeholder_action" },
  { pattern: /同理|惻隱|正直|品格|責任|數位使用/, strategy: "perspective_impact" },
  { pattern: /學習|毅力|韌性|反思|堅持|態度/, strategy: "learning_reflection" },
];

export function getGradeBand(grade: string): GradeBand {
  return /國[一二三]|七|八|九|7|8|9/.test(grade) ? "junior" : "senior";
}

export function getAssessmentStrategy(form: CourseForm): AssessmentStrategyProfile {
  const routed = form.source === "資料庫" ? INDICATOR_ROUTE[form.indicatorId] : undefined;
  if (routed) return STRATEGIES[routed];

  const sourceText = `${form.customIndicator} ${form.indicatorId}`;
  const custom = CUSTOM_ROUTE.find(({ pattern }) => pattern.test(sourceText));
  return STRATEGIES[custom?.strategy ?? "learning_reflection"];
}

export function buildStrategyPromptBlock(form: CourseForm): string {
  const strategy = getAssessmentStrategy(form);
  const junior = getGradeBand(form.grade) === "junior";
  const tone = junior
    ? "國中語氣：每句只放一個主要意思，使用日常動詞與短句；必要名詞先用生活語句說明，不使用抽象學術術語。"
    : "高中語氣：使用自然、清楚的完整句，可保留必要課程名詞，但必須讓學生能從情境直接理解。";

  return `【本次能力階梯策略】
- 策略：${strategy.label}
- Q1／概念理解：${strategy.q1Focus}
- Q2／行動應用：${strategy.q2Focus}
- Q3／生活遷移：${strategy.q3Focus}
- 課前 Q4：${strategy.preOpenFocus}
- 課後 Q4：${strategy.postOpenFocus}
- 語氣規則：${tone}

Q1–Q4 必須沿用這一條能力階梯。Q1 不可考背誦；Q2 必須要求學生把理解化為可做的選擇；Q3 必須更換條件但維持同一能力；Q4 的四層判準與學生回答範例也必須依此策略區分。`;
}
