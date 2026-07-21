import { describe, expect, it } from "vitest";
import {
  buildTeacherDocumentDocx,
  markdownToDocxParagraphs,
} from "@/lib/teacher-document-docx";

describe("teacher-document-docx", () => {
  it("converts markdown blocks into docx paragraphs", () => {
    const paragraphs = markdownToDocxParagraphs(
      "# 診斷指南\n\n## 使用方式\n\n> 教師用\n\n- **診斷一**：目的",
    );
    expect(paragraphs.length).toBeGreaterThan(3);
  });

  it("builds a docx document with a title section", () => {
    const document = buildTeacherDocumentDocx({
      title: "測試單元｜診斷指南",
      markdown: "## 四階參照對齊\n\n- 診斷一",
    });
    expect(document).toBeTruthy();
  });
});
