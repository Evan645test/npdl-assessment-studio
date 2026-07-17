import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export async function extractPdfText(file: File): Promise<{
  text: string;
  pageCount: number;
  wordCount: number;
}> {
  const buffer = await file.arrayBuffer();
  const doc = await getDocument({ data: buffer }).promise;
  let text = "";
  for (let page = 1; page <= doc.numPages; page += 1) {
    const pdfPage = await doc.getPage(page);
    const content = await pdfPage.getTextContent();
    text += `${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}\n`;
  }
  const trimmed = text.trim();
  return {
    text: trimmed,
    pageCount: doc.numPages,
    wordCount: trimmed.length,
  };
}
