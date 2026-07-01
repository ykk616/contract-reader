// PDF 处理：提取文字 / 渲染成图片（扫描件走视觉模型）。纯浏览器端，worker 用本地文件。
import { blobToBase64 } from "./files";

async function loadPdfjs() {
  const lib: any = await import("pdfjs-dist");
  // 本地 worker（public/pdf.worker.min.mjs），不依赖 CDN，离线可用。
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

export type PdfTextResult = {
  text: string;
  numPages: number;
  avgCharsPerPage: number; // 用来判断是不是扫描件
};

export async function extractPdfText(file: File): Promise<PdfTextResult> {
  const lib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it: any) => it.str).join(" ") + "\n";
  }
  const compactLen = text.replace(/\s+/g, "").length;
  return {
    text,
    numPages: pdf.numPages,
    avgCharsPerPage: pdf.numPages > 0 ? compactLen / pdf.numPages : 0,
  };
}

export type PdfImagesResult = {
  images: string[]; // 纯 base64
  totalPages: number;
  rendered: number;
};

export async function renderPdfToImages(
  file: File,
  maxPages: number,
  onProgress?: (current: number, total: number) => void
): Promise<PdfImagesResult> {
  const lib = await loadPdfjs();
  const buf = await file.arrayBuffer();
  const pdf = await lib.getDocument({ data: buf }).promise;
  const total = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];
  for (let i = 1; i <= total; i++) {
    onProgress?.(i, total);
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("无法创建 canvas");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error(`第 ${i} 页渲染失败`);
    images.push(await blobToBase64(blob));
  }
  return { images, totalPages: pdf.numPages, rendered: total };
}
