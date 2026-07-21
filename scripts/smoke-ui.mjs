#!/usr/bin/env node
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseUrl = process.env.NPDL_PREVIEW_URL ?? "http://127.0.0.1:4180/";
const assessmentUrl = new URL("?workspace=assessment", baseUrl).toString();
const chromePath =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = process.env.NPDL_UI_ARTIFACT_DIR ?? "/tmp/npdl-ui-smoke";

await mkdir(outputDir, { recursive: true });

async function readAssessmentSnapshot() {
  const snapshot = await readFile(
    new URL("../src/lib/__snapshots__/assessment-document.test.ts.snap", import.meta.url),
    "utf8",
  );
  const match = snapshot.match(/= `\n"([\s\S]*)"\n`;\s*$/);
  if (!match) throw new Error("無法從 Vitest snapshot 取得 Q4 UI 驗收內容");
  return match[1];
}

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-background-networking"],
});

async function verifyProgressUi(name, viewport, mobile) {
  const context = await browser.newContext({ viewport, locale: "zh-TW" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("npdl_selected_model", JSON.stringify("gpt-4.1"));
    localStorage.setItem("npdl_openai_api_key", "ui-smoke-placeholder");
    localStorage.setItem("npdl_draft_dismissed", "1");
  });
  await page.route("https://api.openai.com/v1/responses", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.abort("connectionrefused").catch(() => undefined);
  });

  await page.goto(assessmentUrl, { waitUntil: "networkidle" });
  if (mobile) await page.getByRole("button", { name: "開啟輸入面板" }).click();
  await page.getByRole("button", { name: "生成診斷與遷移評量" }).click();

  const progressTitle = page.getByText("評量生成中", { exact: true });
  await progressTitle.waitFor({ state: "visible" });
  if (mobile) await page.waitForTimeout(650);
  await page.getByRole("heading", { name: "連線" }).waitFor({ state: "visible" });
  await page.getByText("內容會先通過完整格式與品質檢查，確認完成後才顯示。").waitFor();
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!noHorizontalOverflow) throw new Error(`${name} 生成進度畫面出現水平溢位`);
  await page.screenshot({ path: `${outputDir}/${name}-progress.png` });
  await context.close();
}

