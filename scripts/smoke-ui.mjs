#!/usr/bin/env node
/**
 * Single-flow UI smoke: seeds a complete LearningDesignProject so
 * CoursePostAssessmentPanel + OutputWorkspace can verify Q4 / Forms / progress.
 * Standalone AssessmentApp (Sidebar 1→2→3) is no longer mounted.
 */
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.NPDL_PREVIEW_URL ?? "http://127.0.0.1:4180/";
const chromePath =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const outputDir = process.env.NPDL_UI_ARTIFACT_DIR ?? "/tmp/npdl-ui-smoke";

function loadSeed() {
  const viteNode = path.join(root, "node_modules", ".bin", "vite-node");
  const raw = execFileSync(
    viteNode,
    [path.join(root, "scripts", "emit-smoke-ui-seed.ts")],
    { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  const jsonStart = raw.indexOf("{");
  if (jsonStart < 0) throw new Error("emit-smoke-ui-seed 未輸出 JSON");
  return JSON.parse(raw.slice(jsonStart));
}

const seed = loadSeed();

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--disable-background-networking"],
});

async function seedLocalStorage(page, options = {}) {
  const { withGoogleClientId = true, dismissDraft = true } = options;
  await page.addInitScript(
    ({ draft, project, withGoogleClientId: withClient, dismissDraft: dismiss }) => {
      localStorage.setItem("npdl_selected_model", JSON.stringify("gpt-4.1"));
      localStorage.setItem("npdl_openai_api_key", "ui-smoke-placeholder");
      if (dismiss) localStorage.setItem("npdl_draft_dismissed", "1");
      localStorage.setItem(
        "npdl_course_ideation_draft_v1",
        JSON.stringify(draft),
      );
      localStorage.setItem(
        "npdl_learning_design_project_v1",
        JSON.stringify(project),
      );
      localStorage.removeItem("npdl_course_ideation_handoff_v1");
      if (withClient) {
        localStorage.setItem(
          "npdl_google_oauth_client_id",
          "123456789-ui-smoke.apps.googleusercontent.com",
        );
      } else {
        localStorage.removeItem("npdl_google_oauth_client_id");
      }
    },
    {
      draft: seed.draft,
      project: seed.project,
      withGoogleClientId,
      dismissDraft,
    },
  );
}

function courseWorkspace(page) {
  return page.getByLabel("課程設計工作區");
}

async function openPostPanel(page) {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  const postTab = courseWorkspace(page).getByRole("tab", {
    name: /課後與匯出/,
  });
  await postTab.waitFor({ state: "visible" });
  if (await postTab.isDisabled()) {
    throw new Error("課後與匯出分頁仍停用；handoffReady 種子可能不完整");
  }
  await postTab.click();
  await courseWorkspace(page).locator("#course-post-assessment").waitFor();
  return courseWorkspace(page).locator("#course-post-assessment");
}

async function verifyNoStandaloneAssessment() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  if (
    (await page.getByRole("button", { name: "評量設計", exact: true }).count()) >
    0
  ) {
    throw new Error("不應再顯示頂部評量設計工作區切換");
  }
  if (
    (await page
      .getByRole("button", { name: "生成診斷與遷移評量", exact: true })
      .count()) > 0
  ) {
    throw new Error("不應再顯示獨立評量生成入口");
  }
  await page.goto(new URL("?workspace=assessment", baseUrl).toString(), {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => !location.search.includes("workspace="));
  await context.close();
}

