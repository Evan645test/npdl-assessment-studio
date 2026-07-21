import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
  type IParagraphOptions,
} from "docx";
import { Lexer, marked } from "marked";
import { hardenMarkdownForPdf } from "@/lib/teacher-document-html";

marked.setOptions({
  gfm: true,
  breaks: true,
});

type InlineToken = {
  type: string;
  text?: string;
  tokens?: InlineToken[];
};

function headingLevel(depth: number): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  if (depth <= 1) return HeadingLevel.HEADING_1;
  if (depth === 2) return HeadingLevel.HEADING_2;
  if (depth === 3) return HeadingLevel.HEADING_3;
  return HeadingLevel.HEADING_4;
}

function inlineTokensToRuns(tokens: InlineToken[]): TextRun[] {
  const runs: TextRun[] = [];
  for (const token of tokens) {
    if (token.type === "strong") {
      runs.push(
        new TextRun({
          text: token.text ?? "",
          bold: true,
        }),
      );
      continue;
    }
    if (token.type === "em") {
      runs.push(
        new TextRun({
          text: token.text ?? "",
          italics: true,
        }),
      );
      continue;
    }
    if (token.type === "codespan") {
      runs.push(
        new TextRun({
          text: token.text ?? "",
          font: "Menlo",
        }),
      );
      continue;
    }
    if (token.type === "text") {
      runs.push(new TextRun(token.text ?? ""));
      continue;
    }
    if (token.tokens?.length) {
      runs.push(...inlineTokensToRuns(token.tokens));
    } else if (token.text) {
      runs.push(new TextRun(token.text));
    }
  }
  return runs.length > 0 ? runs : [new TextRun("")];
}

function inlineMarkdownToRuns(text: string): TextRun[] {
  const tokens = Lexer.lexInline(text) as InlineToken[];
  return inlineTokensToRuns(tokens);
}

function paragraphFromMarkdown(
  text: string,
  options: IParagraphOptions = {},
): Paragraph {
  return new Paragraph({
    ...options,
    children: inlineMarkdownToRuns(text),
  });
}

function blockquoteParagraph(text: string): Paragraph {
  return paragraphFromMarkdown(text, {
    indent: { left: 720 },
    spacing: { before: 120, after: 120 },
    shading: {
      type: ShadingType.CLEAR,
      fill: "F0F9FB",
    },
  });
}

type BlockToken = {
  type: string;
  depth?: number;
  text?: string;
  ordered?: boolean;
  items?: Array<{ text: string }>;
  tokens?: BlockToken[];
};

function walkBlockToken(token: BlockToken): Paragraph[] {
  switch (token.type) {
    case "heading":
      return [
        new Paragraph({
          heading: headingLevel(token.depth ?? 1),
          spacing: { before: 180, after: 120 },
          children: inlineMarkdownToRuns(token.text ?? ""),
        }),
      ];
    case "paragraph":
      return [
        paragraphFromMarkdown(token.text ?? "", {
          spacing: { after: 120 },
        }),
      ];
    case "blockquote":
      return (token.text ?? "")
        .split(/\n{2,}/)
        .filter(Boolean)
        .map((part: string) => blockquoteParagraph(part.replace(/\n/g, " ")));
    case "list":
      return (token.items ?? []).flatMap((item, index: number) => {
        const prefix = token.ordered ? `${index + 1}. ` : "";
        return [
          paragraphFromMarkdown(`${prefix}${item.text}`, {
            bullet: token.ordered ? undefined : { level: 0 },
            spacing: { after: 80 },
          }),
        ];
      });
    case "hr":
      return [
        new Paragraph({
          spacing: { before: 160, after: 160 },
          border: {
            bottom: {
              color: "DFE8E2",
              size: 6,
              style: "single",
            },
          },
          children: [new TextRun("")],
        }),
      ];
    case "code":
      return (token.text ?? "")
        .split("\n")
        .filter((line: string) => line.length > 0)
        .map(
          (line: string) =>
            new Paragraph({
              spacing: { after: 60 },
              shading: {
                type: ShadingType.CLEAR,
                fill: "F4F4F5",
              },
              children: [
                new TextRun({
                  text: line,
                  font: "Menlo",
                }),
              ],
            }),
        );
    case "space":
      return [];
    default:
      if ("text" in token && typeof token.text === "string" && token.text.trim()) {
        return [paragraphFromMarkdown(token.text)];
      }
      return [];
  }
}

export function markdownToDocxParagraphs(markdown: string): Paragraph[] {
  const safeMarkdown = hardenMarkdownForPdf(markdown.trim());
  if (!safeMarkdown) {
    throw new Error("文件內容為空，無法產生 Word。");
  }
  return marked.lexer(safeMarkdown).flatMap((token) =>
    walkBlockToken(token as BlockToken),
  );
}

export function buildTeacherDocumentDocx(input: {
  title: string;
  markdown: string;
}): Document {
  const bodyParagraphs = markdownToDocxParagraphs(input.markdown);
  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Microsoft JhengHei",
            size: 24,
          },
        },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: "NPDL 評量設計工作室",
                bold: true,
                color: "155E75",
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.TITLE,
            spacing: { after: 240 },
            children: [new TextRun({ text: input.title, bold: true })],
          }),
          ...bodyParagraphs,
        ],
      },
    ],
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeDocxFileName(fileName: string): string {
  const sanitized = fileName.replace(/[\\/:*?"<>|]/g, "-");
  return sanitized.toLowerCase().endsWith(".docx")
    ? sanitized
    : `${sanitized}.docx`;
}

export async function downloadTeacherDocumentDocx(input: {
  title: string;
  markdown: string;
  fileName: string;
}): Promise<void> {
  const document = buildTeacherDocumentDocx(input);
  const blob = await Packer.toBlob(document);
  downloadBlob(blob, normalizeDocxFileName(input.fileName));
}
