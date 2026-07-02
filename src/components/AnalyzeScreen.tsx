"use client";

import { useRef, useState } from "react";

type ForceMode = "auto" | "text" | "vision";

export interface AnalyzeScreenProps {
  fileName: string;
  fileName2: string;
  compareMode: boolean;
  busy: boolean;
  progress: string;
  err: string;
  result: string;
  usedMode: string;
  forceMode: ForceMode;
  userQuestion: string;
  setCompareMode: (v: boolean) => void;
  setForceMode: (v: ForceMode) => void;
  setUserQuestion: (v: string) => void;
  setFileName: (v: string) => void;
  setFileName2: (v: string) => void;
  setFile2: (f: File | null) => void;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  stop: () => void;
  onHome: () => void;
  onBack: () => void;
  /** 对比模式：文件B上传后直接调用对比（绕过 onPick） */
  onCompare?: (f1: File, f2: File) => Promise<void>;
  /** 追问功能：在结果下方显示追问输入框 */
  onFollowUp?: (question: string) => Promise<void>;
  children?: React.ReactNode; // 结果渲染插槽（留给 ContractResult 或外部）
}

export default function AnalyzeScreen(props: AnalyzeScreenProps) {
  const {
    fileName, fileName2, compareMode, busy, progress, err, result, usedMode,
    forceMode, userQuestion, setCompareMode, setForceMode, setUserQuestion,
    setFileName, setFileName2, setFile2, onPick, stop, onHome, onBack,
    onCompare, onFollowUp, children,
  } = props;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const file2Ref = useRef<HTMLInputElement>(null);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={onBack} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          返回
        </button>
        <button onClick={onHome} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1" title="主页">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          主页
        </button>
        <span className="text-ink-5">/</span>
        <span className="text-sm text-ink-3">分析合同</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="text-eyebrow text-ink-4 mb-2">ANALYZE</div>
          <h1 className="font-serif text-h1 text-ink">上传合同</h1>
        </div>
        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all border ${compareMode ? "bg-ink text-white border-ink" : "bg-white border-ink-5 text-ink-3 hover:border-ink-4"}`}>
          <input type="checkbox" checked={compareMode} onChange={(e) => { setCompareMode(e.target.checked); setFile2(null); setFileName2(""); setFileName(""); }} disabled={busy} className="hidden" />
          对比模式
        </label>
      </div>

      {/* 上传区 */}
      <div
        className={`rounded-2xl bg-white border border-dashed ${busy ? "border-ink-4 bg-ink-6/30" : "border-ink-4 hover:border-ink-2 hover:bg-ink-6/20"} p-12 text-center cursor-pointer transition-all upload-breathe`}
        onClick={() => !busy && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-ink-6 flex items-center justify-center">
            <svg className="w-6 h-6 text-ink-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <div>
            <p className="font-serif text-lg text-ink mb-1">{busy ? "处理中..." : "点击上传合同"}</p>
            <p className="text-xs text-ink-4 font-num">PDF · Word · JPG · PNG · 最大 20MB</p>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.docx,image/*" onChange={onPick} disabled={busy} className="hidden" />
        {fileName && (
          <div className="mt-4 inline-flex items-center gap-2 text-xs text-ink-2 bg-ink-6 px-3 py-1.5 rounded-full">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span className="font-num">{fileName}</span>
          </div>
        )}
      </div>

      {compareMode && (
        <div className="mt-3">
          <div
            className={`rounded-xl bg-white border border-dashed ${fileName2 ? "border-ink" : "border-ink-4 hover:border-ink-2"} p-5 text-center cursor-pointer transition-all`}
            onClick={() => !busy && file2Ref.current?.click()}
          >
            <input ref={file2Ref} type="file" accept=".pdf,.docx,image/*"
              onChange={async (e) => {
                const f2 = e.target.files?.[0];
                if (!f2) return;
                const f1 = fileInputRef.current?.files?.[0];
                if (f1 && onCompare) { setFileName2(f2.name); await onCompare(f1, f2); setFile2(null); setFileName2(""); if (file2Ref.current) file2Ref.current.value = ""; return; }
                setFile2(f2); setFileName2(f2.name);
              }}
              disabled={busy} className="hidden"
            />
            <p className="text-sm text-ink-3">
              {fileName2 ? <span className="font-num text-ink">合同 B：{fileName2}</span> : "点击上传合同 B"}
            </p>
          </div>
        </div>
      )}

      {/* 设置 */}
      <div className="mt-5 grid sm:grid-cols-2 gap-3">
        <select value={forceMode} onChange={(e) => setForceMode(e.target.value as ForceMode)} disabled={busy} className="border border-ink-5 rounded-xl px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-ink-2/10 focus:border-ink outline-none transition-all">
          <option value="auto">智能识别模式</option>
          <option value="text">强制按文字读取</option>
          <option value="vision">强制按图片读取</option>
        </select>
        <input type="text" value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} disabled={busy} placeholder="想重点关注什么？（可选）" className="border border-ink-5 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-ink-2/10 focus:border-ink outline-none transition-all" />
      </div>

      {/* 进度 */}
      {progress && (
        <div className="mt-5 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-ink rounded-full typing-dot" style={{ animationDelay: "0s" }} />
            <span className="w-1.5 h-1.5 bg-ink rounded-full typing-dot" style={{ animationDelay: "0.2s" }} />
            <span className="w-1.5 h-1.5 bg-ink rounded-full typing-dot" style={{ animationDelay: "0.4s" }} />
          </div>
          <span className="text-sm text-ink-2">{progress}</span>
        </div>
      )}
      {err && (
        <div className="mt-3 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* 结果 */}
      {children}

      {/* 追问 */}
      {result && !busy && onFollowUp && (
        <FollowUpBar onSend={onFollowUp} />
      )}
    </div>
  );
}

/** 追问输入条（内嵌组件） */
function FollowUpBar({ onSend }: { onSend: (q: string) => Promise<void> }) {
  const [q, setQ] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!q.trim() || sending) return;
    setSending(true);
    try { await onSend(q.trim()); setQ(""); } finally { setSending(false); }
  }

  return (
    <div className="mt-4 flex gap-2">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        placeholder="对当前合同进一步提问...（Enter 发送）"
        disabled={sending}
        className="flex-1 border border-ink-5 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-ink-2/10 focus:border-ink outline-none disabled:opacity-40"
      />
      <button
        onClick={handleSend}
        disabled={sending || !q.trim()}
        className="px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all disabled:opacity-40 shrink-0"
      >
        {sending ? "思考中..." : "追问"}
      </button>
    </div>
  );
}
