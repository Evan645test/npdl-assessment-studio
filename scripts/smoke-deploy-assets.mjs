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
  "assets/chunks/shared.js",
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
  sharedChunk,
  stablePuterChunk,
  oldPuterChunk,
  currentPuterChunk,
] = await Promise.all([
  readFile(path.join(distDir, "index.html"), "utf8"),
  readFile(path.join(distDir, "course-ideation/index.html"), "utf8"),
  readFile(path.join(distDir, "assets/app.js"), "utf8"),
  readFile(path.join(distDir, "assets/course-ideation.js"), "utf8"),
  readFile(path.join(distDir, "assets/chunks/shared.js"), "utf8"),
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
    sharedChunk.includes('import("./index.js")'),
    "共用 AI client 未使用穩定的 Puter chunk 路徑",
  ],
  [stablePuterChunk.includes("export{") && stablePuterChunk.includes("puter"), "穩定 Puter chunk 未輸出 puter"],
  [
    `${app}${sharedChunk}`.includes("npdl-assessment-v7-canonical-stems"),
    "主站 runtime 缺少首輪題幹契約版本",
  ],
  [
    `${app}${sharedChunk}`.includes("先理解目前的問題與重要線索"),
    "主站 runtime 缺少概念理解題幹正規化",
  ],
  [
    `${app}${sharedChunk}`.includes("自動修復未成功"),
    "主站 runtime 缺少真實修復狀態文案",
  ],
  [
    courseIdeationApp.includes("創意孵化與關鍵字提取器"),
    "course-ideation.js 缺少階段一課程發想介面",
  ],
  [
    courseIdeationApp.includes("6Cs 對齊與進程導航員"),
    "course-ideation.js 缺少階段二 6Cs 對齊介面",
  ],
  [
    courseIdeationApp.includes("首次 AI 資料傳送同意"),
    "course-ideation.js 缺少瀏覽器同意機制",
  ],
  [
    courseIdeationApp.includes("帶入評量設計"),
    "course-ideation.js 缺少評量設計交接",
  ],
  [
    courseIdeationApp.includes("課程發想一律使用你自己的 API Key"),
    "course-ideation.js 缺少 BYOK 模式說明",
  ],
  [
    courseIdeationApp.includes("清除所有 API Key"),
    "course-ideation.js 缺少 API Key 清除功能",
  ],
  [
    `${courseIdeationApp}${sharedChunk}`.includes(
      "AI 未產生完整的課程分析，請重試或切換模型",
    ),
    "課程發想 runtime 缺少安全的結構錯誤訊息",
  ],
  [oldPuterChunk.includes('from "./chunks/index.js"'), "舊版 Puter chunk 相容入口失效"],
  [currentPuterChunk.includes('from "./chunks/index.js"'), "目前 Puter chunk 相容入口失效"],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log("部署資源 smoke test 通過：主站與課程發想工具穩定入口、AI 同意、6Cs 對齊、評量交接、首輪題幹契約、Puter chunk、PDF worker、舊版相容檔與自動復原機制均已封裝。");
