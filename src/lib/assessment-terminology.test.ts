import { describe, expect, it } from "vitest";
import {
  designReferenceLabel,
  designStageWithFocus,
  evidenceItemTypeLabel,
  formatImplementationQuestionTitle,
  implementationGroupLabel,
  implementationItemLabel,
  questionKeyToIndex,
} from "@/lib/assessment-terminology";

describe("assessment-terminology", () => {
  it("maps design and implementation labels", () => {
    expect(designReferenceLabel("pre")).toBe("診斷性四階參照");
    expect(designReferenceLabel("post")).toBe("遷移性四階參照");
    expect(implementationGroupLabel("pre")).toBe("診斷題組");
    expect(implementationGroupLabel("post")).toBe("遷移題組");
    expect(implementationItemLabel("pre", 0)).toBe("診斷一");
    expect(implementationItemLabel("post", 3)).toBe("遷移四");
  });

  it("maps evidence item types to design references", () => {
    expect(evidenceItemTypeLabel("diagnostic")).toBe("診斷性四階參照");
    expect(evidenceItemTypeLabel("formative")).toBe("形成性四階參照");
    expect(evidenceItemTypeLabel("transfer")).toBe("遷移性四階參照");
  });

  it("formats design stage with focus", () => {
    expect(designStageWithFocus(0, "conceptual_understanding")).toBe(
      "階一 · 概念理解",
    );
  });

  it("parses question keys", () => {
    expect(questionKeyToIndex("q2")).toBe(1);
    expect(questionKeyToIndex("pre.q1")).toBe(0);
    expect(questionKeyToIndex("post.q4")).toBe(3);
  });

  it("formats implementation titles without technical suffixes", () => {
    expect(
      formatImplementationQuestionTitle("pre", 3, "Q4. [引導式簡答題]"),
    ).toBe("診斷四 · 引導式整合回應");
  });
});
