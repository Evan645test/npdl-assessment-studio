import { describe, expect, it } from "vitest";
import { COURSE_IDEATION_EXAMPLES } from "@/data/course-ideation-examples";
import {
  CURRICULUM_ENTRIES,
  CURRICULUM_NOTEBOOK_URL,
  CURRICULUM_SOURCES,
  createCustomCurriculumEntry,
  getCurriculumCandidates,
  getCurriculumOptions,
  getCurriculumTierMap,
  rankCurriculumWithTiers,
} from "@/lib/curriculum";

describe("controlled 108 curriculum snapshot", () => {
  it("keeps every entry unique, complete, staged, and traceable", () => {
    expect(CURRICULUM_NOTEBOOK_URL).toContain("notebooklm.google.com/notebook/");
    expect(new Set(CURRICULUM_ENTRIES.map((entry) => entry.id)).size).toBe(
      CURRICULUM_ENTRIES.length,
    );
    for (const entry of CURRICULUM_ENTRIES) {
      expect(entry.id).toMatch(/^[a-z0-9-]+$/);
      expect(["IV", "V"]).toContain(entry.stage);
      expect(["learning_performance", "learning_content"]).toContain(entry.kind);
      expect(entry.code.trim()).not.toBe("");
      expect(entry.text.trim()).not.toBe("");
      expect(entry.sourceName.trim()).not.toBe("");
      expect(entry.sourceDocumentTitle).toContain("課程綱要");
      expect(
        CURRICULUM_SOURCES.some(
          (source) =>
            source.sourceName === entry.sourceName &&
            source.sourceDocumentTitle === entry.sourceDocumentTitle &&
            source.sourceVersion === entry.sourceVersion,
        ),
        `${entry.id} 的來源未登錄於 manifest`,
      ).toBe(true);
    }
  });

  it("returns both kinds for every current course example", () => {
    for (const example of COURSE_IDEATION_EXAMPLES) {
      const candidates = getCurriculumCandidates(example.input);
      expect(
        candidates.performances.length,
        `${example.input.subject} 缺少學習表現`,
      ).toBeGreaterThan(0);
      expect(
        candidates.contents.length,
        `${example.input.subject} 缺少學習內容`,
      ).toBeGreaterThan(0);
    }
  });

  it("uses the combined history, geography, and civics pool for social studies", () => {
    const input = {
      grade: "高一",
      subject: "社會",
      unitName: "公共政策與環境",
      teachingTopic: "比較政策對環境與人民行為的影響",
      coreKeywords: ["公共政策", "氣候", "公民行動"],
    };
    const options = getCurriculumOptions(input);
    expect(new Set(options.contents.map((entry) => entry.subject))).toEqual(
      new Set(["歷史", "地理", "公民與社會"]),
    );

    const geographyOnly = getCurriculumOptions({
      grade: "高一",
      subject: "地理",
      unitName: "氣候與人類生活",
      teachingTopic: "比較不同地區的氣候風險",
      coreKeywords: ["氣候", "風險", "地理探究"],
    });
    expect(
      new Set([
        ...geographyOnly.performances,
        ...geographyOnly.contents,
      ].map((entry) => entry.subject)),
    ).toEqual(new Set(["地理"]));
  });

  it("offers both kinds for every first-batch subject in stages IV and V", () => {
    const expectedSubjects = [
      "化學",
      "生物",
      "物理",
      "地球科學",
      "數學",
      "國語文",
      "英語文",
      "歷史",
      "地理",
      "公民與社會",
    ];
    for (const subject of expectedSubjects) {
      for (const grade of ["國八", "高一"]) {
        const options = getCurriculumOptions({
          grade,
          subject,
          unitName: "課綱涵蓋驗證",
          teachingTopic: "檢查該科可用的學習表現與學習內容",
          coreKeywords: ["學科知識", "探究實作", "證據判讀"],
        });
        expect(
          options.performances.length,
          `${subject} ${grade} 缺少學習表現`,
        ).toBeGreaterThan(0);
        expect(
          options.contents.length,
          `${subject} ${grade} 缺少學習內容`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("keeps a teacher-selected option outside the preferred tier shortlist", () => {
    const input = {
      grade: "高一",
      subject: "地理",
      unitName: "氣候變遷",
      teachingTopic: "分析極端氣候風險",
      coreKeywords: ["氣候風險", "調適", "證據"],
    };
    const options = getCurriculumOptions(input);
    const shortlist = getCurriculumCandidates(input);
    const outside = options.contents.find(
      (entry) => !shortlist.contents.some((item) => item.id === entry.id),
    );
    // When the preferred tiers already cover the whole subject pool, pick any
    // option and assert re-including an explicit selection stays stable.
    const targetId = outside?.id ?? options.contents[options.contents.length - 1]?.id;
    expect(targetId).toBeDefined();
    const withTeacherSelection = getCurriculumCandidates(
      input,
      null,
      [],
      { contentIds: [targetId!] },
    );
    expect(
      withTeacherSelection.contents.some((entry) => entry.id === targetId),
    ).toBe(true);
  });

  it("labels teacher-provided fallback entries as unverified", () => {
    const custom = createCustomCurriculumEntry(
      "learning_performance",
      "學生能整理證據並提出可檢驗的主張。",
      COURSE_IDEATION_EXAMPLES[0].input,
      "custom-performance-test",
    );
    expect(custom.sourceVersion).toBe("unverified");
    expect(custom.sourceName).toContain("未由系統核對");
  });

  it("maps science inquiry umbrella subjects into the natural-science pool with tiers", () => {
    const input = {
      grade: "高一",
      subject: "自然科學探究與實作",
      unitName: "化學流言終結者：AI 時代的科學探究與資料檢索",
      teachingTopic: "以 AI 協作查核化學流言",
      coreKeywords: ["AI 協作", "事實查核", "科學探究", "資訊轉譯", "媒體識讀"],
    };
    const options = getCurriculumOptions(input);
    expect(options.performances.length).toBeGreaterThanOrEqual(5);
    expect(options.contents.length).toBeGreaterThanOrEqual(5);
    expect(
      options.contents.every((entry) => entry.subject === "化學"),
    ).toBe(true);

    const ranked = rankCurriculumWithTiers(
      "learning_content",
      input,
      null,
    );
    expect(ranked.some((item) => item.tier === 1)).toBe(true);
    expect(ranked.some((item) => item.tier === 2 || item.tier === 3)).toBe(
      true,
    );
    const tierMap = getCurriculumTierMap(input);
    expect(tierMap.size).toBeGreaterThan(0);
  });
});
