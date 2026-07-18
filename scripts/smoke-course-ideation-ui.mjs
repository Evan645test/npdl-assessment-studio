#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseUrl = process.env.NPDL_PREVIEW_URL ?? "http://127.0.0.1:4180/";
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir =
  process.env.NPDL_UI_ARTIFACT_DIR ?? "/tmp/npdl-course-ideation-ui-smoke";

const keywordAnalysis = {
  summary: "學生將分析校園中的氣候風險，並提出可被檢驗的調適倡議。",
  themes: [
    {
      label: "氣候風險",
      keywords: ["極端氣候", "校園熱島"],
      interpretation: "辨識氣候現象與校園生活的關聯。",
    },
    {
      label: "證據行動",
      keywords: ["數據證據", "小組倡議"],
      interpretation: "以資料支持小組提出的改善主張。",
    },
  ],
  curriculumSignals: ["比較不同地點的溫度資料", "用證據支持調適方案"],
  suggestedKeywords: ["利害關係人"],
};

const courseAlignment = {
  curriculumSelection: {
    performanceIds: [
      "5730-7406-performance-1c-v-1",
      "5730-7406-performance-3b-v-2",
    ],
    contentIds: [
      "5730-7406-content-ia-v-2",
      "5730-7406-content-eb-v-5",
    ],
    rationale: "課程聚焦氣候資料分析與調適方案，對應地理探究表現與氣候內容。",
  },
  curriculumRecommendation: {
    performanceIds: [
      "5730-7406-performance-1c-v-1",
      "5730-7406-performance-3b-v-2",
      "5730-7406-performance-2a-v-2",
      "5730-7406-performance-1b-v-2",
      "5730-7406-performance-1a-v-3",
    ],
    contentIds: [
      "5730-7406-content-ia-v-2",
      "5730-7406-content-eb-v-5",
      "5730-7406-content-ab-v-3",
      "5730-7406-content-mb-v-2",
      "5730-7406-content-aa-v-1",
    ],
    rationale: "依氣候議題、資料分析、問題探究與校園倡議的相關性排序。",
  },
  backwardDesign: {
    transferGoals: ["能在新的校園情境中，以資料判讀風險並提出調適方案。"],
    enduringUnderstandings: ["氣候風險需要結合現象、脆弱度與資料證據判斷。"],
    essentialQuestions: ["我們如何用證據決定校園氣候調適的優先順序？"],
  },
  recommendations: [
    {
      indicatorId: "C2-P1",
      reason: "學生必須建立、組織並比較校園氣候資料。",
      matchedKeywords: ["極端氣候", "數據證據"],
    },
    {
      indicatorId: "C6-P1",
      reason: "學生需形成清楚主張並向校園利害關係人溝通。",
      matchedKeywords: ["小組倡議"],
    },
  ],
  learningOutcomes: {
    knowledgeFoundation: {
      statement: "能說明極端氣候與校園熱島的成因及影響。",
      evidence: "概念圖與資料摘要。",
      successCriteria: [
        "能引用資料說明至少兩項氣候風險。",
        "能區分氣候現象、影響與調適措施。",
      ],
    },
    competencySubdimension: {
      statement: "能組織多項資料並形成有證據的判斷。",
      evidence: "資料比較表與推論紀錄。",
    },
    fourElementsPractice: {
      statement: "能與夥伴運用數位資料提出並修正校園調適倡議。",
      evidence: "倡議簡報、同儕回饋與修訂紀錄。",
    },
  },
  fourElements: [
    {
      name: "學習夥伴關係",
      designMove: "邀請校內行政人員回饋方案。",
      studentEvidence: "訪談紀錄與回饋修訂表。",
    },
    {
      name: "學習環境",
      designMove: "讓學生進行校園實地測量與討論。",
      studentEvidence: "測量地圖與小組討論紀錄。",
    },
    {
      name: "數位利用",
      designMove: "用共享地圖整理溫度與遮蔭資料。",
      studentEvidence: "附來源的數位資料圖層。",
    },
    {
      name: "教學實踐",
      designMove: "以提問與形成性回饋逐步修正主張。",
      studentEvidence: "初稿、回饋與定稿差異。",
    },
  ],
  evidenceTools: ["校園測量表", "倡議簡報", "同儕回饋單"],
};

const revisedSummary =
  "學生將以一般高中可取得的校園資料分析氣候風險，並提出可檢驗的調適倡議。";
const revisedRationale =
  "以氣候資料判讀與校園調適倡議，連結地理探究表現及氣候變遷內容。";

const evidencePlan = {
  performanceTask: {
    goal: "提出可執行的校園氣候調適方案。",
    role: "校園氣候顧問",
    audience: "校務會議代表",
    situation: "校園需要決定下一年度優先改善項目。",
    product: "附資料證據的倡議簡報與行動方案",
    criterionIds: ["success-1", "success-2"],
  },
  questionMaps: ["pre", "post"].map((phase) => ({
    phase,
    sharedProblem:
      phase === "pre"
        ? "如何判斷校園中最需要處理的高溫風險？"
        : "面對新增遮蔭資料與預算限制，應如何修正調適優先順序？",
    transferDifference:
      phase === "pre"
        ? "課前只使用學生既有生活經驗與一般資料。"
        : "課後加入新的遮蔭資料、預算限制與不同使用者需求。",
    questions: [
      {
        id: "Q1",
        focus: "conceptual_understanding",
        purpose: "辨識與問題直接相關的概念與證據。",
        criterionIds: ["success-1"],
        observableEvidence: "能指出關鍵風險與相關資料。",
      },
      {
        id: "Q2",
        focus: "action_application",
        purpose: "比較資料並選擇可執行的判斷方式。",
        criterionIds: ["success-1", "success-2"],
        observableEvidence: "能說明資料取捨與行動理由。",
      },
      {
        id: "Q3",
        focus: "life_transfer",
        purpose: "把判斷方法遷移到新的校園限制。",
        criterionIds: ["success-2"],
        observableEvidence: "能因應限制調整方法並確認結果。",
      },
      {
        id: "Q4",
        focus: "guided_response",
        purpose: "整合概念、行動與遷移形成完整書面判斷。",
        criterionIds: ["success-1", "success-2"],
        observableEvidence: "能留下可依四級進程判讀的完整回應。",
      },
    ],
  })),
  evidenceItems: [
    {
      type: "diagnostic",
      title: "課前 Q1–Q4",
      criterionIds: ["success-1", "success-2"],
      artifact: "四題基準想法紀錄",
      method: "個人作答後匿名彙整",
      timing: "第一節開始",
      decisionRule: "若三分之一以上學生混淆概念，先安排共同判讀。",
    },
    {
      type: "formative",
      title: "資料判讀出口單",
      criterionIds: ["success-1"],
      artifact: "主張、證據與推論三欄出口單",
      method: "教師依檢核表快速分類",
      timing: "第二節結束",
      decisionRule: "若三分之一以上缺少證據，下一節先補做共同判讀。",
    },
    {
      type: "summative",
      title: "校園調適倡議",
      criterionIds: ["success-1", "success-2"],
      artifact: "倡議簡報與資料附件",
      method: "學科規準評定與真實受眾回饋",
      timing: "第三節",
      decisionRule: "未達發展層級者依回饋補證並修訂。",
    },
    {
      type: "transfer",
      title: "課後 Q1–Q4",
      criterionIds: ["success-1", "success-2"],
      artifact: "新校園案例的四題遷移作答",
      method: "個人書面回應",
      timing: "第三節結束",
      decisionRule: "無法遷移者在下一單元保留跨情境比較鷹架。",
    },
  ],
  rubric: ["success-1", "success-2"].map((criterionId) => ({
    criterionId,
    levels: {
      evidenceLimited: "未提出可辨識的證據。",
      emerging: "提出資料但未說明關聯。",
      developing: "能以相關資料支持判斷。",
      mastering: "能比較資料、處理限制並形成有力判斷。",
    },
  })),
};

