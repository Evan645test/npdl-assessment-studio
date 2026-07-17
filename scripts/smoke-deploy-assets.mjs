import { access, readFile } from "node:fs/promises";
import path from "node:path";

const distDir = path.resolve("dist");
const requiredFiles = [
  "index.html",
  "assets/app.js",
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

const [html, app, oldPuterChunk, currentPuterChunk] = await Promise.all([
  readFile(path.join(distDir, "index.html"), "utf8"),
  readFile(path.join(distDir, "assets/app.js"), "utf8"),
  readFile(path.join(distDir, "assets/index-B2pYcf0b.js"), "utf8"),
  readFile(path.join(distDir, "assets/index-BpGjAnIq.js"), "utf8"),
]);

const checks = [
  [html.includes("/assets/app.js"), "index.html 未使用穩定的 app.js 入口"],
  [html.includes("/assets/index.css"), "index.html 未使用穩定的 index.css"],
  [html.includes("npdl_asset_recovery_at"), "index.html 缺少資源載入失敗復原機制"],
  [app.includes('import("./chunks/index.js")'), "app.js 未使用穩定的 Puter chunk 路徑"],
  [app.includes("npdl-assessment-v7-canonical-stems"), "app.js 缺少首輪題幹契約版本"],
  [app.includes("先理解目前的問題與重要線索"), "app.js 缺少概念理解題幹正規化"],
  [app.includes("自動修復未成功"), "app.js 缺少真實修復狀態文案"],
  [oldPuterChunk.includes('from "./chunks/index.js"'), "舊版 Puter chunk 相容入口失效"],
  [currentPuterChunk.includes('from "./chunks/index.js"'), "目前 Puter chunk 相容入口失效"],
];

for (const [passed, message] of checks) {
  if (!passed) throw new Error(message);
}

console.log("部署資源 smoke test 通過：穩定入口、首輪題幹契約、修復狀態、Puter chunk、PDF worker、舊版相容檔與自動復原機制均已封裝。");
