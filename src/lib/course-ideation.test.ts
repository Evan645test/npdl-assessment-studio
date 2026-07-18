import { describe, expect, it } from "vitest";
import {
  buildCourseAlignmentPrompt,
  buildCourseIdeationHandoff,
  buildKeywordAnalysisPrompt,
  CourseIdeationResponseError,
  courseIdeationHandoffToForm,
  isValidCourseIdeationHandoff,
  normalizeCoreKeywords,
  parseCourseAlignment,
  parseKeywordAnalysis,
  validateCourseIdeationInput,
} from "@/lib/course-ideation";
import { getCurriculumCandidates } from "@/lib/curriculum";
import type {
  CourseAlignmentResult,
  CourseIdeationInput,
  KeywordAnalysisResult,
} from "@/types/course-ideation";

const INPUT: CourseIdeationInput = {
  grade: "高一",
  subject: "地理",
  unitName: "全球氣候變遷",
  teachingTopic: "極端氣候與校園調適倡議",
  coreKeywords: ["極端氣候", "校園熱島", "數據證據", "小組倡議"],
};

const ANALYSIS: KeywordAnalysisResult = {
  summary: "學生將分析校園中的氣候風險，並提出可被檢驗的調適倡議。",
  themes: [
    {
      label: "氣候風險",
      keywords: ["極端氣候", "校園熱島"],
      interpretation: "辨識氣候現象與校園生活的關聯。",
    },
    {
      label: "證據行動",
      keywords: ["數據證據", "小組倡議"],
      interpretation: "以資料支持小組提出的改善主張。",
    },
  ],
  curriculumSignals: ["比較不同地點的溫度資料", "用證據支持調適方案"],
  suggestedKeywords: ["利害關係人"],
  model: "gpt-4.1",
};

const CURRICULUM_CANDIDATES = getCurriculumCandidates(INPUT, ANALYSIS);

const ALIGNMENT: CourseAlignmentResult = {
  curriculumSelection: {
    performanceIds: ["geography-v-performance-inquiry-1"],
    contentIds: ["geography-v-content-climate-5"],
    rationale: "課程聚焦氣候資料分析與調適方案，對應地理探究表現與氣候內容。",
    mode: "ai_auto",
  },
  backwardDesign: {
    transferGoals: ["能在新的校園氣候情境中，以資料判讀風險並提出調適方案。"],
    enduringUnderstandings: [
      "氣候風險需要結合自然現象、在地脆弱度與資料證據來判斷。",
    ],
    essentialQuestions: ["我們如何用證據判斷校園最需要優先處理的氣候風險？"],
  },
  recommendations: [
    {
      indicatorId: "C2-P1",
      reason: "學生必須建立、組織並比較校園氣候資料。",
      matchedKeywords: ["極端氣候", "數據證據"],
    },
    {
      indicatorId: "C6-P1",
      reason: "學生需形成清楚主張並向校園利害關係人溝通。",
      matchedKeywords: ["小組倡議"],
    },
  ],
  learningOutcomes: {
    knowledgeFoundation: {
      statement: "能說明極端氣候與校園熱島的成因及影響。",
      evidence: "概念圖與資料摘要。",
      successCriteria: [
        "能引用資料說明至少兩項氣候風險。",
        "能區分氣候現象、影響與調適措施。",
      ],
    },
    competencySubdimension: {
      statement: "能組織多項資料並形成有證據的判斷。",
      evidence: "資料比較表與推論紀錄。",
    },
    fourElementsPractice: {
      statement: "能與夥伴運用數位資料提出並修正校園調適倡議。",
      evidence: "倡議簡報、同儕回饋與修訂紀錄。",
    },
  },
  fourElements: [
    {
      name: "學習夥伴關係",
      designMove: "邀請校內行政人員回饋方案。",
      studentEvidence: "訪談紀錄與回饋修訂表。",
    },
    {
      name: "學習環境",
      designMove: "讓學生進行校園實地測量與討論。",
      studentEvidence: "測量地圖與小組討論紀錄。",
    },
    {
      name: "數位利用",
      designMove: "用共享地圖整理溫度與遮蔭資料。",
      studentEvidence: "附來源的數位資料圖層。",
    },
    {
      name: "教學實踐",
      designMove: "以提問與形成性回饋逐步修正主張。",
      studentEvidence: "初稿、回饋與定稿差異。",
    },
  ],
  evidenceTools: ["校園測量表", "倡議簡報", "同儕回饋單"],
  model: "gpt-4.1",
};