async function verifyGuidedQ4Ui(name, viewport) {
  const context = await browser.newContext({ viewport, locale: "zh-TW" });
  const page = await context.newPage();
  let formCreateCount = 0;
  let batchUpdateCount = 0;
  let publishCount = 0;
  const generatedMarkdown = (await readAssessmentSnapshot()).replaceAll(
    "判斷哪一份紀錄較能支持目前的結論",
    "哪一份紀錄較能支持目前的結論",
  );
  await page.addInitScript((markdown) => {
    localStorage.setItem("npdl_selected_model", JSON.stringify("gpt-4.1"));
    localStorage.setItem("npdl_openai_api_key", "ui-smoke-placeholder");
    localStorage.removeItem("npdl_draft_dismissed");
    localStorage.setItem(
      "npdl_draft_v2",
      JSON.stringify({
        form: {
          grade: "高二",
          subject: "化學",
          source: "自訂",
          indicatorId: "",
          customIndicator: "能比較多項證據並形成可驗證的判斷",
          activityName: "反應速率 - 硫粒子生成實驗",
          lifeKeywords: "食物保存與腐敗",
          tools: "手機計時、照片對照",
        },
        generatedMarkdown: markdown,
        activeModuleTab: 1,
        savedAt: Date.now(),
      }),
    );
    localStorage.setItem(
      "npdl_google_oauth_client_id",
      "123456789-ui-smoke.apps.googleusercontent.com",
    );
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () => config.callback({
              access_token: "ui-smoke-token",
              scope: "https://www.googleapis.com/auth/forms.body",
            }),
          }),
          hasGrantedAllScopes: () => true,
        },
      },
    };
  }, generatedMarkdown);
  await page.route("https://forms.googleapis.com/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/v1/forms") {
      formCreateCount += 1;
      const formId = formCreateCount === 1 ? "pre-ui-id" : "post-ui-id";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          formId,
          responderUri: `https://docs.google.com/forms/d/${formId}/viewform`,
        }),
      });
      return;
    }
    if (url.pathname.endsWith(":batchUpdate")) {
      batchUpdateCount += 1;
      const formId = url.pathname.includes("pre-ui-id") ? "pre-ui-id" : "post-ui-id";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          form: { responderUri: `https://docs.google.com/forms/d/${formId}/viewform` },
        }),
      });
      return;
    }
    if (url.pathname.endsWith(":setPublishSettings")) {
      publishCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
      return;
    }
    await route.abort();
  });

  await page.goto(assessmentUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "恢復", exact: true }).click();
  await page.getByRole("tab", { name: /Q4/ }).click();
  await page.getByText(/任務是判斷哪一份紀錄較能支持目前的結論/).waitFor();
  if (await page.getByText(/Q4 判斷任務必須以/).count()) {
    throw new Error(`${name} 恢復舊草稿後仍顯示 Q4 判斷任務動詞錯誤`);
  }
  await page.getByText("概念理解", { exact: true }).first().waitFor();
  await page.getByText("行動應用", { exact: true }).first().waitFor();
  await page.getByText("生活遷移", { exact: true }).first().waitFor();
  if (await page.getByText("問題", { exact: true }).count() !== 3) {
    throw new Error(`${name} Q4 未顯示三個問題區塊`);
  }
  if (await page.getByText("先看哪裡", { exact: true }).count() !== 3) {
    throw new Error(`${name} Q4 未顯示三個查看提醒`);
  }
  if (await page.getByText("可以這樣開始", { exact: true }).count() !== 3) {
    throw new Error(`${name} Q4 未顯示三個句型起點`);
  }
  if (viewport.width <= 390) {
    const widths = await page.getByTestId("q4-guide-card").evaluateAll((cards) =>
      cards.map((card) => card.getBoundingClientRect().width),
    );
    if (widths.some((width) => width < 240)) {
      throw new Error(`${name} Q4 引導卡在手機版被操作按鈕擠壓`);
    }
  }
  await page.getByText("教師進程判定標準（點擊展開）", { exact: true }).click();
  await page.getByText("進程跨界線索", { exact: true }).waitFor();
  await page.getByText("萌芽 → 發展", { exact: true }).waitFor();
  await page.getByText("發展 → 精熟", { exact: true }).waitFor();
  await page.getByText("供教師對照，非自動評分", { exact: true }).waitFor();
  await page.getByText("學生可能回答：", { exact: true }).first().waitFor();
  await page.getByRole("tab", { name: "課後遷移", exact: true }).click();
  await page.getByRole("tab", { name: /Q4/ }).click();
  await page.getByText("教師進程判定標準（點擊展開）", { exact: true }).click();
  await page.getByText("課後補充對照", { exact: true }).waitFor();
  await page.getByText("概念正確：", { exact: true }).waitFor();
  await page.getByText("能調整遷移：", { exact: true }).waitFor();
  await page.getByText("不取代 NPDL 四層進程", { exact: true }).waitFor();
  const exportButton = page.getByRole("button", { name: "登入 Google 並建立課前／課後問卷" });
  await exportButton.click();
  await page.getByText("診斷與遷移問卷均已建立。", { exact: true }).waitFor();
  if (formCreateCount !== 2 || batchUpdateCount !== 2 || publishCount !== 2) {
    throw new Error(
      `${name} Google Forms API 流程不完整：create=${formCreateCount}, batch=${batchUpdateCount}, publish=${publishCount}`,
    );
  }
  if (await page.getByText(/已發布並接受回應/).count() !== 2) {
    throw new Error(`${name} Google Forms 完成狀態未顯示兩份已發布問卷`);
  }
  if (await page.getByRole("link", { name: "編輯連結" }).count() !== 2) {
    throw new Error(`${name} Google Forms 未顯示兩份編輯連結`);
  }
  if (await page.getByRole("link", { name: "作答連結" }).count() !== 2) {
    throw new Error(`${name} Google Forms 未顯示兩份作答連結`);
  }
  await page.waitForTimeout(100);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "恢復", exact: true }).click();
  await page.getByRole("tab", { name: /Q4/ }).click();
  await page.getByText("概念理解", { exact: true }).first().waitFor();
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!noHorizontalOverflow) throw new Error(`${name} Q4 畫面出現水平溢位`);
  await page.screenshot({ path: `${outputDir}/${name}-q4.png` });
  await context.close();
}

