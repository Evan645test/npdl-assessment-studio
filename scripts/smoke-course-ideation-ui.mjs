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
      const output =
        "themes" in schemaProperties
          ? keywordAnalysis
          : "recommendations" in schemaProperties
            ? courseAlignment
            : null;
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
  await page.getByRole("button", { name: "進入 6Cs 對齊與進程導航" }).click();
  await page.getByRole("heading", { name: "6Cs 子向度推薦" }).waitFor();

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

try {
  await verifyByokSettings();
  await verifyMalformedResponseBoundary();
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
    `課程發想 UI smoke test 通過：BYOK 模型隔離、三供應商金鑰保存／清除、錯誤資訊邊界、首次同意、兩階段 AI、6Cs 進程、三層成果、四要素、評量交接、桌面與手機版均正常。截圖：${outputDir}`,
  );
} finally {
  await browser.close();
}
