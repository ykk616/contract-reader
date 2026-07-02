"use client";

import { useState } from "react";
import { renderSummary } from "@/lib/highlight";
import { loadHistory, deleteFromHistory, type HistoryItem } from "@/lib/history";

export default function HistoryScreen({
  history,
  setHistory,
  onBack,
  onHome,
  onNavigateAnalyze,
}: {
  history: HistoryItem[];
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  onBack: () => void;
  onHome: () => void;
  onNavigateAnalyze: () => void;
}) {
  const [viewHistory, setViewHistory] = useState<HistoryItem | null>(null);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => { onBack(); setViewHistory(null); }} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          返回
        </button>
        <button onClick={onHome} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1" title="主页">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          主页
        </button>
        <span className="text-ink-5">/</span>
        <span className="text-sm text-ink-3">历史记录</span>
      </div>

      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="text-eyebrow text-ink-4 mb-2">HISTORY</div>
          <h1 className="font-serif text-h1 text-ink">分析记录</h1>
        </div>
        <div className="text-right">
          <div className="font-serif text-3xl font-bold text-ink font-num">{history.length}</div>
          <div className="text-xs text-ink-4 mt-1">条记录</div>
        </div>
      </div>

      {viewHistory ? (
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-serif text-h2 text-ink">{viewHistory.fileName}</h2>
              <p className="text-xs text-ink-4 mt-1 font-num">{new Date(viewHistory.createdAt).toLocaleString("zh-CN")}</p>
            </div>
            <button onClick={() => setViewHistory(null)} className="text-sm text-ink-3 hover:text-ink transition-colors">← 返回列表</button>
          </div>
          <div className="p-8 bg-white border border-ink-5 rounded-xl">
            {renderSummary(viewHistory.summary)}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(viewHistory.summary)} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">复制</button>
            <button onClick={() => { deleteFromHistory(viewHistory.id); setHistory(loadHistory()); setViewHistory(null); }} className="px-4 py-2 bg-white border border-ink-5 text-ink-3 rounded-lg text-sm font-medium hover:text-red-600 hover:border-red-200 transition-all">删除</button>
          </div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-white border border-ink-5 rounded-xl">
          <div className="w-14 h-14 rounded-full bg-ink-6 mx-auto flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <h3 className="font-serif text-h2 text-ink mb-2">暂无分析记录</h3>
          <p className="text-sm text-ink-3 mb-6">分析合同后会自动保存到这里</p>
          <button onClick={onNavigateAnalyze} className="px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">立即分析</button>
        </div>
      ) : (
        <div className="grid gap-px sm:grid-cols-2 bg-ink-5 rounded-xl overflow-hidden">
          {history.map((h) => (
            <button key={h.id} onClick={() => setViewHistory(h)} className="bg-white p-5 text-left hover:bg-ink-6/40 transition-all">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="text-sm font-medium text-ink truncate flex-1">{h.fileName}</div>
                <button onClick={(e) => { e.stopPropagation(); deleteFromHistory(h.id); setHistory(loadHistory()); }} className="text-xs text-ink-4 hover:text-red-600">删除</button>
              </div>
              <div className="text-xs text-ink-4 mb-3 font-num">{new Date(h.createdAt).toLocaleString("zh-CN")}</div>
              <div className="text-xs text-ink-3 line-clamp-2 leading-relaxed">{h.summary.replace(/[#*【】]/g, "").slice(0, 100)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
