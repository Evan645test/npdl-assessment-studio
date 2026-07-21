import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

export const TEACHER_DOCUMENT_CSS = `
  .teacher-document-root {
    box-sizing: border-box;
    width: 794px;
    padding: 32px 36px;
    background: #ffffff;
    color: #18181b;
  }
  .teacher-document-root .teacher-document {
    color: #18181b;
    font-family: "PingFang TC", "Noto Sans TC", "Microsoft JhengHei",
      -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    line-height: 1.75;
  }
  .teacher-document-root .teacher-document h1 {
    margin: 0 0 12px;
    font-size: 22px;
    font-weight: 800;
    color: #0f312a;
  }
  .teacher-document-root .teacher-document h2 {
    margin: 24px 0 10px;
    padding-bottom: 6px;
    border-bottom: 2px solid #b9ccc2;
    font-size: 17px;
    font-weight: 800;
    color: #173f36;
  }
  .teacher-document-root .teacher-document h3 {
    margin: 18px 0 8px;
    font-size: 15px;
    font-weight: 800;
    color: #155e75;
  }
  .teacher-document-root .teacher-document p,
  .teacher-document-root .teacher-document li {
    margin: 0 0 8px;
  }
  .teacher-document-root .teacher-document ul,
  .teacher-document-root .teacher-document ol {
    margin: 0 0 12px 20px;
    padding: 0;
  }
  .teacher-document-root .teacher-document blockquote {
    margin: 10px 0 12px;
    padding: 10px 12px;
    border-left: 4px solid #67a8b8;
    background: #f0f9fb;
    color: #164e63;
  }
  .teacher-document-root .teacher-document blockquote p {
    margin: 0 0 6px;
  }
  .teacher-document-root .teacher-document strong {
    font-weight: 800;
    color: #0f312a;
  }
  .teacher-document-root .teacher-document hr {
    margin: 20px 0;
    border: 0;
    border-top: 1px solid #dfe8e2;
  }
`;

export interface TeacherDocumentCapture {
  root: HTMLElement;
  cleanup: () => void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function hardenMarkdownForPdf(markdown: string): string {
  return markdown.replace(/<[^>\n]+>/g, (tag) => escapeHtml(tag));
}

export function renderTeacherDocumentBodyHtml(markdown: string): string {
  const safeMarkdown = hardenMarkdownForPdf(markdown.trim());
  if (!safeMarkdown) {
    throw new Error("文件內容為空，無法產生 PDF。");
  }
  const parsed = marked.parse(safeMarkdown, { async: false });
  if (typeof parsed !== "string" || !parsed.trim()) {
    throw new Error("Markdown 解析失敗，無法產生 PDF。");
  }
  return parsed;
}

export function buildTeacherDocumentHtmlDocument(input: {
  title: string;
  markdown: string;
}): string {
  const bodyHtml = renderTeacherDocumentBodyHtml(input.markdown);
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=794">
  <title>${escapeHtml(input.title)}</title>
  <style>${TEACHER_DOCUMENT_CSS}</style>
</head>
<body>
  <div class="teacher-document-root">
    <article class="teacher-document">
      <header style="margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #173f36;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:#155e75;">
          NPDL 評量設計工作室
        </p>
        <h1 style="margin:0;font-size:24px;font-weight:800;color:#0f312a;">${escapeHtml(input.title)}</h1>
      </header>
      ${bodyHtml}
    </article>
  </div>
</body>
</html>`;
}

function waitForDocumentPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function mountTeacherDocumentRoot(input: {
  title: string;
  markdown: string;
}): TeacherDocumentCapture {
  const html = buildTeacherDocumentHtmlDocument(input);
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const parsedRoot = parsed.querySelector(".teacher-document-root");

  if (!(parsedRoot instanceof HTMLElement)) {
    throw new Error("PDF 文件結構建立失敗，請稍後再試。");
  }

  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-teacher-pdf-style", "true");
  styleEl.textContent = TEACHER_DOCUMENT_CSS;

  const root = parsedRoot.cloneNode(true) as HTMLElement;
  root.setAttribute("aria-hidden", "true");
  root.style.position = "fixed";
  root.style.left = "-10000px";
  root.style.top = "0";
  root.style.width = "794px";
  root.style.minHeight = "200px";
  root.style.background = "#ffffff";
  root.style.pointerEvents = "none";
  root.style.zIndex = "2147483646";

  document.head.append(styleEl);
  document.body.append(root);

  return {
    root,
    cleanup: () => {
      root.remove();
      styleEl.remove();
    },
  };
}

export async function mountTeacherDocumentForCapture(input: {
  title: string;
  markdown: string;
}): Promise<TeacherDocumentCapture> {
  if (!input.markdown.trim()) {
    throw new Error("文件內容為空，請重新產生後再試。");
  }

  const capture = mountTeacherDocumentRoot(input);
  await waitForDocumentPaint();

  if (!capture.root.textContent?.trim()) {
    capture.cleanup();
    throw new Error(
      `PDF 內容渲染失敗（${input.markdown.trim().length} 字），請稍後再試。`,
    );
  }

  return capture;
}
