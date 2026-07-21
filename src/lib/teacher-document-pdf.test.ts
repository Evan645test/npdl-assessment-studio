import { describe, expect, it } from "vitest";
import {
  buildTeacherDocumentHtmlDocument,
  hardenMarkdownForPdf,
  renderTeacherDocumentBodyHtml,
  TEACHER_DOCUMENT_CSS,
} from "@/lib/teacher-document-html";
import { preloadTeacherDocumentPdfEngine } from "@/lib/teacher-document-pdf";

describe("teacher-document-html", () => {
  it("renders markdown into semantic html for pdf export", () => {
    const html = renderTeacherDocumentBodyHtml(
      "# 診斷指南\n\n> 教師用\n\n- **診斷一**：目的",
    );
    expect(html).toContain("<h1>診斷指南</h1>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<strong>診斷一</strong>");
  });

  it("builds a complete html document with styles in head", () => {
    const doc = buildTeacherDocumentHtmlDocument({
      title: "測試單元｜診斷指南",
      markdown: "## 四階參照對齊\n\n- 診斷一",
    });
    expect(doc).toContain("<style>");
    expect(doc).toContain("teacher-document-root");
    expect(doc).toContain("四階參照對齊");
  });

  it("includes print stylesheet tokens", () => {
    expect(TEACHER_DOCUMENT_CSS).toContain(".teacher-document h2");
  });

  it("escapes raw html tags in markdown before pdf rendering", () => {
    const html = renderTeacherDocumentBodyHtml(
      "## 測試\n\n</div></body>\n\n- 正常內容",
    );
    expect(html).toContain("正常內容");
    expect(html).not.toContain("</body>");
    expect(hardenMarkdownForPdf("<script>x</script>")).toContain("&lt;script&gt;");
  });

  it("exposes preload helper for pdf engine", () => {
    expect(typeof preloadTeacherDocumentPdfEngine).toBe("function");
  });
});
