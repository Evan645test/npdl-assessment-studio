import { mountTeacherDocumentForCapture } from "@/lib/teacher-document-html";

type Html2PdfModule = typeof import("html2pdf.js");

let html2pdfModulePromise: Promise<Html2PdfModule> | null = null;

export function preloadTeacherDocumentPdfEngine(): void {
  html2pdfModulePromise ??= import("html2pdf.js");
}

function loadHtml2Pdf(): Promise<Html2PdfModule> {
  html2pdfModulePromise ??= import("html2pdf.js");
  return html2pdfModulePromise;
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

export async function downloadTeacherDocumentPdf(input: {
  title: string;
  markdown: string;
  fileName: string;
}): Promise<void> {
  const html2pdfLoad = loadHtml2Pdf();
  const capture = await mountTeacherDocumentForCapture(input);
  const { root } = capture;
  const width = Math.max(root.scrollWidth, root.clientWidth, 794);
  const height = Math.max(root.scrollHeight, root.clientHeight, 200);

  try {
    const { default: html2pdf } = await html2pdfLoad;
    const worker = html2pdf().set({
      margin: [10, 10, 12, 10],
      filename: input.fileName,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        scrollX: 0,
        scrollY: 0,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
    }).from(root);

    try {
      await worker.save();
    } catch {
      const blob = await worker.outputPdf("blob");
      if (!(blob instanceof Blob)) {
        throw new Error("PDF 產生失敗，瀏覽器未回傳可下載檔案。");
      }
      downloadBlob(blob, input.fileName);
    }
  } finally {
    capture.cleanup();
  }
}