const revisedPerformanceTask = {
  ...evidencePlan.performanceTask,
  product: "以校內既有簡報設備呈現的氣候調適提案與紙本資料附件",
};
const assessmentNarrativeLevel = (level) => ({
  classroomBehavior: `${level}學生會檢查校園氣候資料，並說明採用的判斷依據。`,
  verbalExpression: "我會先比較資料，再決定哪些證據支持目前的主張。",
  lifeProjection: "面對生活中的氣候風險時，能查看資料與限制再判斷。",
  motivationMonologue: "我想知道自己的倡議是否有可靠證據，而不是只憑直覺。",
  emotionalPain: "當資料互相矛盾時容易猶豫，需要清楚的比較步驟。",
  keyActivity: "用兩筆不同資料完成證據排序，寫出選擇與一項限制。",
  scaffold: "使用主張、證據、理由、限制四欄檢核表。",
  teacherDialogue: "哪一筆資料最能支持你的判斷，還缺什麼才能更確定？",
});
const assessmentQuestion = (stem, focus) => ({
  stem,
  options: [
    { text: "只依第一印象決定", rationale: `只憑直覺，沒有檢查${focus}證據` },
    { text: "查看單一資料後決定", rationale: "開始引用資料，但未比較來源限制" },
    { text: "比較兩項資料並說明理由", rationale: "能交叉比較證據並提出合理依據" },
    { text: "依共同標準比較並補充驗證", rationale: "能整合證據，也規劃下一步查證" },
  ],
});
const courseAssessmentSeedResponse = {
  narrative: {
    evidenceLimited: assessmentNarrativeLevel("證據有限"),
    emerging: assessmentNarrativeLevel("萌芽"),
    developing: assessmentNarrativeLevel("發展"),
    mastering: assessmentNarrativeLevel("精熟"),
  },
  pre: {
    scenarioBlueprint: {
      setting: "校園兩處在同一天測得不同溫度，班級要判斷哪一處優先改善",
      contextFacts: [
        "兩處都在午休時間量測，但使用的溫度計與遮蔭條件不同",
        "大家事先約定以相同時段的溫度與使用人數作為比較依據",
      ],
      evidenceA: { label: "溫度紀錄", detail: "操場與走廊的溫度差異明顯" },
      evidenceB: { label: "使用人數", detail: "較高溫處的使用人數反而較少" },
      conflict: "溫度高低與實際使用人數呈現不同的優先順序",
      decisionTask: "判斷哪一處應優先投入有限的遮蔭設備",
      observationFocus: ["溫度資料", "使用人數", "量測條件"],
      constraint: "只能先改善一處",
    },
    q1: assessmentQuestion(
      "面對上述資料，第一步應查看哪項基本證據確認目前問題？",
      "基本",
    ),
    q2: assessmentQuestion(
      "溫度與使用人數呈現不同結論時，哪種比較方式最可靠？",
      "比較",
    ),
    q3: assessmentQuestion(
      "若換到另一棟教學大樓，應如何調整蒐證方式使判斷更可靠？",
      "遷移",
    ),
    q4: {
      evidenceLimited: "只提出結論，未引用可檢查的證據或理由。",
      emerging: "能引用一項資料，但沒有比較資料分歧與限制。",
      developing: "能使用共同標準比較多項證據，並說明選擇理由。",
      mastering: "能指出資料限制、調整方法並提出替代驗證。",
      studentExamples: {
        evidenceLimited: "我覺得操場比較熱，所以直接先改善操場。",
        emerging: "我看到操場較熱，但還不確定人數資料要怎麼使用。",
        developing: "我會先比較相同時段的溫度和使用人數，再說明優先順序。",
        mastering: "我會先確認量測條件，再加入不同時段資料交叉驗證後決定。",
      },
    },
    statistics:
      "Q1–Q3 加總判讀四級趨勢，教師再搭配 Q4 的證據、理由、限制與遷移表現綜合判讀。",
  },
};
const postAssessmentResponse = {
  post: {
    scenarioBlueprint: {
      setting:
        "完成「全球氣候變遷－極端氣候與校園調適倡議」後，學生收到另一校區的熱風險資料與新增預算限制",
      contextFacts: [
        "另一校區以相同時段量測溫度，但通風、樓層與活動人數不同",
        "原本的改善方案只能保留一項措施，且必須兼顧高溫風險與使用需求",
      ],
      evidenceA: {
        label: "新校區溫度分布圖",
        detail: "頂樓教室溫度較高，但主要使用時段集中在上午",
      },
      evidenceB: {
        label: "空間使用與預算表",
        detail: "一樓空間人數較多，但只能負擔一種改善措施",
      },
      conflict: "最高溫位置與最多人使用的位置並不相同",
      decisionTask: "決定有限預算下應優先改善的空間與措施",
      observationFocus: ["溫度風險", "使用人數", "預算限制"],
      constraint: "只能執行一項改善措施",
    },
    q1: assessmentQuestion(
      "面對新校區資料，哪一項概念最能協助辨識真正需要處理的風險？",
      "概念",
    ),
    q2: assessmentQuestion(
      "最高溫位置與最多人使用的位置不同時，哪種行動判斷最合理？",
      "行動",
    ),
    q3: assessmentQuestion(
      "若預算再縮減且量測資料缺漏，應如何調整原有方法並確認結果？",
      "遷移",
    ),
    q4: {
      evidenceLimited: "只提出選擇，未引用新資料或說明理由。",
      emerging: "能引用一項新資料，但未處理資料衝突與預算限制。",
      developing: "能比較多項新資料，並依限制提出有理由的調整方案。",
      mastering: "能處理資料限制、提出替代驗證，並說明如何遷移原有判斷方法。",
      studentExamples: {
        evidenceLimited: "我覺得頂樓最熱，所以就先改善頂樓。",
        emerging: "我看到頂樓最熱，但還沒比較實際使用人數和預算。",
        developing: "我會比較溫度、使用人數與預算，再選擇能降低最多風險的措施。",
        mastering: "如果部分量測缺漏，我會補查相同時段資料並訪問使用者，再用新紀錄確認調整是否有效。",
      },
      conceptAnnotations: {
        correct: "能以風險、暴露與限制說明為何不能只看最高溫。",
        partial: "知道要比較資料，但未說明各資料與風險判斷的關係。",
        misconception: "認為最高溫位置必然就是唯一優先改善位置。",
      },
      transferAnnotations: {
        notYet: "只重述原課程方案，未回應新校區資料或預算限制。",
        emerging: "能套用部分比較方法，但未調整資料缺漏或確認成效。",
        adaptive: "能因新限制調整蒐證與決策方法，並提出可觀察的成效確認方式。",
      },
    },
    statistics:
      "Q1–Q3 依能力階梯加總判讀四級趨勢，再以 Q4 的概念、行動、限制處理與遷移證據進行人工校準。",
  },
};
const revisedDevelopingNarrative = {
  ...courseAssessmentSeedResponse.narrative.developing,
  classroomBehavior:
    "發展學生能比較兩項校園氣候資料，並以共同標準說明判斷依據。",
};
const revisedUnitArc =
  "先診斷知識基礎，再以 NPDL 子向度判讀資料，最後完成倡議與新情境遷移。";
