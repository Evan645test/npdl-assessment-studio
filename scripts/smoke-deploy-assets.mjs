import { access, readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const requiredFiles = [
  "index.html",
  "course-ideation/index.html",
  "assets/app.js",
  "assets/course-ideation.js",
  "assets/index.css",
  "assets/chunks/index.js",
  "assets/index-Cvj3V8kd.js",
  "assets/index-B2pYcf0b.js",
  "assets/index-BEc0sKzC.js",
  "assets/index-BpGjAnIq.js",
  "assets/index-CzLTat4i.css",
  "assets/pdf.worker.min.mjs",
];

await Promise.all(
  requiredFiles.map((relativePath) => access(path.join(distDir, relativePath))),
);

const [
  html,
  courseIdeationHtml,
  app,
  courseIdeationApp,
  stablePuterChunk,
  oldPuterChunk,
  currentPuterChunk,
] = await Promise.all([
  readFile(path.join(distDir, "index.html"), "utf8"),
  readFile(path.join(distDir, "course-ideation/index.html"), "utf8"),
  readFile(path.join(distDir, "assets/app.js"), "utf8"),
  readFile(path.join(distDir, "assets/course-ideation.js"), "utf8"),
  readFile(path.join(distDir, "assets/chunks/index.js"), "utf8"),
  readFile(path.join(distDir, "assets/index-B2pYcf0b.js"), "utf8"),
  readFile(path.join(distDir, "assets/index-BpGjAnIq.js"), "utf8"),
]);

const checks = [
  [html.includes("/assets/app.js"), "index.html 未使用穩定的 app.js 入口"],
  [html.includes("/assets/index.css"), "index.html 未使用穩定的 index.css"],
  [
    courseIdeationHtml.includes("/assets/course-ideation.js"),
    "course-ideation/index.html 未使用穩定的 course-ideation.js 入口",
  ],
  [
    courseIdeationHtml.includes("/assets/index.css"),
    "course-ideation/index.html 未使用共用的穩定 index.css",
  ],
  [html.includes("npdl_asset_recovery_at"), "index.html 缺少資源載入失敗復原機制"],
  [
    app.includes('import("./chunks/index.js")'),
    "合併 App 未使用穩定的 Puter 相容 chunk 路徑",
  ],
  [stablePuterChunk.includes("export{") && stablePuterChunk.includes("puter"), "穩定 Puter chunk 未輸出 puter"],
  [
    app.includes("npdl-assessment-v7-canonical-stems"),
    "主站 runtime 缺少首輪題幹契約版本",
  ],
  [
    app.includes("先理解目前的問題與重要線索"),
    "主站 runtime 缺少概念理解題幹正規化",
  ],
  [
    app.includes("自動修復未成功"),
    "主站 runtime 缺少真實修復狀態文案",
  ],
  [
    app.includes("創意孵化與關鍵字提取器"),
    "合併 App 缺少階段一課程發想介面",
  ],
  [
    app.includes("6Cs 對齊與進程導航員"),
    "合併 App 缺少階段二 6Cs 對齊介面",
  ],
  [
    app.includes("首次 AI 資料傳送同意"),
    "合併 App 缺少瀏覽器同意機制",
  ],
  [
    app.includes("帶入評量設計"),
    "合併 App 缺少評量設計交接",
  ],
  [
    app.includes("課程設計與評量設計共用同一模型與 API Key"),
    "合併 App 缺少共用 BYOK 模式說明",
  ],
  [
    app.includes("清除所有 API Key"),
    "合併 App 缺少 API Key 清除功能",
  ],
  [
    app.includes(
      "AI 未產生完整的課程分析，請重試或切換模型",
    ),
    "課程發想 runtime 缺少安全的結構錯誤訊息",
  ],
  [
    courseIdeationApp.includes("location.replace"),
    "舊 course-ideation 入口未轉址至合併首頁",
  ],
  [
    app.includes("NPDL Studio") &&
      app.includes("課程設計") &&
      app.includes("評量設計"),
    "合併 App 缺少共同工作區殼層",
  ],
  [oldPuterChunk.includes('from "./chunks/index.js"'), "舊版 Puter chunk 相容入口失效"],
  [currentPuterChunk.includes('from "./chunks/index.js"'), "目前 Puter chunk 相容入口失效"],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log("部署資源 smoke test 通過：合併工作區、舊課程入口轉址、共用 BYOK 設定、AI 同意、6Cs 對齊、同頁評量交接、首輪題幹契約、Puter 相容 chunk、PDF worker、舊版相容檔與自動復原機制均已封裝。");
