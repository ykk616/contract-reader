"use client";

import { useRef, useEffect, useState } from "react";
import { renderSummary } from "@/lib/highlight";
import { extractHeadings, type Heading } from "@/lib/sections";

export default function ContractResult({
  result,
  fileName,
  usedMode,
  busy,
}: {
  result: string;
  fileName?: string;
  usedMode?: string;
  busy?: boolean;
}) {
  const resultRef = useRef<HTMLDivElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeH, setActiveH] = useState("");

  useEffect(() => {
    if (result) setHeadings(extractHeadings(result));
  }, [result]);

  // 滚动时高亮当前可见标题
  useEffect(() => {
    if (headings.length === 0) return;
    const el = resultRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveH(entry.target.id);
            break;
          }
        }
      },
      { root: el, threshold: 0.3 }
    );
    headings.forEach((h) => {
      const target = el.querySelector(`#${h.id}`);
      if (target) observer.observe(target);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!result && !usedMode && !busy) return null;

  return (
    <div className="mt-8 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="text-eyebrow text-ink-4">ANALYSIS RESULT</div>
        {usedMode && <span className="text-[10px] text-ink-4 tracking-[0.15em] uppercase">AI · 文字提取</span>}
      </div>

      {result ? (
        <>
          <div className="flex gap-6">
            {/* 条款导航侧边栏 (桌面端) */}
            {headings.length > 1 && (
              <div className="hidden lg:block w-48 shrink-0" id="toc-sidebar">
                <div className="sticky top-24 space-y-0.5">
                  <div className="text-[10px] text-ink-4 uppercase tracking-[0.15em] font-semibold mb-3 px-2">条款导航</div>
                  {headings.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => {
                        const el = document.getElementById(h.id);
                        el?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className={`block text-xs text-left w-full py-1 px-2 rounded transition-colors hover:bg-ink-6 truncate ${
                        h.id === activeH
                          ? "font-semibold text-ink bg-ink-6"
                          : h.level === 1
                          ? "font-medium text-ink-2"
                          : "text-ink-3 pl-4"
                      }`}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 主内容 */}
            <div className="flex-1 min-w-0">
              <div ref={resultRef} className="p-8 bg-white border border-ink-5 rounded-xl text-sm leading-[1.85] text-ink-2 max-h-[60vh] overflow-auto">
                {renderSummary(result)}
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="mt-4 flex gap-2 flex-wrap no-print">
            <button onClick={() => navigator.clipboard.writeText(result)} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">复制全文</button>
            <button onClick={() => { const blob = new Blob([result], { type: "text/markdown" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = (fileName || "合同分析") + ".md"; a.click(); URL.revokeObjectURL(u); }} className="px-4 py-2 bg-white border border-ink-5 text-ink-2 rounded-lg text-sm font-medium hover:border-ink-3 transition-all">下载 .md</button>
            <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-ink-5 text-ink-2 rounded-lg text-sm font-medium hover:border-ink-3 transition-all">
              <svg className="w-4 h-4 inline mr-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 9V3h12v6M6 13h.01M6 17h12" /></svg>
              导出 PDF
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="skeleton h-5 w-3/4" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-4/6" />
        </div>
      )}
    </div>
  );
}
