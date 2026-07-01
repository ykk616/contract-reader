// 浏览器端中文 OCR：把图片/扫描件转成文字，再喂给文本 AI。
// 用 Tesseract.js v6，全程在浏览器跑，不上传任何外部服务。
// 首次运行会从 CDN 下载中文语言包（约 15MB），后续走浏览器缓存。

import { createWorker } from "tesseract.js";

let _worker: Awaited<ReturnType<typeof createWorker>> | null = null;

// 获取或创建 worker（复用，避免重复下载语言包）
async function getWorker(): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (_worker) return _worker;
  _worker = await createWorker("chi_sim", 1, {
    // 全走本地 public/，不依赖外网
    workerPath: "/tesseract/worker.min.js",
    langPath: "/tesseract",
    // tesseract.js 默认从 langPath 找 {lang}.traineddata.gz
  });
  return _worker;
}

// OCR 单张图片，返回纯文本
export async function ocrImage(input: string | Blob | File): Promise<string> {
  const worker = await getWorker();
  const {
    data: { text },
  } = await worker.recognize(input);
  return text.trim();
}

// OCR 多张图片（扫描件 PDF 多页渲染后），返回合并文本
export async function ocrImages(images: string[]): Promise<string> {
  const worker = await getWorker();
  const results: string[] = [];
  for (const img of images) {
    const {
      data: { text },
    } = await worker.recognize(img);
    if (text.trim()) results.push(text.trim());
  }
  return results.join("\n\n--- 下一页 ---\n\n");
}

// 用完释放 worker（可选，页面关闭时调）
export async function destroyOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}
