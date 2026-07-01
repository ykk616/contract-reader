// 把 AI 总结里的【高】【中】【低】风险条款变成彩色徽章。
// 替代 dangerouslySetInnerHTML，更安全（不解析 HTML）。
import { Fragment } from "react";

const RISK_COLORS: Record<string, string> = {
  高: "bg-red-100 text-red-800 border-red-300",
  中: "bg-yellow-100 text-yellow-800 border-yellow-300",
  低: "bg-green-100 text-green-800 border-green-300",
};

// 把"## 一、xxx"也变成大标题
const HEADING_REGEX = /^(#{1,3})\s+(.+)$/gm;
const RISK_REGEX = /【(高|中|低)】/g;
const BOLD_REGEX = /\*\*([^*]+)\*\*/g;

export function renderSummary(text: string) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const content = headingMatch[2];
          const sizeClass =
            level === 1
              ? "text-xl font-bold mt-4 mb-2"
              : level === 2
              ? "text-lg font-semibold mt-3 mb-1.5"
              : "text-base font-semibold mt-2 mb-1";
          return (
            <div key={i} className={sizeClass}>
              {parseInline(content)}
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-2" />;
        return (
          <div key={i} className="my-1">
            {parseInline(line)}
          </div>
        );
      })}
    </>
  );
}

// 解析一行里的 **粗体** 和 【高/中/低】徽章
function parseInline(text: string) {
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;

  // 合并两个正则：先找 **，再找 【
  const regex = /\*\*([^*]+)\*\*|【(高|中|低)】/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push(text.slice(lastIdx, m.index));
    }
    if (m[1] !== undefined) {
      // 粗体
      parts.push(
        <strong key={`b-${m.index}`} className="font-semibold">
          {m[1]}
        </strong>
      );
    } else if (m[2] !== undefined) {
      // 风险徽章
      parts.push(
        <span
          key={`r-${m.index}`}
          className={`inline-block px-1.5 py-0.5 mx-0.5 rounded border text-xs font-semibold ${
            RISK_COLORS[m[2]] || ""
          }`}
        >
          {`【${m[2]}】`}
        </span>
      );
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }
  return <>{parts}</>;
}
