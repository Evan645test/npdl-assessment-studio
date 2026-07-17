# NPDL 評量設計工作室

教師可依年級、科目、課程活動與 NPDL 子向度，產生課前診斷、課後遷移及四層進程判讀資料。Q1–Q4 固定形成「概念理解、行動應用、生活遷移」能力階梯。

## 課程發想工具

獨立入口為 `/course-ideation/`，提供兩階段備課鷹架：

1. 輸入年級、學科、單元名稱、教學主題與 3–5 個核心關鍵字，由 AI 整理主題群及後續素養對齊訊號。
2. 從受控 6Cs 子向度目錄推薦 1–2 項、顯示正式四級學習進程，並生成「知識基礎、素養子向度、四要素整合實踐」三層學習成果。

NPDL 學習設計四要素固定為「學習夥伴關係、學習環境、數位利用、教學實踐」，不使用含義不同的 4E 教學循環。完成後可將年級、學科、課程名稱、關鍵字、證據工具與選定子向度一次性帶入評量工作室；交接資料最長保留 24 小時，讀取後即清除。

首次呼叫 AI 前，介面會顯示供應商、模型、用途及完整傳送內容。教師同意後會記錄在目前瀏覽器，後續不逐次詢問，並可隨時撤回；API Key 不包含在傳送內容中。

課程發想工具一律使用教師自備的 Gemini、OpenAI 或 Grok API Key，預設模型為 Gemini 2.5 Flash；API Key 以未加密文字保存在目前瀏覽器，設定視窗可清除目前供應商或全部金鑰。課程發想不提供 Puter 免費模型，但評量工作室原有的 Puter 選項維持不變。

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
- Puter 免費模型：僅評量工作室提供；不需要 API Key，使用者登入 Puter 後使用自己的免費額度。

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
NPDL_PREVIEW_URL=http://127.0.0.1:4180/ npm run smoke:course-ideation
```

目前整批讀取 Google Forms 回應與 AI 自動判讀尚未啟用；已保留穩定欄位名稱供後續版本串接。
