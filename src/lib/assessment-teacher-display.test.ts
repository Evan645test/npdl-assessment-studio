import { describe, expect, it } from "vitest";
import {
  cleanAssessmentDisplayText,
  formatTeacherExplanationFallback,
  getQuestionPreviewSummary,
  humanizeQuestionTypeSuffix,
  parseTeacherQ4Content,
  stripTechnicalAssessmentLines,
} from "@/lib/assessment-teacher-display";

describe("assessment-teacher-display", () => {
  it("humanizes Q4 technical suffixes", () => {
    expect(humanizeQuestionTypeSuffix("Q4. [引導式簡答題]")).toBe(
      "引導式整合回應",
    );
  });

  it("strips technical metadata lines from preview text", () => {
    const raw = [
      "Q4情境要素｜班級、器材、限制",
      "",
      "**請依情境完成三步驟回應。**",
      "① 先說明你會先看哪裡",
    ].join("\n");

    expect(getQuestionPreviewSummary(raw, "Q4. [引導式簡答題]")).toBe(
      "請依情境完成三步驟回應。",
    );
  });

  it("parses teacher Q4 rubric blocks into structured content", () => {
    const explanation = [
      "**萌芽**：能指出問題方向，但步驟不完整。",
      "**學生可能回答**：我會先找問題，再試一個做法。",
      "**發展**：能排出行動步驟並說明理由。",
      "**精熟**：能依限制調整做法並遷移到新情境。",
      "**萌芽 → 發展｜已跨界證據**：能說明兩個以上步驟。",
      "**萌芽 → 發展｜尚未跨界訊號**：只有模糊想法。",
      "**概念正確**：能說明核心概念。",
      "**尚未遷移**：仍侷限在課堂例子。",
    ].join("\n");

    const parsed = parseTeacherQ4Content(explanation);
    expect(parsed.rubrics.find((item) => item.level === "萌芽")?.body).toContain(
      "問題方向",
    );
    expect(parsed.transitions[0]?.achieved).toContain("兩個以上步驟");
    expect(parsed.conceptNotes[0]?.label).toBe("概念正確");
    expect(parsed.transferNotes[0]?.label).toBe("尚未遷移");
  });

  it("formats fallback explanation without markdown noise", () => {
    const lines = formatTeacherExplanationFallback(
      "**教師解析**：\n> 先看學生是否能說出理由\n```json\n{}\n```",
    );
    expect(lines.some((line) => line.includes("先看學生是否能說出理由"))).toBe(
      true,
    );
    expect(lines.some((line) => line.includes("```"))).toBe(false);
  });

  it("cleans markdown markers for display", () => {
    expect(cleanAssessmentDisplayText("**重點**與`語法`")).toBe("重點與語法");
  });

  it("removes scoring spec blocks from teacher text", () => {
    const cleaned = stripTechnicalAssessmentLines(
      "教師判讀重點\n【統計規格與總分落點標準】\n不應顯示",
    );
    expect(cleaned).toBe("教師判讀重點");
  });

  it("strips Q4 metadata json and english rubric labels", () => {
    const explanation = [
      "> **情境核對資料**：{\"strategyId\":\"x\"}",
      "- **證據有限 (Evidence Limited)**：只有結論，沒有步驟。",
      "  - **學生可能回答**：我覺得先試試看。",
      "- **萌芽 (Emerging)**：能指出問題方向。",
    ].join("\n");

    const parsed = parseTeacherQ4Content(explanation);
    expect(parsed.rubrics.find((item) => item.level === "證據有限")?.body).toContain(
      "只有結論",
    );
    expect(parsed.rubrics.find((item) => item.level === "萌芽")?.body).toContain(
      "問題方向",
    );
  });
});
