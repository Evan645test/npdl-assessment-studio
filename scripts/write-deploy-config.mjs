import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const distDir = path.resolve("dist");
const clientId = process.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

function resolveBuildId() {
  const fromEnv = process.env.GITHUB_SHA?.trim();
  if (fromEnv) return fromEnv.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return Date.now().toString(36);
  }
}

const buildId = resolveBuildId();

const payload = {
  buildId,
  googleOAuthClientId: clientId,
};

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  path.join(distDir, "deploy-config.json"),
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
);

const stampTargets = [
  "index.html",
  "course-ideation/index.html",
];

const assetPattern =
  /((?:href|src)="[^"]*\/assets\/(?:app|course-ideation|index|chunks\/(?:shared|index))\.(?:js|css))(")/g;

for (const relativePath of stampTargets) {
  const filePath = path.join(distDir, relativePath);
  if (!fs.existsSync(filePath)) continue;
  const html = fs.readFileSync(filePath, "utf8");
  const stamped = html.replace(assetPattern, (_, prefix, suffix) => {
    if (prefix.includes("?v=")) return `${prefix}${suffix}`;
    return `${prefix}?v=${buildId}${suffix}`;
  });
  fs.writeFileSync(filePath, stamped, "utf8");
}

console.log(
  clientId
    ? `deploy-config.json 已寫入（buildId=${buildId}，含 OAuth Client ID）。`
    : `deploy-config.json 已寫入（buildId=${buildId}；OAuth Client ID 為空，部署後需設定 VITE_GOOGLE_OAUTH_CLIENT_ID）。`,
);
