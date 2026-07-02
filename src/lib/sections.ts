// 从 AI 总结的 Markdown 文本中提取标题，生成条款导航目录
export interface Heading {
  id: string;
  label: string;
  level: number;
}

export function extractHeadings(text: string): Heading[] {
  const headings: Heading[] = [];
  const regex = /^(#{1,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const level = match[1].length;
    const label = match[2].trim();
    const id = label.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, "-").replace(/-+$/g, "");
    headings.push({ id, label, level });
  }
  return headings;
}
