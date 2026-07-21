# Google Forms OAuth 部署設定

本文件說明如何完成「登入 Google 並建立診斷問卷」所需的 OAuth 設定。

## 架構摘要

| 層級 | 設定方式 | 用途 |
|------|----------|------|
| **建置期** | `VITE_GOOGLE_OAUTH_CLIENT_ID` 環境變數 | 編譯進 JS bundle（GitHub Actions / 本機 `.env.local`） |
| **執行期** | `deploy-config.json` | 靜態部署包 fallback；`npm run build` 結尾由 `scripts/write-deploy-config.mjs` 自動寫入 |
| **教師自備** | 瀏覽器 localStorage | 僅在未托管部署時顯示「設定 Google Forms」 |

正式 GitHub Pages 部署後，教師**不需**自行填 Client ID；按鈕應顯示「登入 Google 並建立診斷問卷」。

## 1. Google Cloud Console

1. 建立或選取專案。
2. **API 和服務 → 資料庫** → 啟用 **Google Forms API**。
3. **OAuth 同意畫面** → 設為 External（測試階段可先用 Testing，加入自己的 Google 帳號為測試使用者）。
4. **憑證 → 建立憑證 → OAuth 用戶端 ID** → 類型選 **網頁應用程式**。
5. **已授權的 JavaScript 來源**（全部加入）：

```text
https://evan645test.github.io
http://127.0.0.1:4180
http://127.0.0.1:4173
http://localhost:4180
http://localhost:4173
```

6. **已授權的重新導向 URI**：網頁版 GIS token client **不需要** redirect URI；可留空。
7. 複製 **用戶端 ID**（結尾為 `.apps.googleusercontent.com`）。  
   **不要**把 Client secret 放進 repo。

## 2. GitHub Pages（正式站）

Repository：`Evan645test/npdl-assessment-studio`

1. **Settings → Secrets and variables → Actions → Variables**
2. 確認已有：

```text
VITE_GOOGLE_OAUTH_CLIENT_ID = <你的 OAuth Web Client ID>
```

3. 推送到 `main` 後，workflow 會：
   - 執行 `npm test`
   - 以該 variable 建置
   - 寫入 `dist/deploy-config.json`
   - 部署至 GitHub Pages

4. 驗證：開啟  
   `https://evan645test.github.io/npdl-assessment-studio/deploy-config.json`  
   應看到非空的 `googleOAuthClientId`（若 variable 已設定）。

## 3. 本機預覽（4180 部署包）

### 方式 A：建置時帶入（建議）

```bash
cd npdl-studio
cp .env.example .env.local
# 編輯 .env.local，填入 VITE_GOOGLE_OAUTH_CLIENT_ID

npm ci
npm test
npm run build
```

再 sync 至 `try` 部署包並預覽：

```bash
TRY="<你的 try 部署包路徑>"
rsync -a dist/ "$TRY/" --exclude .git
cd "$TRY" && PORT=4180 npm run preview
```

### 方式 B：直接改 deploy-config.json（僅本機）

編輯部署包根目錄的 `deploy-config.json`：

```json
{
  "googleOAuthClientId": "<你的 OAuth Web Client ID>"
}
```

**勿 commit 含真實 ID 的 deploy-config.json 到公開 repo。**

## 4. 本機 Vite 開發（5173）

```bash
# .env.local
VITE_GOOGLE_OAUTH_CLIENT_ID=<你的 Client ID>

npm run dev
```

Google Cloud 的 JavaScript 來源需包含 `http://localhost:5173`。

## 5. 常見問題

| 現象 | 原因 | 處理 |
|------|------|------|
| 按鈕顯示「設定 Google Forms」 | Client ID 未注入 | 確認 variable / `.env.local` / `deploy-config.json` |
| 按鈕顯示「Google Forms 尚未完成部署」 | 托管模式但 ID 無效 | 檢查 variable 是否為 Web Client ID |
| 登入後 redirect / origin 錯誤 | JS 來源未加入 | 在 Google Cloud 補上目前網址的 origin |
| `access_denied` / 403 | 同意畫面 Testing 且帳號非測試使用者 | 加入測試使用者或發布同意畫面 |
| GIS 載入逾時 | 瀏覽器阻擋 `accounts.google.com` | 關閉廣告阻擋或換瀏覽器 |

## 6. 安全提醒

- Client ID 可公開；**Client secret、refresh token、服務帳戶 JSON 不可進 repo**。
- 學生資料仍遵守專案規則：不儲存姓名，只用班級代號與座號。
- OAuth token 僅存在教師瀏覽器工作階段，用於建立 Google Form，不由伺服器代管。
