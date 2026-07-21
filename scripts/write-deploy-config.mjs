import fs from "node:fs";
import path from "node:path";

const distDir = path.resolve("dist");
const clientId = process.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";

const payload = {
  googleOAuthClientId: clientId,
};

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  path.join(distDir, "deploy-config.json"),
  `${JSON.stringify(payload, null, 2)}\n`,
  "utf8",
);

console.log(
  clientId
    ? "deploy-config.json 已寫入 OAuth Client ID。"
    : "deploy-config.json 已寫入（OAuth Client ID 為空，部署後需設定 VITE_GOOGLE_OAUTH_CLIENT_ID）。",
);
