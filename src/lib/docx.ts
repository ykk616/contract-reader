// Word(.docx) 提取纯文本。用 mammoth 浏览器版（Next 客户端打包会自动选 browser 入口）。
export async function extractDocxText(file: File): Promise<string> {
  const mod: any = await import("mammoth/mammoth.browser");
  const mammoth = mod.default ?? mod;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result?.value ?? "").trim();
}