async function verifyInvalidQ4Ui(name, viewport) {
  const context = await browser.newContext({ viewport, locale: "zh-TW" });
  const page = await context.newPage();
  const generatedMarkdown = (await readAssessmentSnapshot()).replace(
    /> \*\*先看哪裡\*\*：[^\n]+\n/,
    "",
  );
  await page.addInitScript((markdown) => {
    localStorage.setItem("npdl_selected_model", JSON.stringify("gpt-4.1"));
    localStorage.setItem("npdl_openai_api_key", "ui-smoke-placeholder");
    localStorage.removeItem("npdl_draft_dismissed");
    localStorage.setItem(
      "npdl_draft_v2",
      JSON.stringify({
        form: {
          grade: "高二",
          subject: "化學",
          source: "自訂",
          indicatorId: "",
          customIndicator: "能比較多項證據並形成可驗證的判斷",
          activityName: "反應速率 - 硫粒子生成實驗",
          lifeKeywords: "食物保存與腐敗",
          tools: "手機計時、照片對照",
        },
        generatedMarkdown: markdown,
        activeModuleTab: 1,
        savedAt: Date.now(),
      }),
    );
  }, generatedMarkdown);

  await page.goto(assessmentUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "恢復", exact: true }).click();
  await page.getByRole("tab", { name: /Q4/ }).click();
  await page.getByText("Q4 未通過品質檢查，請重新生成評量", { exact: true }).waitFor();
  await page.getByText("Google 問卷匯出已停用。", { exact: false }).waitFor();
  const exportButton = page.getByRole("button", { name: /設定 Google Forms|登入 Google 並建立課前／課後問卷|重試未完成問卷|兩份問卷已建立/ });
  if (!(await exportButton.isDisabled())) throw new Error(`${name} 無效 Q4 未停用 Google 問卷匯出`);
  if (await page.getByText(/\*\*①/).count()) throw new Error(`${name} 無效 Q4 洩漏原始 Markdown`);
  if (viewport.width <= 390) {
    const invalidWidth = await page.getByTestId("q4-invalid-card").evaluate(
      (card) => card.getBoundingClientRect().width,
    );
    if (invalidWidth < 240) throw new Error(`${name} Q4 失敗提示在手機版被操作按鈕擠壓`);
  }
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!noHorizontalOverflow) throw new Error(`${name} Q4 失敗畫面出現水平溢位`);
  await page.screenshot({ path: `${outputDir}/${name}-q4-invalid.png` });
  await context.close();
}

async function verifyGoogleFormsSetupUi() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "zh-TW" });
  const page = await context.newPage();
  const generatedMarkdown = await readAssessmentSnapshot();
  await page.addInitScript((markdown) => {
    localStorage.setItem("npdl_selected_model", JSON.stringify("gpt-4.1"));
    localStorage.setItem("npdl_openai_api_key", "ui-smoke-placeholder");
    localStorage.removeItem("npdl_draft_dismissed");
    localStorage.removeItem("npdl_google_oauth_client_id");
    localStorage.setItem(
      "npdl_draft_v2",
      JSON.stringify({
        form: {
          grade: "高二",
          subject: "化學",
          source: "自訂",
          indicatorId: "",
          customIndicator: "能比較多項證據並形成可驗證的判斷",
          activityName: "反應速率 - 硫粒子生成實驗",
          lifeKeywords: "食物保存與腐敗",
          tools: "手機計時、照片對照",
        },
        generatedMarkdown: markdown,
        activeModuleTab: 2,
        savedAt: Date.now(),
      }),
    );
  }, generatedMarkdown);

  await page.goto(assessmentUrl, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "恢復", exact: true }).click();
  const managedExportButton = page.getByRole("button", {
    name: "登入 Google 並建立課前／課後問卷",
    exact: true,
  });
  const managedMode = (await managedExportButton.count()) > 0;
  await page
    .getByRole("button", { name: "Google Forms 設定", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Google Forms 設定" }).waitFor();
  if (managedMode) {
    await page.getByText(
      "Google Forms 已由系統管理者完成設定。建立問卷時，使用者只需登入 Google 並確認授權。",
      { exact: true },
    ).waitFor();
    if (await page.getByLabel("Google OAuth Web Client ID", { exact: true }).count()) {
      throw new Error("受管理的 Google Forms 模式不應顯示 Client ID 輸入欄位");
    }
  } else {
    await page.getByLabel("Google OAuth Web Client ID", { exact: true }).waitFor();
    await page.getByText(/已授權的 JavaScript 來源/).waitFor();
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outputDir}/desktop-google-forms-settings.png` });
  await context.close();
}

try {
  await verifyProgressUi("desktop", { width: 1440, height: 900 }, false);
  await verifyProgressUi("mobile", { width: 390, height: 844 }, true);
  await verifyGuidedQ4Ui("desktop", { width: 1440, height: 900 });
  await verifyGuidedQ4Ui("mobile", { width: 390, height: 844 });
  await verifyInvalidQ4Ui("desktop", { width: 1440, height: 900 });
  await verifyInvalidQ4Ui("mobile", { width: 390, height: 844 });
  await verifyGoogleFormsSetupUi();
  console.log(`UI smoke test 通過：桌面與手機生成進度、Q1–Q4 能力階梯、Google Forms OAuth 設定、建立／填題／發布流程及失敗隱藏狀態已驗證，截圖位於 ${outputDir}`);
} finally {
  await browser.close();
}
