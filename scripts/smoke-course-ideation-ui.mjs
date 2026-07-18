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
    performanceIds: ["geography-v-performance-inquiry-1"],
    contentIds: ["geography-v-content-climate-5"],
    rationale: "課程聚焦氣候資料分析與調適方案，對應地理探究表現與氣候內容。",
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

async function verifyCourseIdeationUi(name, viewport, verifyHandoff) {
  const context = await browser.newContext({ viewport, locale: "zh-TW" });
  const page = await context.newPage();
  let requestCount = 0;
  let geminiHeaderVerified = false;
  let evidenceResponseCount = 0;
  let forceEvidenceFailure = false;

  await page.addInitScript(() => {
    if (window.location.pathname.includes("/course-ideation/")) {
      localStorage.clear();
      localStorage.setItem(
        "npdl_selected_model",
        JSON.stringify("puter:gemini-3.1-flash-lite"),
      );
      localStorage.setItem("npdl_custom_api_key", "gemini-ui-smoke-placeholder");
      localStorage.setItem("npdl_openai_api_key", "openai-ui-smoke-placeholder");
      localStorage.setItem("npdl_xai_api_key", "xai-ui-smoke-placeholder");
      localStorage.setItem("npdl_draft_dismissed", "1");
    }
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
      let output = null;
      if ("themes" in schemaProperties) {
        output = keywordAnalysis;
      } else if ("recommendations" in schemaProperties) {
        output = courseAlignment;
      } else if ("performanceTask" in schemaProperties) {
        evidenceResponseCount += 1;
        output =
          forceEvidenceFailure || evidenceResponseCount === 1
            ? { ...evidencePlan, questionMaps: [] }
            : evidencePlan;
      } else if ("unitArc" in schemaProperties) {
        output = JSON.stringify(unitBlueprint);
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

  await page.goto(new URL("course-ideation/", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  await page.getByRole("heading", { name: "NPDL 課程發想工具" }).waitFor();
  const migratedModels = await page.evaluate(() => ({
    course: localStorage.getItem("npdl_course_ideation_model_v2"),
    shared: localStorage.getItem("npdl_selected_model"),
  }));
  if (migratedModels.course !== JSON.stringify("gemini-2.5-flash")) {
    throw new Error(`${name} 舊 Puter 設定未遷移至課程工具預設模型`);
  }
  if (
    migratedModels.shared !== JSON.stringify("puter:gemini-3.1-flash-lite")
  ) {
    throw new Error(`${name} 課程工具不應改寫 main 的共用模型設定`);
  }
  await page.getByRole("button", { name: "AI 分析核心關鍵字" }).click();

  const consent = page.getByRole("dialog", { name: "首次 AI 資料傳送同意" });
  await consent.waitFor();
  await consent.getByText("Gemini", { exact: true }).waitFor();
  await consent.getByText("Gemini 2.5 Flash", { exact: false }).waitFor();
  await consent.getByText("核心關鍵字分析", { exact: true }).waitFor();
  await consent.getByText("查看本次完整傳送內容", { exact: true }).click();
  await consent.getByText("極端氣候與校園調適倡議", { exact: false }).waitFor();
  await consent.getByRole("button", { name: "同意並繼續" }).click();

  await page.getByText(keywordAnalysis.summary, { exact: true }).waitFor();
  await page.getByRole("heading", { name: "108 課綱校準" }).waitFor();
  await page.getByRole("button", { name: "進行 108 課綱與 6Cs 校準" }).click();
  await page.getByRole("heading", { name: "6Cs 子向度推薦" }).waitFor();
  await page.getByText("地 1c-Ⅴ-1", { exact: true }).first().waitFor();
  await page.getByText("地 Ba-Ⅴ-5", { exact: true }).first().waitFor();
  await page
    .getByText("能引用資料說明至少兩項氣候風險。", { exact: true })
    .waitFor();
  if (name === "desktop") {
    await page
      .getByRole("heading", { name: "108 課綱校準" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${outputDir}/curriculum-desktop.png`,
      fullPage: false,
    });
  }

  if (requestCount !== 2) {
    throw new Error(`${name} AI 請求次數錯誤：${requestCount}`);
  }
  if (!geminiHeaderVerified) {
    throw new Error(`${name} 未驗證 Gemini API Key header`);
  }
  if (await page.getByRole("dialog", { name: "首次 AI 資料傳送同意" }).count()) {
    throw new Error(`${name} 第二次 AI 呼叫不應再次要求瀏覽器同意`);
  }
  if (await page.getByText("註：關鍵字｜", { exact: false }).count() !== 2) {
    throw new Error(`${name} 未在兩個推薦項目顯示關鍵字註記`);
  }

  await page.getByText("查看四個學生版學習進程", { exact: true }).click();
  for (const progression of ["證據有限", "萌芽", "發展", "精熟"]) {
    await page.getByText(progression, { exact: true }).waitFor();
  }
  for (const outcome of ["01 知識基礎", "02 素養子向度", "03 四要素整合實踐"]) {
    await page.getByText(outcome, { exact: true }).waitFor();
  }
  for (const element of ["學習夥伴關係", "學習環境", "數位利用", "教學實踐"]) {
    await page.getByRole("heading", { name: element, exact: true }).waitFor();
  }

  await page
    .getByRole("button", { name: "確認並鎖定學習終點" })
    .click();
  await page.getByText("教師已確認", { exact: true }).waitFor();
  await page.getByRole("button", { name: "AI 建立完整評量證據" }).click();
  await page
    .getByRole("heading", { name: "真實總結任務" })
    .first()
    .waitFor();
  await page.getByText("課前 Q1–Q4", { exact: true }).first().waitFor();
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
    .getByRole("button", { name: "確認證據，前往節次藍圖" })
    .click();
  await page.getByLabel("總節數").fill("3");
  await page.getByRole("button", { name: "AI 產生單元節次藍圖" }).click();
  await page
    .getByRole("heading", { name: "3 節完整教案與學習單提示詞已準備" })
    .waitFor();
  await page
    .getByText("查看 3 節藍圖摘要", { exact: true })
    .click();
  await page.getByText("用資料支持判斷", { exact: true }).waitFor();
  if (
    await page.getByRole("button", { name: "預覽", exact: true }).count()
  ) {
    throw new Error(`${name} 不應再顯示逐節提示詞按鈕`);
  }

  await page.getByRole("button", { name: "預覽完整提示詞" }).click();
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
    "地 1c-Ⅴ-1",
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
  await page.getByRole("button", { name: "下載 Markdown" }).click();
  const download = await downloadPromise;
  if (
    !download.suggestedFilename().includes("3節完整教案與學習單") ||
    !download.suggestedFilename().endsWith(".md")
  ) {
    throw new Error(`${name} Canvas 提示包未下載為 Markdown`);
  }
  await page.getByRole("button", { name: "標記外部產生" }).click();
  await page.getByText("已在外部產生", { exact: true }).waitFor();

  if (requestCount !== 5) {
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
  if (requestCount !== 7) {
    throw new Error(`${name} 修復失敗重試次數錯誤：${requestCount}`);
  }

  await page.getByRole("button", { name: "開啟 AI 設定" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "課程發想 AI 設定" });
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
  await settingsDialog.getByRole("button", { name: "清除此金鑰" }).click();
  await page.waitForFunction(
    () => localStorage.getItem("npdl_custom_api_key") === null,
  );
  await settingsDialog.getByRole("button", { name: "清除所有 API Key" }).click();
  await page.waitForFunction(
    () =>
      localStorage.getItem("npdl_openai_api_key") === null &&
      localStorage.getItem("npdl_xai_api_key") === null,
  );
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
    await page.getByRole("button", { name: "帶入評量設計" }).click();
    await page.waitForURL(baseUrl);
    await page
      .getByText("已帶入課程發想結果，請確認推薦子向度後再生成評量。", {
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
  } else {
    const selectedCurriculum = page.locator(
      'input[type="checkbox"]:checked:enabled',
    );
    if ((await selectedCurriculum.count()) < 2) {
      throw new Error(`${name} 未顯示 AI 自動採用的課綱項目`);
    }
    await selectedCurriculum.last().uncheck();
    await page
      .getByText("教師已調整課綱選擇。舊的 6Cs 與三層成果已清除，請重新校準。", {
        exact: true,
      })
      .waitFor();
    if (await page.getByRole("heading", { name: "6Cs 子向度推薦" }).count()) {
      throw new Error(`${name} 教師調整課綱後未清除舊 6Cs 結果`);
    }
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
    if (window.location.pathname.includes("/course-ideation/")) {
      localStorage.clear();
    }
  });
  await page.goto(new URL("course-ideation/", baseUrl).toString(), {
    waitUntil: "networkidle",
  });

  await page.getByRole("button", { name: "AI 分析核心關鍵字" }).click();
  await page.getByText("請先設定 Gemini API Key。", { exact: true }).waitFor();
  const dialog = page.getByRole("dialog", { name: "課程發想 AI 設定" });
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
    if (window.location.pathname.includes("/course-ideation/")) {
      localStorage.clear();
      localStorage.setItem(
        "npdl_course_ideation_model_v2",
        JSON.stringify("gemini-2.5-flash"),
      );
      localStorage.setItem("npdl_custom_api_key", "malformed-test-key");
      localStorage.setItem(
        "npdl_course_ideation_ai_consent_v2",
        JSON.stringify({ version: 2, acceptedAt: Date.now() }),
      );
    }
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
  await page.goto(new URL("course-ideation/", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "AI 分析核心關鍵字" }).click();
  await page
    .getByText("AI 未產生完整的課程分析，請重試或切換模型。", {
      exact: true,
    })
    .waitFor();
  if (await page.getByText("themes[0].interpretation", { exact: false }).count()) {
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
    if (window.location.pathname.includes("/course-ideation/")) {
      localStorage.clear();
    }
  });
  await page.goto(new URL("course-ideation/", baseUrl).toString(), {
    waitUntil: "networkidle",
  });

  const exampleSelect = page.getByLabel("載入測試範例");
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
  if ((await page.getByLabel("年級").inputValue()) !== "高二") {
    throw new Error("化學測試範例未載入正確年級");
  }
  if ((await page.getByLabel("學科").inputValue()) !== "化學") {
    throw new Error("化學測試範例未載入正確學科");
  }
  if ((await page.getByLabel("單元名稱").inputValue()) !== "化學反應速率") {
    throw new Error("化學測試範例未載入正確單元");
  }
  await page.getByText("變因控制", { exact: true }).waitFor();

  await exampleSelect.selectOption("mathematics-food-waste-data");
  if ((await page.getByLabel("學科").inputValue()) !== "數學") {
    throw new Error("數學測試範例未取代前一組學科");
  }
  if (
    (await page.getByLabel("教學主題").inputValue()) !==
    "以校園午餐剩食資料提出改善策略"
  ) {
    throw new Error("數學測試範例未載入正確教學主題");
  }
  await page.getByText("抽樣偏差", { exact: true }).waitFor();

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

try {
  await verifyByokSettings();
  await verifyMalformedResponseBoundary();
  await verifyCourseExamples();
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
  `課程發想 UI smoke test 通過：8 組多學科測試範例、108 課綱校準與教師調整、BYOK 模型隔離、三供應商金鑰保存／清除、錯誤資訊邊界、首次同意、四階段 AI、單次結構修復與失敗保留、6Cs 進程、學習終點、完整評量證據、單元節次藍圖、Gemini Canvas 預覽／Markdown 下載、評量交接、桌面與手機版均正常。截圖：${outputDir}`,
);
} finally {
  await browser.close();
}
