import { describe, expect, it } from "vitest";
import { COURSE_IDEATION_EXAMPLES } from "@/data/course-ideation-examples";
import {
  CURRICULUM_ENTRIES,
  CURRICULUM_NOTEBOOK_URL,
  CURRICULUM_SOURCES,
  createCustomCurriculumEntry,
  getCurriculumCandidates,
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
    const candidates = getCurriculumCandidates({
      grade: "高一",
      subject: "社會",
      unitName: "公共政策與環境",
      teachingTopic: "比較政策對環境與人民行為的影響",
      coreKeywords: ["公共政策", "氣候", "公民行動"],
    });
    expect(new Set(candidates.contents.map((entry) => entry.subject))).toEqual(
      new Set(["歷史", "地理", "公民與社會"]),
    );

    const geographyOnly = getCurriculumCandidates({
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

  it("covers every first-batch subject in stages IV and V", () => {
    const expectedSubjects = [
      "自然科學",
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
      const stages = new Set(
        CURRICULUM_ENTRIES
          .filter((entry) => entry.subject === subject)
          .map((entry) => entry.stage),
      );
      expect(stages, `${subject} 未完整涵蓋第四、第五學習階段`).toEqual(
        new Set(["IV", "V"]),
      );
    }
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
});