const lessonReferenceAnalysis = {
  version: 1,
  inferredCourse: {
    grade: "高二",
    subject: "化學",
    unitName: "既有教案分析後的單元",
    teachingTopic: "以生活資料探究反應速率",
    coreKeywords: ["反應速率", "變因控制", "證據判讀"],
  },
  learningGoals: ["能以碰撞理論解釋反應速率變化。"],
  reusableActivities: ["以一般高中實驗室器材進行小組變因控制實驗。"],
  assessmentIdeas: ["以實驗紀錄表檢查主張、證據與推論。"],
  resources: ["燒杯、量筒、碼表與護目鏡。"],
  constraints: ["每組共用一套器材，單節 50 分鐘。"],
  differentiationSupports: ["提供變因辨識句型與表格鷹架。"],
  cautions: ["實際器材數量與藥品濃度須由教師確認。"],
};

const blueprintLesson = (lessonNumber, overrides) => ({
  lessonNumber,
  title: `第 ${lessonNumber} 節課程`,
  minutes: 50,
  milestone: "完成本節里程碑。",
  outcomeIds: ["knowledge-foundation"],
  criterionIds: ["success-1", "success-2"],
  evidenceItemIds: ["evidence-formative-1"],
  learningIntention: "以資料支持氣候風險判斷。",
  coreTask: "整理資料並形成可檢驗的主張。",
  formativeCheck: "資料判讀紀錄",
  decisionRule: "若三分之一以上缺少證據，先安排共同判讀。",
  fourElementNames: ["學習夥伴關係", "數位利用"],
  previousConnection: "承接前一節證據。",
  nextConnection: "準備下一節修訂。",
  ...overrides,
});

const unitBlueprint = {
  unitArc: "先診斷概念，再練習資料判讀，最後完成倡議並遷移。",
  lessons: [
    blueprintLesson(1, {
      title: "辨識校園氣候風險",
      milestone: undefined,
      outcomeIds: [],
      evidenceItemIds: ["evidence-diagnostic-1"],
      previousConnection: "連結生活中的高溫經驗。",
    }),
    blueprintLesson(2, {
      title: "用資料支持判斷",
    }),
    blueprintLesson(3, {
      title: "倡議、回饋與遷移",
      outcomeIds: ["four-elements-practice"],
      evidenceItemIds: ["evidence-summative-1", "evidence-transfer-1"],
      nextConnection: "將策略遷移到新的社區案例。",
    }),
  ],
};

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-background-networking"],
});

const courseWorkspace = (page) =>
  page.locator('section[aria-label="課程設計工作區"]');

