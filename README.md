# NPDL 評量設計工作室

教師可依年級、科目、課程活動與 NPDL 子向度，產生課前診斷、課後遷移及四層進程判讀資料。Q1–Q4 固定形成「概念理解、行動應用、生活遷移」能力階梯。

## 正式測試網站

[開啟 NPDL 評量設計工作室](https://evan645test.github.io/npdl-assessment-studio/)

`main` 是正式發布分支。每次推送到 `main` 都會先執行測試與 production build，通過後才部署到 GitHub Pages。

## Google Forms

系統可依序建立課前、課後兩份 Google Form。每份表單包含：

- 完整共用情境。
- Q1–Q3 三題必填單選題。
- Q4「概念理解、行動應用、生活遷移」三題必填長答。
- 建立完成後的教師編輯連結與學生作答連結。

建立流程為「建立空表單 → 寫入題目 → 發布並開啟回應」。若中途失敗，重試只會接續未完成階段，不會重建表單或重複寫入題目。

部署管理者需在 GitHub Repository variable 設定：

```text
VITE_GOOGLE_OAUTH_CLIENT_ID
```

Google Cloud 的 OAuth Web Client 必須：

1. 啟用 Google Forms API。
2. 完成 OAuth 同意畫面。
3. 將 `https://evan645test.github.io` 加入「已授權的 JavaScript 來源」。

OAuth Client ID 是公開識別碼，可作為 GitHub Repository variable；不得上傳 Client secret、Google access token 或服務帳戶金鑰。部署完成後，一般使用者只需按下建立問卷、登入 Google 並確認授權。

## AI 模型

- OpenAI、Gemini、Grok：使用者自行提供 API Key，僅保存在目前瀏覽器。
- Puter 免費模型：不需要 API Key，使用者登入 Puter 後使用自己的免費額度。

## 本機開發

需求：Node.js 24。

```bash
npm ci
npm test
npm run build
npm run dev
```

本機若要測試 Google Forms，可複製 `.env.example` 為 `.env.local`，填入 OAuth Client ID；`.env.local` 已被 Git 忽略。

## 品質檢查

```bash
npm test
npm run build
npm run smoke:quality
NPDL_PREVIEW_URL=http://127.0.0.1:4180/ npm run smoke:ui
```

目前整批讀取 Google Forms 回應與 AI 自動判讀尚未啟用；已保留穩定欄位名稱供後續版本串接。
