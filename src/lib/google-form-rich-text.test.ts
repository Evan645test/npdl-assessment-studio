import { describe, expect, it } from "vitest";
import {
  enrichMarkdownEmphasis,
  formBold,
  formBulletList,
  formItalic,
  formLead,
  joinFormBlocks,
} from "@/lib/google-form-rich-text";

describe("google-form-rich-text", () => {
  it("renders Chinese bold labels with corner brackets", () => {
    expect(formBold("重點")).toBe("【重點】");
    expect(formBold("Q4")).toBe("𝗤𝟒");
  });

  it("renders Chinese italic with corner quotes", () => {
    expect(formItalic("先看哪裡")).toBe("「先看哪裡」");
    expect(formItalic("hint")).toBe("𝘩𝘪𝘯𝘵");
  });

  it("builds readable lead and bullet blocks", () => {
    expect(formLead("題幹", "請比較兩份紀錄。")).toBe(
      "【題幹】\n請比較兩份紀錄。",
    );
    expect(formBulletList(["第一點", "第二點"])).toBe("• 第一點\n• 第二點");
  });

  it("converts markdown emphasis into form-friendly text", () => {
    expect(enrichMarkdownEmphasis("**重點**與*提示*")).toContain("【重點】");
    expect(enrichMarkdownEmphasis("**重點**與*提示*")).toContain("「提示」");
  });

  it("joins blocks with blank lines", () => {
    expect(joinFormBlocks("【A】", undefined, "內容")).toBe("【A】\n\n內容");
  });
});