async function verifyCourseIdeationUi(name, viewport, verifyHandoff) {
  const context = await browser.newContext({ viewport, locale: "zh-TW" });
  const page = await context.newPage();
  let requestCount = 0;
  let geminiHeaderVerified = false;
  let evidenceResponseCount = 0;
  let forceEvidenceFailure = false;

  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "npdl_selected_model",
      JSON.stringify("puter:gemini-3.1-flash-lite"),
    );
    localStorage.setItem("npdl_custom_api_key", "gemini-ui-smoke-placeholder");
    localStorage.setItem("npdl_openai_api_key", "openai-ui-smoke-placeholder");
    localStorage.setItem("npdl_xai_api_key", "xai-ui-smoke-placeholder");
    localStorage.setItem("npdl_draft_dismissed", "1");
  });
  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      requestCount += 1;
      const requestUrl = route.request().url();
      if (
        requestUrl.includes("gemini-ui-smoke-placeholder") ||
        requestUrl.includes("key=")
      ) {
        throw new Error(`${name} Gemini API Key 不得出現在 URL`);
      }
      if (
        route.request().headers()["x-goog-api-key"] !==
        "gemini-ui-smoke-placeholder"
      ) {
        throw new Error(`${name} Gemini 請求缺少 x-goog-api-key header`);
      }
      geminiHeaderVerified = true;
      const body = JSON.parse(route.request().postData() ?? "{}");
      const schemaProperties =
        body?.generationConfig?.responseJsonSchema?.properties ?? {};
      const requestText = JSON.stringify(body?.contents ?? []);
      if (
        requestText.includes("private-lesson-reference.txt") ||
        requestText.includes("gemini-ui-smoke-placeholder")
      ) {
        throw new Error(`${name} AI 提示內容含檔名或 API Key`);
      }
      let output = null;
      if ("themes" in schemaProperties) {
        output = keywordAnalysis;
      } else if ("recommendations" in schemaProperties) {
        output = courseAlignment;
      } else if ("inferredCourse" in schemaProperties) {
        if (!requestText.includes("ATTACHMENT_RAW_SENTINEL")) {
          throw new Error(`${name} 教案附件文字未送入分析提示`);
        }
        output = lessonReferenceAnalysis;
      } else if ("narrative" in schemaProperties && "pre" in schemaProperties) {
        output = courseAssessmentSeedResponse;
      } else if ("post" in schemaProperties) {
        output = postAssessmentResponse;
      } else if ("performanceTask" in schemaProperties) {
        evidenceResponseCount += 1;
        output =
          forceEvidenceFailure || evidenceResponseCount === 1
            ? { ...evidencePlan, questionMaps: [] }
            : evidencePlan;
      } else if ("unitArc" in schemaProperties) {
        output = JSON.stringify(unitBlueprint);
      } else if ("value" in schemaProperties) {
        if (requestText.includes("創意孵化摘要")) {
          output = { value: revisedSummary };
        } else if (requestText.includes("課綱對齊理由")) {
          output = { value: revisedRationale };
        } else if (requestText.includes("真實總結任務")) {
          output = { value: revisedPerformanceTask };
        } else if (
          requestText.includes("課程敘述語") &&
          requestText.includes("發展")
        ) {
          output = { value: revisedDevelopingNarrative };
        } else if (requestText.includes("單元弧線")) {
          output = { value: revisedUnitArc };
        }
      }
      if (!output) {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "未預期的 schema" } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(output) }],
              },
            },
          ],
        }),
      });
    },
  );

  await page.goto(baseUrl, {
    waitUntil: "networkidle",
  });
  const reviseCard = async ({
    trigger,
    dialogName,
    instruction,
    expectedText,
  }) => {
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: dialogName });
    await dialog.waitFor();
    await dialog.getByLabel("希望 AI 如何修改？").fill(instruction);
    await dialog
      .getByRole("button", { name: "產生修改草稿" })
      .click();
    await dialog
      .getByRole("heading", { name: "AI 修改草稿預覽" })
      .waitFor();
    await dialog.getByText(expectedText, { exact: false }).first().waitFor();
    if (name === "desktop" && dialogName === "修改課綱對齊理由") {
      await page.screenshot({
        path: `${outputDir}/ai-revision-desktop.png`,
        fullPage: false,
      });
    }
    await dialog.getByRole("button", { name: "套用這個版本" }).click();
    await dialog.waitFor({ state: "hidden" });
  };
  await page.getByRole("button", { name: "課程設計" }).waitFor();
  await page.getByText("合併版已移除 Puter 免費模型", { exact: false }).waitFor();
  const migratedModels = await page.evaluate(() => ({
    course: localStorage.getItem("npdl_course_ideation_model_v2"),
    shared: localStorage.getItem("npdl_selected_model"),
  }));
  if (migratedModels.course !== null) {
    throw new Error(`${name} 合併版未移除舊課程專用模型鍵`);
  }
  if (migratedModels.shared !== JSON.stringify("gemini-2.5-flash")) {
    throw new Error(`${name} 舊 Puter 設定未遷移至共用 Gemini 模型`);
  }
  await courseWorkspace(page)
    .getByRole("button", { name: "AI 分析核心關鍵字" })
    .click();

  const consent = page.getByRole("dialog", { name: "首次 AI 資料傳送同意" });
  await consent.waitFor();
  await consent.getByText("Gemini", { exact: true }).waitFor();
  await consent.getByText("Gemini 2.5 Flash", { exact: false }).waitFor();
  await consent.getByText("核心關鍵字分析", { exact: true }).waitFor();
  await consent.getByText("查看本次完整傳送內容", { exact: true }).click();
  await consent.getByText("極端氣候與校園調適倡議", { exact: false }).waitFor();
  await consent.getByRole("button", { name: "同意並繼續" }).click();

  await courseWorkspace(page)
    .getByText(keywordAnalysis.summary, { exact: true })
    .waitFor();
  if (
    (await courseWorkspace(page)
      .getByRole("button", { name: "AI 修改這張卡" })
      .count()) !== 6
  ) {
    throw new Error(`${name} 創意孵化卡片未全部提供獨立 AI 修改入口`);
  }
  await reviseCard({
    trigger: courseWorkspace(page)
      .getByText(keywordAnalysis.summary, { exact: true })
      .locator("..")
      .getByRole("button", { name: "AI 修改這張卡" }),
    dialogName: "修改創意孵化摘要",
    instruction: "保留原意，讓內容更符合高一普通班可執行的程度。",
    expectedText: revisedSummary,
  });
  await courseWorkspace(page).getByText(revisedSummary, { exact: true }).waitFor();
  await courseWorkspace(page)
    .getByText(keywordAnalysis.themes[0].interpretation, { exact: true })
    .waitFor();
  await courseWorkspace(page)
    .getByRole("heading", { name: "108 課綱校準" })
    .waitFor();
  if (
    (await courseWorkspace(page)
      .getByText("尚未產生 AI 推薦。", { exact: false })
      .count()) !== 2
  ) {
    throw new Error(`${name} 初次校準前未清楚顯示兩類 AI 推薦尚未產生`);
  }
  await courseWorkspace(page)
    .getByRole("button", { name: "進行 108 課綱與 6Cs 校準" })
    .click();
  await courseWorkspace(page)
    .getByRole("heading", { name: "6Cs 子向度推薦" })
    .waitFor();
  if (
    (await courseWorkspace(page)
      .getByRole("button", { name: "AI 修改這張卡" })
      .count()) < 20
  ) {
    throw new Error(`${name} 課綱與學習終點卡片缺少獨立 AI 修改入口`);
  }
  await reviseCard({
    trigger: courseWorkspace(page)
      .getByRole("heading", { name: "108 課綱校準" })
      .locator("xpath=ancestor::section[1]")
      .getByRole("button", { name: "AI 修改這張卡" }),
    dialogName: "修改課綱對齊理由",
    instruction: "保留課綱代碼，讓學習成果更具體且可觀察。",
    expectedText: revisedRationale,
  });
  const curriculumCard = courseWorkspace(page)
    .getByRole("heading", { name: "108 課綱校準" })
    .locator("xpath=ancestor::section[1]");
  for (const title of ["學習表現", "學習內容"]) {
    const recommendationPanel = curriculumCard.getByLabel(`AI 推薦${title}`);
    if (
      (await recommendationPanel.getByText("AI 推薦", { exact: true }).count()) !==
      5
    ) {
      throw new Error(`${name} ${title}未固定顯示 5 項 AI 推薦完整卡片`);
    }
    await curriculumCard
      .getByText(`其他可選${title}`, { exact: false })
      .waitFor();
  }
  for (const code of [
    "地1c-Ⅴ-1",
    "地3b-Ⅴ-2",
    "地Ia-Ⅴ-2",
    "地Eb-Ⅴ-5",
  ]) {
    await curriculumCard
      .getByRole("button", { name: `取消選取 ${code}` })
      .waitFor();
  }
  if (
    (await curriculumCard.getByText("已選 2/2", { exact: false }).count()) !==
    2
  ) {
    throw new Error(`${name} AI 初次校準未各採用 2 項學習表現與學習內容`);
  }
  for (const code of [
    "地1c-Ⅴ-1",
    "地3b-Ⅴ-2",
    "地Ia-Ⅴ-2",
    "地Eb-Ⅴ-5",
  ]) {
    const selectedChip = curriculumCard.getByRole("button", {
      name: `取消選取 ${code}`,
    });
    if (
      (await selectedChip.getByText("AI 推薦", { exact: true }).count()) !== 1
    ) {
      throw new Error(`${name} 已選課綱 ${code} 未顯示 AI 推薦標籤`);
    }
  }
  await page
    .getByText("能引用資料說明至少兩項氣候風險。", { exact: true })
    .waitFor();
  if (name === "desktop") {
    await curriculumCard
      .getByLabel("AI 推薦學習表現")
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${outputDir}/curriculum-desktop.png`,
      fullPage: false,
    });
  }

  if (requestCount !== 4) {
    throw new Error(`${name} AI 請求次數錯誤：${requestCount}`);
  }
  if (!geminiHeaderVerified) {
    throw new Error(`${name} 未驗證 Gemini API Key header`);
  }
  if (await page.getByRole("dialog", { name: "首次 AI 資料傳送同意" }).count()) {
    throw new Error(`${name} 第二次 AI 呼叫不應再次要求瀏覽器同意`);
  }
  if (
    (await courseWorkspace(page)
      .getByText("註：關鍵字｜", { exact: false })
      .count()) !== 2
  ) {
    throw new Error(`${name} 未在兩個推薦項目顯示關鍵字註記`);
  }

  await courseWorkspace(page)
    .getByText("查看四個學生版學習進程", { exact: true })
    .click();
  for (const progression of ["證據有限", "萌芽", "發展", "精熟"]) {
    await courseWorkspace(page)
      .getByText(progression, { exact: true })
      .waitFor();
  }
  for (const outcome of ["01 知識基礎", "02 素養子向度", "03 四要素整合實踐"]) {
    await courseWorkspace(page).getByText(outcome, { exact: true }).waitFor();
  }
  for (const element of ["學習夥伴關係", "學習環境", "數位利用", "教學實踐"]) {
    await courseWorkspace(page)
      .getByRole("heading", { name: element, exact: true })
      .waitFor();
  }

  await page
    .getByRole("button", { name: "確認並鎖定學習終點" })
    .click();
  await courseWorkspace(page)
    .getByText("教師已確認", { exact: true })
    .waitFor();
  await courseWorkspace(page)
    .getByRole("button", { name: "AI 建立完整評量證據" })
    .click();
  await page
    .getByRole("heading", { name: "真實總結任務" })
    .first()
    .waitFor();
  const evidenceRevisionButtonCount = await courseWorkspace(page)
    .getByRole("button", { name: "AI 修改這張卡" })
    .count();
  if (evidenceRevisionButtonCount < 35) {
    throw new Error(
      `${name} 評量證據卡片缺少獨立 AI 修改入口：${evidenceRevisionButtonCount}`,
    );
  }
  await reviseCard({
    trigger: courseWorkspace(page)
      .getByRole("heading", { name: "真實總結任務" })
      .first()
      .locator("xpath=ancestor::article[1]")
      .getByRole("button", { name: "AI 修改這張卡" }),
    dialogName: "修改真實總結任務",
    instruction: "讓任務更符合一般高中現有設備，並保留完整 Q1–Q4。",
    expectedText: revisedPerformanceTask.product,
  });
  await courseWorkspace(page)
    .getByText("課前 Q1–Q4", { exact: true })
    .first()
    .waitFor();
  await page
    .getByText("逐項編修評量證據草稿", { exact: true })
    .click();
  await page
    .locator("label")
    .filter({ hasText: /^目標/ })
    .locator("textarea")
    .first()
    .fill("提出可執行的校園氣候調適方案（教師修訂）。");
  await page
    .getByRole("button", {
      name: "確認證據，前往課程敘述與課前評量",
    })
    .click();
  const assessmentSeedCard = courseWorkspace(page)
    .getByRole("heading", { name: "課程敘述與課前評量" })
    .locator("xpath=ancestor::section[1]");
  await assessmentSeedCard
    .getByRole("button", { name: "AI 產生課程敘述與完整課前評量" })
    .click();
  await assessmentSeedCard
    .getByText("課前評量已對齊", { exact: true })
    .waitFor();
  await assessmentSeedCard
    .getByText(courseAssessmentSeedResponse.pre.q1.stem, { exact: true })
    .waitFor();
  await assessmentSeedCard
    .getByText("查看課前與預定課後 Q1–Q4 對齊", { exact: true })
    .click();
  for (const expected of [
    "PRE.Q1｜辨識與問題直接相關的概念與證據。",
    "POST.Q4｜整合概念、行動與遷移形成完整書面判斷。",
  ]) {
    await assessmentSeedCard.getByText(expected, { exact: true }).waitFor();
  }
  await assessmentSeedCard
    .getByRole("tab", { name: "發展", exact: true })
    .click();
  await reviseCard({
    trigger: assessmentSeedCard.getByRole("button", {
      name: "微調此段",
      exact: true,
    }),
    dialogName: "修改課程敘述語 發展",
    instruction: "讓可觀察行為更貼近校園氣候資料比較。",
    expectedText: revisedDevelopingNarrative.classroomBehavior,
  });
  await assessmentSeedCard
    .getByText(revisedDevelopingNarrative.classroomBehavior, { exact: true })
    .waitFor();
  await courseWorkspace(page).getByLabel("總節數").fill("3");
  await courseWorkspace(page)
    .getByRole("button", { name: "AI 產生單元節次藍圖" })
    .click();
  await page
    .getByRole("heading", { name: "3 節完整教案與學習單提示詞已準備" })
    .waitFor();
  const blueprintRevisionButtonCount = await courseWorkspace(page)
    .getByRole("button", { name: "AI 修改這張卡" })
    .count();
  if (blueprintRevisionButtonCount < 36) {
    throw new Error(
      `${name} 節次藍圖卡片缺少獨立 AI 修改入口：${blueprintRevisionButtonCount}`,
    );
  }
  await reviseCard({
    trigger: courseWorkspace(page)
      .getByText(unitBlueprint.unitArc, { exact: true })
      .locator("..")
      .getByRole("button", { name: "AI 修改這張卡" }),
    dialogName: "修改單元弧線",
    instruction: "強化每節知識基礎與 NPDL 思考之間的銜接。",
    expectedText: revisedUnitArc,
  });
  await courseWorkspace(page).getByText(revisedUnitArc, { exact: true }).waitFor();
  await courseWorkspace(page)
    .getByRole("button", { name: "確認藍圖並更新 Canvas" })
    .click();
  await page
    .getByText("查看 3 節藍圖摘要", { exact: true })
    .click();
  const lessonSummary = page
    .getByText("查看 3 節藍圖摘要", { exact: true })
    .locator("xpath=ancestor::details[1]");
  if (
    (await lessonSummary
      .getByRole("button", { name: "AI 修改這張卡" })
      .count()) !== 3
  ) {
    throw new Error(`${name} 並非每一節藍圖卡都有獨立 AI 修改入口`);
  }
  await courseWorkspace(page)
    .getByText("用資料支持判斷", { exact: true })
    .waitFor();
  if (
    await courseWorkspace(page)
      .getByRole("button", { name: "預覽", exact: true })
      .count()
  ) {
    throw new Error(`${name} 不應再顯示逐節提示詞按鈕`);
  }

  await courseWorkspace(page)
    .getByRole("button", { name: "預覽完整提示詞" })
    .click();
  const promptDialog = page.getByRole("dialog", {
    name: "Gemini Canvas 提示詞預覽",
  });
  await promptDialog.waitFor();
  const fullPrompt = await promptDialog
    .getByLabel("完整 Canvas 提示詞")
    .inputValue();
  for (const expected of [
    "一次完成資料中列出的全部節次",
    '"lessonNumber": 1',
    '"lessonNumber": 2',
    '"lessonNumber": 3',
    '"title": "用資料支持判斷"',
    "地1c-Ⅴ-1",
    "success-1",
    '"minutes": 50',
    '"heading": "A. 知識基礎"',
    '"heading": "B. NPDL 子向度思考"',
    "學生學習單與教師判讀指引",
    "低科技替代路徑",
  ]) {
    if (!fullPrompt.includes(expected)) {
      throw new Error(`${name} Canvas 提示詞缺少：${expected}`);
    }
  }
  if (
    fullPrompt.includes("notebooklm.google.com") ||
    fullPrompt.includes("gemini-ui-smoke-placeholder")
  ) {
    throw new Error(`${name} Canvas 提示詞含禁止資料`);
  }
  await promptDialog.getByRole("button", { name: "關閉提示詞預覽" }).click();
  const downloadPromise = page.waitForEvent("download");
  await courseWorkspace(page)
    .getByRole("button", { name: "下載 Markdown" })
    .click();
  const download = await downloadPromise;
  if (
    !download.suggestedFilename().includes("3節完整教案與學習單") ||
    !download.suggestedFilename().endsWith(".md")
  ) {
    throw new Error(`${name} Canvas 提示包未下載為 Markdown`);
  }
  await courseWorkspace(page)
    .getByRole("button", { name: "標記外部產生" })
    .click();
  await courseWorkspace(page)
    .getByText("已在外部產生", { exact: true })
    .waitFor();

  if (requestCount !== 11) {
    throw new Error(`${name} AI 請求次數錯誤：${requestCount}`);
  }

  forceEvidenceFailure = true;
  await page
    .getByRole("button", { name: "重新建立並校準評量證據" })
    .click();
  await page
    .getByText("評量證據必須恰好包含課前與課後兩組 Q1–Q4 地圖。", {
      exact: true,
    })
    .waitFor();
  await page
    .getByRole("heading", { name: "3 節完整教案與學習單提示詞已準備" })
    .waitFor();
  if (requestCount !== 13) {
    throw new Error(`${name} 修復失敗重試次數錯誤：${requestCount}`);
  }

  await page.getByRole("button", { name: "開啟共用 AI 設定" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "NPDL Studio AI 設定" });
  await settingsDialog.waitFor();
  await settingsDialog
    .getByRole("textbox", { name: "Gemini API Key", exact: true })
    .waitFor();
  if (
    await settingsDialog
      .getByRole("textbox", { name: "OpenAI API Key", exact: true })
      .count()
  ) {
    throw new Error(`${name} 設定視窗不應顯示非選定供應商的金鑰欄位`);
  }
  if (!verifyHandoff) {
    await settingsDialog.getByRole("button", { name: "清除此金鑰" }).click();
    await page.waitForFunction(
      () => localStorage.getItem("npdl_custom_api_key") === null,
    );
    await settingsDialog
      .getByRole("button", { name: "清除所有 API Key" })
      .click();
    await page.waitForFunction(
      () =>
        localStorage.getItem("npdl_openai_api_key") === null &&
        localStorage.getItem("npdl_xai_api_key") === null,
    );
  }
  await settingsDialog.getByRole("button", { name: "完成設定" }).click();
  await settingsDialog.waitFor({ state: "hidden" });

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!noHorizontalOverflow) throw new Error(`${name} 畫面出現水平溢位`);
  await page.screenshot({
    path: `${outputDir}/${name}.png`,
    fullPage: true,
  });

  if (verifyHandoff) {
    await courseWorkspace(page)
      .getByRole("button", { name: "帶入評量設計" })
      .click();
    const handoffDialog = page.getByRole("dialog", {
      name: "確認帶入評量設計的內容",
    });
    await handoffDialog.waitFor();
    await handoffDialog
      .getByText("課程敘述與前測", { exact: true })
      .waitFor();
    await handoffDialog
      .getByRole("button", { name: "確認帶入，前往評量設計" })
      .click();
    await page.waitForURL(new URL("?workspace=assessment", baseUrl).toString());
    await page
      .getByText("已唯讀帶入課程敘述語與完整課前評量；可直接分析課程與前測，產生課後評量。", {
        exact: true,
      })
      .waitFor();
    const importedValues = await page.locator("input").evaluateAll((inputs) =>
      inputs.map((input) => input.value),
    );
    for (const expected of [
      "地理",
      "全球氣候變遷－極端氣候與校園調適倡議",
    ]) {
      if (!importedValues.includes(expected)) {
        throw new Error(`${name} 評量工作室未帶入欄位：${expected}`);
      }
    }
    const retainedHandoff = await page.evaluate(() =>
      localStorage.getItem("npdl_course_ideation_handoff_v1"),
    );
    if (retainedHandoff !== null) {
      throw new Error(`${name} 評量工作室讀取後未清除一次性交接資料`);
    }
    const assessmentWorkspace = page.locator(
      'section[aria-label="評量設計工作區"]',
    );
    await assessmentWorkspace
      .getByRole("tab", { name: "課前診斷", exact: true })
      .click();
    await assessmentWorkspace
      .getByText(courseAssessmentSeedResponse.pre.q1.stem, { exact: true })
      .waitFor();
    await assessmentWorkspace
      .getByLabel("實際教學與原設計不同之處（選填）")
      .fill("第三節改用紙本資料，學生需要更多因果推論鷹架。");
    await assessmentWorkspace
      .getByRole("button", {
        name: "分析課程與前測，產生課後評量",
        exact: true,
      })
      .last()
      .click();
    await assessmentWorkspace
      .getByRole("tab", { name: "課後遷移", exact: true })
      .click();
    await assessmentWorkspace
      .getByText(postAssessmentResponse.post.q1.stem, { exact: true })
      .waitFor();
    await assessmentWorkspace
      .getByText("完整課程與評量證據包", { exact: true })
      .waitFor();
    await page.screenshot({
      path: `${outputDir}/assessment-post-desktop.png`,
      fullPage: false,
    });
  } else {
    await curriculumCard
      .getByRole("button", { name: "取消選取 地Ia-Ⅴ-2" })
      .click();
    const contentPicker = curriculumCard
      .getByText("其他可選學習內容", { exact: false })
      .locator("xpath=ancestor::details[1]");
    await contentPicker.locator(":scope > summary").click();
    await contentPicker.getByLabel("搜尋學習內容").fill("地Mc-Ⅴ-2");
    await contentPicker
      .getByText("地理｜共同／全類型｜M 類內容", { exact: true })
      .waitFor();
    await contentPicker
      .locator("label")
      .filter({ hasText: "地Mc-Ⅴ-2" })
      .locator('input[type="checkbox"]')
      .check();
    if ((await curriculumCard.getByText("AI 推薦", { exact: true }).count()) === 0) {
      throw new Error(`${name} 教師改選後未保留 AI 原始建議標籤`);
    }
    await page
      .getByText("階段二與後續內容會保留顯示", {
        exact: false,
      })
      .waitFor();
    if (
      !(await courseWorkspace(page)
        .getByRole("heading", { name: "6Cs 子向度推薦" })
        .count())
    ) {
      throw new Error(`${name} 教師調整課綱後不應隱藏階段二與後續內容`);
    }
    await page
      .getByText("請各選滿 2 項後重新校準。", {
        exact: false,
      })
      .waitFor();
  }

  await context.close();
}

async function verifyByokSettings() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto(baseUrl, {
    waitUntil: "networkidle",
  });

  await courseWorkspace(page)
    .getByRole("button", { name: "AI 分析核心關鍵字" })
    .click();
  await courseWorkspace(page)
    .getByText("請先設定 Gemini API Key。", { exact: true })
    .waitFor();
  const dialog = page.getByRole("dialog", { name: "NPDL Studio AI 設定" });
  await dialog.waitFor();
  const modelSelect = dialog.getByLabel("模型");
  if (await modelSelect.locator('option[value^="puter:"]').count()) {
    throw new Error("課程發想模型清單仍含 Puter 免費模型");
  }

  await dialog
    .getByRole("textbox", { name: "Gemini API Key", exact: true })
    .fill("gemini-persisted");
  await page.waitForFunction(
    () => localStorage.getItem("npdl_custom_api_key") === "gemini-persisted",
  );

  await modelSelect.selectOption("gpt-4.1");
  await dialog
    .getByRole("textbox", { name: "OpenAI API Key", exact: true })
    .fill("openai-persisted");
  await page.waitForFunction(
    () => localStorage.getItem("npdl_openai_api_key") === "openai-persisted",
  );

  await modelSelect.selectOption("grok-4.5");
  await dialog
    .getByRole("textbox", { name: "Grok（xAI）API Key", exact: true })
    .fill("xai-persisted");
  await page.waitForFunction(
    () => localStorage.getItem("npdl_xai_api_key") === "xai-persisted",
  );

  await dialog.getByRole("button", { name: "清除所有 API Key" }).click();
  await page.waitForFunction(
    () =>
      localStorage.getItem("npdl_custom_api_key") === null &&
      localStorage.getItem("npdl_openai_api_key") === null &&
      localStorage.getItem("npdl_xai_api_key") === null,
  );
  await context.close();
}

async function verifyMalformedResponseBoundary() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "npdl_selected_model",
      JSON.stringify("gemini-2.5-flash"),
    );
    localStorage.setItem("npdl_custom_api_key", "malformed-test-key");
    localStorage.setItem(
      "npdl_course_ideation_ai_consent_v2",
      JSON.stringify({ version: 3, acceptedAt: Date.now() }),
    );
  });
  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      summary: "格式不完整",
                      themes: [
                        {
                          label: "缺少教育意義",
                          keywords: ["極端氣候"],
                        },
                        keywordAnalysis.themes[1],
                      ],
                      curriculumSignals: keywordAnalysis.curriculumSignals,
                      suggestedKeywords: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });
    },
  );
  await page.goto(baseUrl, {
    waitUntil: "networkidle",
  });
  await courseWorkspace(page)
    .getByRole("button", { name: "AI 分析核心關鍵字" })
    .click();
  await page
    .getByText("AI 未產生完整的課程分析，請重試或切換模型。", {
      exact: true,
    })
    .waitFor();
  if (
    await courseWorkspace(page)
      .getByText("themes[0].interpretation", { exact: false })
      .count()
  ) {
    throw new Error("課程發想 UI 洩漏內部 schema 欄位路徑");
  }
  await context.close();
}

async function verifyCourseExamples() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto(baseUrl, {
    waitUntil: "networkidle",
  });

  const exampleSelect = courseWorkspace(page).getByLabel("載入測試範例");
  if ((await exampleSelect.locator("option").count()) !== 9) {
    throw new Error("課程發想工具未提供 8 組測試範例");
  }
  for (const optionLabel of [
    "地理｜氣候調適倡議",
    "化學｜反應速率探究",
    "生物｜校園生物多樣性",
    "物理｜教室節能診斷",
    "數學｜剩食資料決策",
    "國文｜地方記憶書寫",
    "英文｜永續校園倡議",
    "社會｜手機規範審議",
  ]) {
    if (
      !(await exampleSelect
        .locator("option")
        .allTextContents())
        .includes(optionLabel)
    ) {
      throw new Error(`課程發想工具缺少測試範例：${optionLabel}`);
    }
  }

  await exampleSelect.selectOption("chemistry-reaction-rate");
  if ((await courseWorkspace(page).getByLabel("年級").inputValue()) !== "高二") {
    throw new Error("化學測試範例未載入正確年級");
  }
  if ((await courseWorkspace(page).getByLabel("學科").inputValue()) !== "化學") {
    throw new Error("化學測試範例未載入正確學科");
  }
  if ((await courseWorkspace(page).getByLabel("單元名稱").inputValue()) !== "化學反應速率") {
    throw new Error("化學測試範例未載入正確單元");
  }
  await courseWorkspace(page).getByText("變因控制", { exact: true }).waitFor();

  await exampleSelect.selectOption("mathematics-food-waste-data");
  if ((await courseWorkspace(page).getByLabel("學科").inputValue()) !== "數學") {
    throw new Error("數學測試範例未取代前一組學科");
  }
  if (
    (await courseWorkspace(page).getByLabel("教學主題").inputValue()) !==
    "以校園午餐剩食資料提出改善策略"
  ) {
    throw new Error("數學測試範例未載入正確教學主題");
  }
  await courseWorkspace(page).getByText("抽樣偏差", { exact: true }).waitFor();

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!noHorizontalOverflow) {
    throw new Error("多學科測試範例選單造成手機版水平溢位");
  }
  await page.screenshot({
    path: `${outputDir}/examples-mobile.png`,
    fullPage: true,
  });
  await context.close();
}

async function verifyLessonReferenceImport() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "npdl_selected_model",
      JSON.stringify("gemini-2.5-flash"),
    );
    localStorage.setItem("npdl_custom_api_key", "reference-analysis-key");
    localStorage.setItem(
      "npdl_course_ideation_ai_consent_v2",
      JSON.stringify({ version: 3, acceptedAt: Date.now() }),
    );
  });
  await page.route(
    "https://generativelanguage.googleapis.com/**",
    async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      const requestText = JSON.stringify(body.contents ?? []);
      if (!requestText.includes("ATTACHMENT_RAW_SENTINEL")) {
        throw new Error("附件分析提示缺少抽取文字");
      }
      if (
        requestText.includes("private-lesson-reference.txt") ||
        requestText.includes("reference-analysis-key")
      ) {
        throw new Error("附件分析提示洩漏檔名或 API Key");
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(lessonReferenceAnalysis) }],
              },
            },
          ],
        }),
      });
    },
  );
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const importCard = courseWorkspace(page)
    .getByRole("heading", { name: "匯入既有教案" })
    .locator("xpath=ancestor::section[1]");
  await importCard.locator('input[type="file"]').setInputFiles({
    name: "private-lesson-reference.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(
      "ATTACHMENT_RAW_SENTINEL\n高二化學課程，以碰撞理論、變因控制實驗及實驗紀錄表探究反應速率。",
      "utf8",
    ),
  });
  await importCard.getByText("已擷取", { exact: false }).waitFor();
  await importCard
    .getByRole("button", { name: "AI 分析可沿用內容" })
    .click();
  await importCard
    .getByText("勾選要帶入後續設計的內容", { exact: true })
    .waitFor();
  await importCard
    .locator("label")
    .filter({ hasText: "學科：化學" })
    .locator('input[type="checkbox"]')
    .uncheck();
  await importCard
    .locator("label")
    .filter({ hasText: lessonReferenceAnalysis.assessmentIdeas[0] })
    .locator('input[type="checkbox"]')
    .uncheck();
  await importCard.getByRole("button", { name: "帶入選取內容" }).click();
  await importCard
    .getByText("已將老師確認的教案參考加入後續課綱、評量與節次藍圖提示。", {
      exact: true,
    })
    .waitFor();
  if (
    (await courseWorkspace(page)
      .getByRole("combobox", { name: "年級", exact: true })
      .inputValue()) !== "高二"
  ) {
    throw new Error("附件選取的年級未帶入");
  }
  if (
    (await courseWorkspace(page)
      .getByRole("textbox", { name: "學科", exact: true })
      .inputValue()) !== "地理"
  ) {
    throw new Error("附件未勾選的學科覆蓋了原欄位");
  }
  if (
    (await courseWorkspace(page)
      .getByRole("textbox", { name: "單元名稱", exact: true })
      .inputValue()) !==
    "既有教案分析後的單元"
  ) {
    throw new Error("附件選取的單元名稱未帶入");
  }
  const stored = await page.evaluate(() => {
    const raw =
      localStorage.getItem("npdl_learning_design_project_v1") ?? "{}";
    return {
      raw,
      project: JSON.parse(raw),
    };
  });
  if (
    stored.raw.includes("private-lesson-reference.txt") ||
    stored.raw.includes("ATTACHMENT_RAW_SENTINEL")
  ) {
    throw new Error("專案儲存了附件檔名或完整抽取文字");
  }
  if (
    stored.project.appliedLessonReference?.assessmentIdeas?.length !== 0 ||
    !stored.project.appliedLessonReference?.learningGoals?.includes(
      lessonReferenceAnalysis.learningGoals[0],
    )
  ) {
    throw new Error("附件分析未依老師勾選內容建立結構化參考");
  }
  await page.screenshot({
    path: `${outputDir}/lesson-reference-desktop.png`,
    fullPage: true,
  });
  await context.close();
}

async function verifyUnifiedWorkspaceNavigation() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "npdl_selected_model",
      JSON.stringify("gemini-2.5-flash"),
    );
    localStorage.setItem("npdl_custom_api_key", "navigation-placeholder");
    localStorage.setItem("npdl_draft_dismissed", "1");
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const navigation = page.getByRole("navigation", {
    name: "NPDL Studio 工作區",
  });
  await navigation.getByRole("button", { name: "課程設計" }).waitFor();
  await courseWorkspace(page).getByLabel("單元名稱").fill("切換狀態保留測試");

  await navigation.getByRole("button", { name: "評量設計" }).click();
  await page.waitForURL(new URL("?workspace=assessment", baseUrl).toString());
  await page.getByText("評量設計工作區", { exact: true }).waitFor();
  const assessmentValues = await page
    .locator('section[aria-label="評量設計工作區"] input')
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  if (assessmentValues.includes("切換狀態保留測試")) {
    throw new Error("單純切換工作區不應自動帶入課程資料");
  }
  if (
    await page.evaluate(() =>
      localStorage.getItem("npdl_course_ideation_handoff_v1"),
    )
  ) {
    throw new Error("單純切換工作區不應建立 handoff");
  }

  await navigation.getByRole("button", { name: "課程設計" }).click();
  await page.waitForURL(baseUrl);
  if (
    (await courseWorkspace(page).getByLabel("單元名稱").inputValue()) !==
    "切換狀態保留測試"
  ) {
    throw new Error("工作區切換後課程端未提交狀態遺失");
  }
  await page.goBack();
  await page.waitForURL(new URL("?workspace=assessment", baseUrl).toString());
  await page.goBack();
  await page.waitForURL(baseUrl);
  await context.close();

  const legacyContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
  });
  const legacyPage = await legacyContext.newPage();
  await legacyPage.goto(new URL("course-ideation/", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  await legacyPage.waitForURL(baseUrl);
  await legacyPage
    .getByRole("navigation", { name: "NPDL Studio 工作區" })
    .getByRole("button", { name: "課程設計" })
    .waitFor();
  await legacyContext.close();
}

async function verifyLegacyHandoffUpgrade() {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem(
      "npdl_selected_model",
      JSON.stringify("gemini-2.5-flash"),
    );
    localStorage.setItem("npdl_custom_api_key", "legacy-handoff-placeholder");
    localStorage.setItem(
      "npdl_course_ideation_handoff_v1",
      JSON.stringify({
        version: 1,
        createdAt: Date.now(),
        input: {
          grade: "高一",
          subject: "地理",
          unitName: "舊版課程交接",
          teachingTopic: "校園氣候風險",
          coreKeywords: ["極端氣候", "校園熱島", "數據證據"],
        },
        selectedIndicatorId: "C2-P1",
        evidenceTools: ["資料判讀表", "出口單"],
      }),
    );
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.waitForURL(new URL("?workspace=assessment", baseUrl).toString());
  await page
    .getByText("已帶入課程發想結果，請確認推薦子向度後再生成評量。", {
      exact: true,
    })
    .waitFor();
  if (
    await page.evaluate(() =>
      localStorage.getItem("npdl_course_ideation_handoff_v1"),
    )
  ) {
    throw new Error("舊版 handoff 升級後未清除一次性交接資料");
  }
  const assessmentValues = await page
    .locator('section[aria-label="評量設計工作區"] input')
    .evaluateAll((inputs) => inputs.map((input) => input.value));
  if (!assessmentValues.includes("舊版課程交接－校園氣候風險")) {
    throw new Error("舊版 handoff 未帶入合併後的評量工作區");
  }
  await context.close();
}

try {
  await verifyUnifiedWorkspaceNavigation();
  await verifyLegacyHandoffUpgrade();
  await verifyByokSettings();
  await verifyMalformedResponseBoundary();
  await verifyCourseExamples();
  await verifyLessonReferenceImport();
  await verifyCourseIdeationUi(
    "desktop",
    { width: 1440, height: 1000 },
    true,
  );
  await verifyCourseIdeationUi(
    "mobile",
    { width: 390, height: 844 },
    false,
  );
console.log(
  `合併工作區 UI smoke test 通過：根網址課程預設、分頁／瀏覽器歷史、舊網址轉址、狀態保留、顯式同頁評量交接、8 組多學科範例、教案附件選擇性帶入、完整 108 課綱搜尋多選、四階段單卡 AI 修改與套用、共用 BYOK 模型與金鑰、Puter 遷移、錯誤資訊邊界、完整評量證據、課程敘述與正式前測、單元節次藍圖、Gemini Canvas、課程與前測分析後的正式後測、完整評量證據包，以及桌面與手機版均正常。截圖：${outputDir}`,
);
} finally {
  await browser.close();
}