describe("course ideation contracts", () => {
  it("normalizes duplicate and blank keywords without exceeding five", () => {
    expect(
      normalizeCoreKeywords([
        " 極端氣候 ",
        "",
        "極端氣候",
        "校園熱島",
        "數據證據",
        "小組倡議",
        "利害關係人",
        "第六個詞",
      ]),
    ).toEqual(["極端氣候", "校園熱島", "數據證據", "小組倡議", "利害關係人"]);
  });

  it("requires complete course fields and three to five unique keywords", () => {
    expect(validateCourseIdeationInput(INPUT)).toEqual([]);
    expect(
      validateCourseIdeationInput({
        ...INPUT,
        unitName: "",
        coreKeywords: ["重複", "重複", "只有兩個"],
      }),
    ).toEqual(
      expect.arrayContaining(["單元名稱至少需要 2 個字。", "核心關鍵字必須為 3–5 個。"]),
    );
  });

  it("builds prompts that preserve the teacher input and official four elements", () => {
    const keywordPrompt = buildKeywordAnalysisPrompt(INPUT);
    const alignmentPrompt = buildCourseAlignmentPrompt(
      INPUT,
      ANALYSIS,
      CURRICULUM_CANDIDATES,
    );

    expect(keywordPrompt.dynamic).toContain("極端氣候、校園熱島、數據證據、小組倡議");
    expect(alignmentPrompt.stable).toContain("學習夥伴關係");
    expect(alignmentPrompt.stable).toContain("學習環境");
    expect(alignmentPrompt.stable).toContain("數位利用");
    expect(alignmentPrompt.stable).toContain("教學實踐");
    expect(alignmentPrompt.stable).toContain("不得稱為 4E");
    expect(keywordPrompt.stable).toContain("成功表現");
    expect(keywordPrompt.stable).toContain("一班約 30–40 位學生");
    expect(keywordPrompt.stable).toContain("不得預設學生一人一機");
    expect(keywordPrompt.dynamic).toContain("新情境的應用或遷移");
    expect(keywordPrompt.dynamic).toContain("校內、小組、公開資料、模擬或低科技版本");
    expect(alignmentPrompt.stable).toContain("禁止只因主題名稱或關鍵字相似");
    expect(alignmentPrompt.stable).toContain("低科技替代路徑");
    expect(alignmentPrompt.dynamic).toContain(
      "課程任務 → 學生具體認知或實作行為 → 可觀察證據",
    );
    expect(alignmentPrompt.dynamic).toContain("四個互不相干的裝飾性活動");
    expect(alignmentPrompt.dynamic).toContain("不可只列工具名稱");
    expect(alignmentPrompt.dynamic).toContain("紙本或離線替代路徑");
    expect(alignmentPrompt.dynamic).toContain('"id": "C2-P1"');
    expect(alignmentPrompt.dynamic).toContain(
      '"id": "geography-v-content-climate-5"',
    );

    const chemistryPrompt = buildKeywordAnalysisPrompt({
      ...INPUT,
      subject: "化學",
    });
    expect(chemistryPrompt.dynamic).toContain("燒杯、試管");
    expect(chemistryPrompt.dynamic).toContain("廢液分類與回收方式");
    expect(chemistryPrompt.dynamic).toContain("仍須教師確認數量與可用狀態");
    expect(chemistryPrompt.dynamic).not.toContain("複式光學顯微鏡");
  });

  it("parses fenced keyword JSON and rejects an incomplete analysis", () => {
    const raw = `\`\`\`json
${JSON.stringify({
  summary: ANALYSIS.summary,
  themes: ANALYSIS.themes,
  curriculumSignals: ANALYSIS.curriculumSignals,
  suggestedKeywords: ANALYSIS.suggestedKeywords,
})}
\`\`\``;

    expect(parseKeywordAnalysis(raw, "gpt-4.1")).toEqual(ANALYSIS);
    expect(() =>
      parseKeywordAnalysis(
        JSON.stringify({
          summary: "不完整",
          themes: ANALYSIS.themes.slice(0, 1),
          curriculumSignals: [],
          suggestedKeywords: [],
        }),
        "gpt-4.1",
      ),
    ).toThrow("至少需要 2 個關鍵字主題群");
  });

  it("classifies malformed provider output without weakening internal diagnostics", () => {
    try {
      parseKeywordAnalysis(
        JSON.stringify({
          summary: "不完整",
          themes: [
            {
              label: "缺少解釋",
              keywords: ["極端氣候"],
            },
            ANALYSIS.themes[1],
          ],
          curriculumSignals: ANALYSIS.curriculumSignals,
          suggestedKeywords: [],
        }),
        "gemini-2.5-flash",
      );
      throw new Error("預期解析失敗");
    } catch (error) {
      expect(error).toBeInstanceOf(CourseIdeationResponseError);
      expect((error as Error).message).toContain("themes[0].interpretation");
    }
  });

  it("recovers a missing theme label without weakening content validation", () => {
    const firstTheme = ANALYSIS.themes[0];
    const raw = JSON.stringify({
      summary: ANALYSIS.summary,
      themes: [
        {
          keywords: firstTheme.keywords,
          interpretation: firstTheme.interpretation,
        },
        {
          title: "證據與行動",
          keywords: ANALYSIS.themes[1].keywords,
          interpretation: ANALYSIS.themes[1].interpretation,
        },
      ],
      curriculumSignals: ANALYSIS.curriculumSignals,
      suggestedKeywords: ANALYSIS.suggestedKeywords,
    });

    const parsed = parseKeywordAnalysis(raw, "gpt-4.1");
    expect(parsed.themes[0].label).toBe(firstTheme.keywords[0]);
    expect(parsed.themes[1].label).toBe("證據與行動");

    expect(() =>
      parseKeywordAnalysis(
        JSON.stringify({
          ...JSON.parse(raw),
          themes: [
            {
              interpretation: firstTheme.interpretation,
            },
            ANALYSIS.themes[1],
          ],
        }),
        "gpt-4.1",
      ),
    ).toThrow("themes[0].keywords");
  });

  it("normalizes common theme aliases and preserves teacher keywords as fallback", () => {
    const raw = JSON.stringify({
      overview: ANALYSIS.summary,
      themeGroups: [
        {
          name: "氣候現象",
          relatedKeywords: "極端氣候、校園熱島",
          description: "辨識氣候現象與校園生活的關聯。",
        },
        {
          theme: "證據倡議",
          educationalMeaning: "以資料支持小組提出的改善主張。",
        },
      ],
      signals: "比較不同地點的溫度資料\n用證據支持調適方案",
    });

    const parsed = parseKeywordAnalysis(
      raw,
      "gpt-4.1",
      INPUT.coreKeywords,
    );
    expect(parsed.summary).toBe(ANALYSIS.summary);
    expect(parsed.themes[0].keywords).toEqual(["極端氣候", "校園熱島"]);
    expect(parsed.themes[1].keywords).toEqual(INPUT.coreKeywords);
    expect(parsed.curriculumSignals).toHaveLength(2);
    expect(parsed.suggestedKeywords).toEqual([]);
  });

  it("accepts a valid alignment and rejects unknown or duplicate controlled values", () => {
    const raw = JSON.stringify({
      curriculumSelection: {
        performanceIds: ALIGNMENT.curriculumSelection.performanceIds,
        contentIds: ALIGNMENT.curriculumSelection.contentIds,
        rationale: ALIGNMENT.curriculumSelection.rationale,
      },
      backwardDesign: ALIGNMENT.backwardDesign,
      recommendations: ALIGNMENT.recommendations,
      learningOutcomes: ALIGNMENT.learningOutcomes,
      fourElements: ALIGNMENT.fourElements,
      evidenceTools: ALIGNMENT.evidenceTools,
    });
    expect(
      parseCourseAlignment(raw, "gpt-4.1", CURRICULUM_CANDIDATES),
    ).toEqual(ALIGNMENT);

    expect(() =>
      parseCourseAlignment(
        raw.replace('"C2-P1"', '"C9-P9"'),
        "gpt-4.1",
        CURRICULUM_CANDIDATES,
      ),
    ).toThrow("不存在的子向度");

    const duplicateElements = {
      curriculumSelection: {
        performanceIds: ALIGNMENT.curriculumSelection.performanceIds,
        contentIds: ALIGNMENT.curriculumSelection.contentIds,
        rationale: ALIGNMENT.curriculumSelection.rationale,
      },
      backwardDesign: ALIGNMENT.backwardDesign,
      recommendations: ALIGNMENT.recommendations,
      learningOutcomes: ALIGNMENT.learningOutcomes,
      fourElements: ALIGNMENT.fourElements.map((element, index) =>
        index === 3 ? { ...element, name: "數位利用" } : element,
      ),
      evidenceTools: ALIGNMENT.evidenceTools,
    };
    expect(() =>
      parseCourseAlignment(
        JSON.stringify(duplicateElements),
        "gpt-4.1",
        CURRICULUM_CANDIDATES,
      ),
    ).toThrow("重複輸出學習設計要素");

    expect(() =>
      parseCourseAlignment(
        raw.replace(
          '"geography-v-content-climate-5"',
          '"unknown-curriculum-id"',
        ),
        "gpt-4.1",
        CURRICULUM_CANDIDATES,
      ),
    ).toThrow("未知或不適用的課綱 ID");

    const duplicatedCurriculumIds = JSON.parse(raw) as Record<string, unknown>;
    duplicatedCurriculumIds.curriculumSelection = {
      performanceIds: [
        "geography-v-performance-inquiry-1",
        "geography-v-performance-inquiry-1",
      ],
      contentIds: ["geography-v-content-climate-5"],
      rationale: ALIGNMENT.curriculumSelection.rationale,
    };
    expect(() =>
      parseCourseAlignment(
        JSON.stringify(duplicatedCurriculumIds),
        "gpt-4.1",
        CURRICULUM_CANDIDATES,
      ),
    ).toThrow("重複 ID");
  });

  it("builds a 24-hour handoff and maps it into the assessment form", () => {
    const now = Date.UTC(2026, 6, 17, 4);
    const handoff = buildCourseIdeationHandoff(
      INPUT,
      ALIGNMENT,
      "C2-P1",
      "learning-design-test-project",
      now,
    );

    expect(isValidCourseIdeationHandoff(handoff, now + 23 * 60 * 60 * 1000)).toBe(true);
    expect(isValidCourseIdeationHandoff(handoff, now + 25 * 60 * 60 * 1000)).toBe(false);
    expect(courseIdeationHandoffToForm(handoff)).toEqual({
      grade: "高一",
      subject: "地理",
      source: "資料庫",
      indicatorId: "C2-P1",
      customIndicator: "",
      activityName: "全球氣候變遷－極端氣候與校園調適倡議",
      lifeKeywords: "極端氣候、校園熱島、數據證據、小組倡議",
      tools: "校園測量表、倡議簡報、同儕回饋單",
    });
  });

  it("rejects handoffs with invalid evidence tools or unrecommended selections", () => {
    expect(() =>
      buildCourseIdeationHandoff(
        INPUT,
        ALIGNMENT,
        "C3-P1",
        "learning-design-test-project",
      ),
    ).toThrow("所選子向度不在目前推薦結果中");

    const handoff = buildCourseIdeationHandoff(
      INPUT,
      ALIGNMENT,
      "C2-P1",
      "learning-design-test-project",
    );
    expect(
      isValidCourseIdeationHandoff({
        ...handoff,
        evidenceTools: ["有效", 42],
      }),
    ).toBe(false);
  });

  it("keeps version 1 handoffs readable for existing drafts", () => {
    const now = Date.UTC(2026, 6, 17, 4);
    const legacyHandoff = {
      version: 1 as const,
      createdAt: now,
      input: INPUT,
      selectedIndicatorId: "C2-P1",
      evidenceTools: ALIGNMENT.evidenceTools,
    };
    expect(isValidCourseIdeationHandoff(legacyHandoff, now)).toBe(true);
    expect(courseIdeationHandoffToForm(legacyHandoff).activityName).toBe(
      "全球氣候變遷－極端氣候與校園調適倡議",
    );
  });
});
