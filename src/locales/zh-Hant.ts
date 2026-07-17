export const t = {
  appTitle: "NPDL 評量設計工作室",
  appSubtitle: "專業評量工作台",
  emptyTitle: "建立您的 NPDL 評量活動",
  emptyDesc:
    "依左側步驟 1→3 完成設定，再點「生成診斷與遷移評量」。產出將分三個模組一屏呈現，您可逐段或逐題微調。",
  readyBadge: "已載入指標",
  readyHint: "以下是目前選取指標的四級評量標準；確認左側設定後即可生成評量內容。",
  customReadyHint: "您已輸入自訂指標內容；確認左側設定後即可生成評量內容。",
  generate: "生成診斷與遷移評量",
  generating: "正在生成評量內容…",
  settings: "系統設定",
  settingsSubtitle: "OpenAI、Gemini、Grok 與免費模型",
  closeSettings: "完成設定",
  apiKeyRequired: (provider: string) =>
    `目前模型需要 ${provider} API Key。請填寫金鑰、切換到另一個已有金鑰的供應商，或改用免 API Key 的免費模型。`,
  apiKeyRequiredButton: (provider: string) => `請填寫 ${provider} API Key 或改選免費模型`,
  apiKeyPrivacyNote:
    "自備 API Key 只儲存在此瀏覽器的 localStorage，並直接傳送到所選供應商；免費模式由 Puter 登入與管理每位使用者的額度。",
  questionBank: "個人測驗題庫",
  savedCount: (n: number) => `已收藏 ${n} 題`,
  refineTitle: "微調內容",
  refinePlaceholder: "描述您希望如何修訂這段內容…",
  refineSubmit: "套用微調",
  refineHints: ["改短一點", "更生活化", "加強證據分歧", "移除課程專有名詞", "嵌入更多課程詞彙"],
  copyQuestion: "複製題目 Markdown",
  saveQuestion: "收藏至題庫",
  savedQuestion: "已收藏",
  testConnection: "測試連線",
  testingConnection: "測試中…",
  connectionOk: "連線成功",
  draftRestore: "恢復上次草稿？",
  draftRestoreYes: "恢復",
  draftRestoreNo: "捨棄",
  previewDevice: "學生端寬度預覽",
  contextStrip: "本份產出依據",
  scoringAnchor: "落點計分標準",
  scoringDesc: "三題加總後對應之進程",
  teacherParse: "查看教師解析",
  rubricToggle: "教師進程判定標準（點擊展開）",
  scenarioSticky: "共用情境",
  openSettings: "開啟設定",
  noApiKey: "請填寫 OpenAI、Gemini 或 Grok API Key，或改選免 API Key 的免費模型。",
  stepLabels: ["1 課程", "2 指標", "3 生成"] as const,
  preflight: {
    indicator: "已選子指標",
    activity: "已填年級、科目、活動名稱",
    context: "已填生活內容與工具",
  },
  validationFormatTitle: "產出格式檢查",
  validationFormatOk: "格式檢查通過，可安心閱讀與微調。",
  validationErrors: (
    n: number,
    repairStatus: "not_needed" | "succeeded" | "failed" | null,
  ) =>
    repairStatus === "succeeded"
      ? `自動修復後仍有 ${n} 項品質問題`
      : repairStatus === "failed"
        ? `自動修復未成功，仍有 ${n} 項品質問題`
        : `發現 ${n} 項品質問題`,
  validationWarnings: (n: number) => `另有 ${n} 項建議留意`,
  errors: {
    generic: "發生未知錯誤，請稍後再試。",
    invalidKey: "API 金鑰無效、未填寫，或沒有使用此模型的權限。",
    quota: "API 或免費月額度已用完，或目前速率已達上限。",
    billingQuota: (provider: string) =>
      `${provider} API credits 已用完，或已達每月支出上限。請到該供應商的 API 帳務頁補充額度或調高上限；若不使用付費 API，請改選免費模型。`,
    rateLimit: (provider: string) =>
      `${provider} API 目前請求過於頻繁。請稍候約一分鐘再測試；若持續發生，請檢查該專案的速率與用量上限。`,
    freeAuth: "免費模型需要完成 Puter 登入授權；若已取消，請重新點選生成或測試連線。",
    model: "所選模型目前不可用。",
    emptyResponse: "AI 未回傳內容，請重試。",
  },
} as const;
