import { describe, expect, it } from "vitest";
import {
  buildCourseCardRevisionPrompt,
  courseCardRevisionKey,
  getCourseCardRevisionSchema,
  parseCourseCardRevisionPatch,
  replaceCourseCardValue,
} from "@/lib/course-ai-revision";
import { TEST_ASSESSMENT_DOCUMENT } from "@/test/assessment-fixture";
import type {
  CourseAlignmentResult,
  CourseAssessmentSeedV1,
  CourseIdeationInput,
} from "@/types/course-ideation";

const input: CourseIdeationInput = {
  grade: "高一",
  subject: "地理",
  unitName: "全球氣候變遷",
  teachingTopic: "校園氣候調適",
  coreKeywords: ["極端氣候", "校園熱島", "數據證據"],
};

const alignment: CourseAlignmentResult = {
  curriculumSelection: {
    performanceIds: [
      "5730-7406-performance-1c-v-1",
      "5730-7406-performance-3b-v-2",
    ],
    contentIds: [
      "5730-7406-content-ia-v-2",
      "5730-7406-content-eb-v-5",
    ],
    rationale: "以資料探究氣候風險。",
    mode: "ai_auto",
  },
  backwardDesign: {
    transferGoals: ["能用資料提出調適方案。"],
    enduringUnderstandings: ["調適決策需要證據。"],
    essentialQuestions: ["如何決定調適優先順序？"],
  },
  recommendations: [
    {
      indicatorId: "C2-P1",
      reason: "需要建構知識。",
      matchedKeywords: ["數據證據"],
    },
  ],
  learningOutcomes: {
    knowledgeFoundation: {
      statement: "理解氣候風險。",
      evidence: "資料判讀紀錄。",
      successCriteria: ["能辨識風險。", "能引用資料。"],
    },
    competencySubdimension: {
      statement: "以證據建構知識。",
      evidence: "風險分析。",
    },
    fourElementsPractice: {
      statement: "協作提出方案。",
      evidence: "調適提案。",
    },
  },
  fourElements: [
    {
      name: "學習夥伴關係",
      designMove: "小組共同判讀。",
      studentEvidence: "協作紀錄。",
    },
    {
      name: "學習環境",
      designMove: "建立安全討論規範。",
      studentEvidence: "討論紀錄。",
    },
    {
      name: "數位利用",
      designMove: "使用試算表整理資料。",
      studentEvidence: "資料圖表。",
    },
    {
      name: "教學實踐",
      designMove: "提供證據鷹架。",
      studentEvidence: "修訂前後版本。",
    },
  ],
  evidenceTools: ["資料判讀表", "出口單"],
  model: "gemini-2.5-flash",
};

describe("course card AI revision", () => {
  it("builds a target-only prompt that locks curriculum IDs", () => {
    const prompt = buildCourseCardRevisionPrompt({
      target: { kind: "curriculum_rationale" },
      input,
      instruction: "請讓理由更聚焦資料證據。",
      currentCard: alignment.curriculumSelection.rationale,
      parent: alignment,
    });
    expect(prompt.stable).toContain("只修改「課綱對齊理由」這一張卡");
    expect(prompt.stable).toContain("5730-7406-performance-1c-v-1");
    expect(prompt.dynamic).toContain("更聚焦資料證據");
    expect(prompt.dynamic).not.toContain("API Key");
  });

  it("uses stable unique keys for repeated visual cards", () => {
    expect(courseCardRevisionKey({ kind: "keyword_theme", index: 2 })).toBe(
      "keyword_theme-2",
    );
    expect(
      courseCardRevisionKey({
        kind: "question_purpose",
        phase: "post",
        questionId: "Q4",
      }),
    ).toBe("question_purpose-post-Q4");
  });

  it("provides a wrapper schema for each target shape", () => {
    const schema = getCourseCardRevisionSchema({
      kind: "lesson",
      lessonId: "lesson-1",
    });
    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["value"],
    });
  });

  it("accepts only a value wrapper", () => {
    expect(parseCourseCardRevisionPatch('{"value":"新摘要"}')).toBe("新摘要");
    expect(() =>
      parseCourseCardRevisionPatch('{"value":"新摘要","path":"other"}'),
    ).toThrow("未允許");
    expect(() =>
      parseCourseCardRevisionPatch('說明文字 {"value":"新摘要"}'),
    ).toThrow("不是有效");
    expect(() => parseCourseCardRevisionPatch('{"summary":"新摘要"}')).toThrow(
      "缺少",
    );
  });

  it("rejects empty or oversized instructions", () => {
    expect(() =>
      buildCourseCardRevisionPrompt({
        target: { kind: "curriculum_rationale" },
        input,
        instruction: "短",
        currentCard: alignment.curriculumSelection.rationale,
        parent: alignment,
      }),
    ).toThrow("至少輸入 4 個字");
  });

  it("replaces exactly one narrative level and marks the seed teacher-edited", () => {
    const seed: CourseAssessmentSeedV1 = {
      version: 1,
      generatedAt: 1,
      model: "gemini-2.5-flash",
      sourceFingerprint: "course-assessment-v1-test",
      narrative: structuredClone(TEST_ASSESSMENT_DOCUMENT.narrative),
      pre: structuredClone(TEST_ASSESSMENT_DOCUMENT.pre),
      preMappings: [],
      plannedPostMappings: [],
      mode: "ai_generated",
    };
    const replacement = {
      ...seed.narrative.developing,
      classroomBehavior: "能比較兩項資料並清楚說明判斷依據。",
    };
    const revised = replaceCourseCardValue(
      seed,
      { kind: "course_narrative_level", level: "developing" },
      replacement,
    ) as CourseAssessmentSeedV1;

    expect(revised.narrative.developing).toEqual(replacement);
    expect(revised.narrative.emerging).toEqual(seed.narrative.emerging);
    expect(revised.pre).toEqual(seed.pre);
    expect(revised.mode).toBe("teacher_edited");
  });
});