async function verifyProgressUi(name, viewport, mobile) {
  const context = await browser.newContext({ viewport, locale: "zh-TW" });
  const page = await context.newPage();
  await seedLocalStorage(page);
  await page.route("https://api.openai.com/v1/responses", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await route.abort("connectionrefused").catch(() => undefined);
  });

  const postPanel = await openPostPanel(page);
  await postPanel
    .getByRole("button", { name: "重新產生課後評量", exact: true })
    .click();

  const progressTitle = page.getByText("評量生成中", { exact: true });
  await progressTitle.waitFor({ state: "visible" });
  if (mobile) await page.waitForTimeout(650);
  // 課後改寫會跳過敘述／課前階段，主標題通常為「生成遷移題組」或「連線」
  await page
    .getByRole("heading", { name: /連線|生成遷移題組|格式組裝|品質檢查/ })
    .waitFor({ state: "visible" });
  await page
    .getByText("內容會先通過完整格式與品質檢查，確認完成後才顯示。")
    .waitFor();
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

  await seedLocalStorage(page);
  await page.addInitScript(() => {
    window.google = {
      accounts: {
        oauth2: {
          initTokenClient: (config) => ({
            requestAccessToken: () =>
              config.callback({
                access_token: "ui-smoke-token",
                scope: "https://www.googleapis.com/auth/forms.body",
              }),
          }),
          hasGrantedAllScopes: () => true,
        },
      },
    };
  });
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
          form: {
            responderUri: `https://docs.google.com/forms/d/${formId}/viewform`,
          },
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

  const postPanel = await openPostPanel(page);
  await postPanel.getByRole("tab", { name: "診斷題組", exact: true }).click();
  await postPanel.getByRole("tab", { name: /診斷四|Q4/ }).click();
  await postPanel
    .getByText(/任務是判斷哪一份紀錄較能支持目前的結論/)
    .waitFor();
  if (await postPanel.getByText(/Q4 判斷任務必須以/).count()) {
    throw new Error(`${name} 恢復課後種子後仍顯示 Q4 判斷任務動詞錯誤`);
  }
  await postPanel.getByText("概念理解", { exact: true }).first().waitFor();
  await postPanel.getByText("行動應用", { exact: true }).first().waitFor();
  await postPanel.getByText("生活遷移", { exact: true }).first().waitFor();
  if ((await postPanel.getByText("問題", { exact: true }).count()) !== 3) {
    throw new Error(`${name} Q4 未顯示三個問題區塊`);
  }
  if ((await postPanel.getByText("先看哪裡", { exact: true }).count()) !== 3) {
    throw new Error(`${name} Q4 未顯示三個查看提醒`);
  }
  if (
    (await postPanel.getByText("可以這樣開始", { exact: true }).count()) !== 3
  ) {
    throw new Error(`${name} Q4 未顯示三個句型起點`);
  }
  if (viewport.width <= 390) {
    const widths = await postPanel
      .getByTestId("q4-guide-card")
      .evaluateAll((cards) =>
        cards.map((card) => card.getBoundingClientRect().width),
      );
    if (widths.some((width) => width < 240)) {
      throw new Error(`${name} Q4 引導卡在手機版被操作按鈕擠壓`);
    }
  }
  await postPanel
    .getByText("教師進程判定標準（點擊展開）", { exact: true })
    .click();
  await postPanel.getByText("進程跨界線索", { exact: true }).waitFor();
  await postPanel.getByText("萌芽 → 發展", { exact: true }).waitFor();
  await postPanel.getByText("發展 → 精熟", { exact: true }).waitFor();
  await postPanel.getByText("供教師對照判讀", { exact: true }).waitFor();
  await postPanel.getByText("學生可能回答：", { exact: true }).first().waitFor();
  await postPanel.getByRole("tab", { name: "遷移題組", exact: true }).click();
  await postPanel.getByRole("tab", { name: /遷移四|Q4/ }).click();
  await postPanel
    .getByText("教師進程判定標準（點擊展開）", { exact: true })
    .click();
  await postPanel.getByText("課後補充對照", { exact: true }).waitFor();
  await postPanel.getByText("概念正確：", { exact: true }).waitFor();
  await postPanel.getByText("能調整遷移：", { exact: true }).waitFor();
  const exportButton = postPanel.getByRole("button", {
    name: /登入 Google 並建立(課前／課後|診斷／遷移)問卷/,
  });
  await exportButton.click();
  await postPanel
    .getByText("診斷與遷移問卷均已建立。", { exact: true })
    .waitFor();
  if (formCreateCount !== 2 || batchUpdateCount !== 2 || publishCount !== 2) {
    throw new Error(
      `${name} Google Forms API 流程不完整：create=${formCreateCount}, batch=${batchUpdateCount}, publish=${publishCount}`,
    );
  }
  if ((await postPanel.getByText(/已發布並接受回應/).count()) !== 2) {
    throw new Error(`${name} Google Forms 完成狀態未顯示兩份已發布問卷`);
  }
  if ((await postPanel.getByRole("link", { name: "編輯連結" }).count()) !== 2) {
    throw new Error(`${name} Google Forms 未顯示兩份編輯連結`);
  }
  if ((await postPanel.getByRole("link", { name: "作答連結" }).count()) !== 2) {
    throw new Error(`${name} Google Forms 未顯示兩份作答連結`);
  }
  await page.waitForTimeout(100);
  await page.reload({ waitUntil: "networkidle" });
  const postPanelAfter = await openPostPanel(page);
  await postPanelAfter.getByRole("tab", { name: "診斷題組", exact: true }).click();
  await postPanelAfter.getByRole("tab", { name: /診斷四|Q4/ }).click();
  await postPanelAfter.getByText("概念理解", { exact: true }).first().waitFor();
  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  if (!noHorizontalOverflow) throw new Error(`${name} Q4 畫面出現水平溢位`);
  await page.screenshot({ path: `${outputDir}/${name}-q4.png` });
  await context.close();
}

async function verifyGoogleFormsSetupUi() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "zh-TW",
  });
  const page = await context.newPage();
  await seedLocalStorage(page, { withGoogleClientId: false });

  const postPanel = await openPostPanel(page);
  const managedExportButton = postPanel.getByRole("button", {
    name: /登入 Google 並建立(課前／課後|診斷／遷移)問卷/,
  });
  const managedMode = (await managedExportButton.count()) > 0;
  await postPanel
    .getByRole("button", { name: "Google Forms 設定", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Google Forms 設定" }).waitFor();
  if (managedMode) {
    await page
      .getByText(
        "Google Forms 已由系統管理者完成設定。建立問卷時，使用者只需登入 Google 並確認授權。",
        { exact: true },
      )
      .waitFor();
    if (
      await page
        .getByLabel("Google OAuth Web Client ID", { exact: true })
        .count()
    ) {
      throw new Error("受管理的 Google Forms 模式不應顯示 Client ID 輸入欄位");
    }
  } else {
    await page
      .getByLabel("Google OAuth Web Client ID", { exact: true })
      .waitFor();
    await page.getByText(/已授權的 JavaScript 來源/).waitFor();
  }
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `${outputDir}/desktop-google-forms-settings.png`,
  });
  await context.close();
}

try {
  await verifyNoStandaloneAssessment();
  await verifyProgressUi("desktop", { width: 1440, height: 900 }, false);
  await verifyProgressUi("mobile", { width: 390, height: 844 }, true);
  await verifyGuidedQ4Ui("desktop", { width: 1440, height: 900 });
  await verifyGuidedQ4Ui("mobile", { width: 390, height: 844 });
  await verifyGoogleFormsSetupUi();
  console.log(
    `UI smoke test 通過：單一流程、無獨立評量入口、桌面與手機課後生成進度、Q1–Q4 能力階梯、Google Forms OAuth 設定與建立流程已驗證，截圖位於 ${outputDir}`,
  );
} finally {
  await browser.close();
}
