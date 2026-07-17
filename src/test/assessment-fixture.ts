import type {
  AssessmentDocument,
  AssessmentModuleDocument,
  AssessmentQuestionDocument,
  CourseForm,
  NarrativeLevelDocument,
} from "@/types";

export const TEST_FORM: CourseForm = {
  grade: "高二",
  subject: "化學",
  source: "自訂",
  indicatorId: "",
  customIndicator: "能比較多項證據並形成可驗證的判斷",
  activityName: "反應速率 - 硫粒子生成實驗",
  lifeKeywords: "食物保存與腐敗",
  tools: "手機計時、照片對照",
};

function narrativeLevel(level: string): NarrativeLevelDocument {
  return {
    classroomBehavior: `${level}學生會檢查觀察紀錄，並說明自己採用的判斷依據。`,
    verbalExpression: `我會先比較資料，再決定哪些證據支持目前的解釋。`,
    lifeProjection: `面對食品保存爭議時，能查看日期、照片與環境紀錄再判斷。`,
    motivationMonologue: `我想知道自己的判斷是否有可靠證據，而不是只靠直覺。`,
    emotionalPain: `當資料互相矛盾時容易猶豫，期待有明確的比較步驟。`,
    keyActivity: `用兩筆相反紀錄完成證據排序，寫出選擇與一項限制。`,
    scaffold: `使用「主張、證據、理由、限制」四欄檢核表逐項確認。`,
    teacherDialogue: `哪一筆紀錄最能支持你的判斷，還缺什麼才能更確定？`,
  };
}

function question(stem: string, focus: string): AssessmentQuestionDocument {
  return {
    stem,
    options: [
      { text: `只依第一印象立刻決定`, rationale: `只憑直覺，沒有檢查${focus}證據` },
      { text: `查看單一紀錄後作出決定`, rationale: `開始引用資料，但未比較來源限制` },
      { text: `比較兩項紀錄再說明理由`, rationale: `能交叉比較證據並提出合理依據` },
      { text: `依共同標準比較並補充驗證`, rationale: `能用規準整合證據，也規劃下一步查證` },
    ],
  };
}

function moduleDocument(type: "pre" | "post"): AssessmentModuleDocument {
  const scenarioBlueprint =
    type === "pre"
      ? {
          setting: "同一盒點心放在兩處後，大家要決定哪一盒較適合保留",
          contextFacts: [
            "兩盒點心在同一天開始記錄，並由不同同學負責拍照與填寫時間",
            "大家事先約定以外觀第一次出現明顯變化的日期作為比較起點",
          ] as [string, string],
          evidenceA: { label: "每日照片", detail: "兩盒外觀在不同日期出現變化" },
          evidenceB: { label: "放置時間紀錄", detail: "外觀改變的先後順序與照片不一致" },
          conflict: "外觀變化日期與放置時間的先後順序不一致",
          decisionTask: "判斷哪一份紀錄較能支持目前的結論",
          observationFocus: ["外觀變化", "放置時間", "紀錄日期"] as [string, string, string],
          constraint: "缺少環境資訊",
        }
      : {
          setting: "學生把課堂的比較方法用來判斷兩種食品保存方式",
          contextFacts: [
            "兩組都沿用課堂的觀察表，但拍照角度與填寫時間並不完全相同",
            "這次要把課堂方法用在新的食品與保存位置上",
          ] as [string, string],
          evidenceA: { label: "手機計時", detail: "兩種方式的變化時間相差不大" },
          evidenceB: { label: "照片變化", detail: "外觀變化的先後順序與計時結果不同" },
          conflict: "變化時間與照片顯示的先後順序不一致",
          decisionTask: "判斷哪一份紀錄較能支持目前的結論",
          observationFocus: ["計時資料", "照片變化", "比較標準"] as [string, string, string],
          constraint: "比較標準失效",
        };
  return {
    scenarioBlueprint,
    q1: question("面對上述資料，第一步應查看哪一項基本證據來確認目前問題？", "基本"),
    q2: question("同一情境中的照片與時間紀錄不一致時，哪種比較方式最可靠？", "比較"),
    q3: question("若下次遇到新的保存情境，應如何調整蒐證方式，使判斷更可靠？", "遷移"),
    q4: {
      evidenceLimited: "只提出結論，未引用可檢查的證據或理由。",
      emerging: "能引用一項紀錄，但沒有比較資料分歧與限制。",
      developing: "能使用共同標準比較多項證據，選擇較可信的資料並說明理由。",
      mastering: "能指出資料或工具限制，調整方法、遷移到新情境並提出替代驗證。",
      studentExamples: {
        evidenceLimited: "我覺得照片看起來比較清楚，所以直接用照片判斷。",
        emerging: "我看到照片和時間紀錄不一樣，但還不確定應該相信哪一個。",
        developing: "我會先用相同日期比較照片和時間紀錄，再選擇記錄方式較完整的資料。",
        mastering: "如果照片缺漏，我會改用每日文字紀錄並找另一份資料交叉比對，確認結果不只受單一來源影響。",
      },
      ...(type === "post"
        ? {
            conceptAnnotations: {
              correct: "能說明相同條件比較可以排除記錄方式差異，並連結到目前兩份資料。",
              partial: "知道要比較資料，但沒有說清楚為何必須使用相同條件。",
              misconception: "認為照片一定比時間紀錄正確，忽略兩種資料都可能受記錄方式影響。",
            },
            transferAnnotations: {
              notYet: "只重述課堂的比較步驟，沒有連結食品保存情境中的新限制。",
              emerging: "能把相同條件比較用到保存問題，但沒有處理比較標準失效或確認結果。",
              adaptive: "能依比較標準失效調整資料蒐集方式，並用另一項紀錄確認新做法的結果。",
            },
          }
        : {}),
    },
    statistics: "Q1–Q3 加總後，低分代表證據有限，中低分代表萌芽，中高分代表發展，高分代表精熟；教師需搭配 Q4 的證據、理由、限制與遷移表現綜合判讀。",
  };
}

export const TEST_ASSESSMENT_DOCUMENT: AssessmentDocument = {
  narrative: {
    evidenceLimited: narrativeLevel("證據有限"),
    emerging: narrativeLevel("萌芽"),
    developing: narrativeLevel("發展"),
    mastering: narrativeLevel("精熟"),
  },
  pre: moduleDocument("pre"),
  post: moduleDocument("post"),
};
