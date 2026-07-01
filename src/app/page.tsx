"use client";

import { useEffect, useRef, useState } from "react";
import { extractPdfText, renderPdfToImages } from "@/lib/pdf";
import { extractDocxText } from "@/lib/docx";
import { ocrImage, ocrImages } from "@/lib/ocr";
import { dashscopeChatClient } from "@/lib/dashscope";
import { renderSummary } from "@/lib/highlight";
import {
  loadHistory,
  saveToHistory,
  deleteFromHistory,
  type HistoryItem,
} from "@/lib/history";
import { COMPARE_PROMPT, buildCompareText } from "@/lib/compare";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/templates";
import {
  SYSTEM_PROMPT,
  buildUserText,
  buildVisionText,
  truncateContract,
} from "@/lib/prompts";

const MAX_VISION_PAGES = 20;
const SCAN_THRESHOLD = 10; // 平均每页字符 < 此值，判为扫描件

type ForceMode = "auto" | "text" | "vision";
type Screen = "landing" | "dashboard" | "analyze" | "templates" | "history";

export default function ContractReaderPage() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [viewHistory, setViewHistory] = useState<HistoryItem | null>(null);

  // 模板浏览
  const [templateCat, setTemplateCat] = useState("全部");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[0] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // 多合同对比模式
  const [compareMode, setCompareMode] = useState(false);
  const [file2, setFile2] = useState<File | null>(null);
  const [fileName2, setFileName2] = useState("");
  const file2Ref = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [usedMode, setUsedMode] = useState<"text" | "vision" | "">("");
  const [forceMode, setForceMode] = useState<ForceMode>("auto");
  const [userQuestion, setUserQuestion] = useState("");
  const [result, setResult] = useState("");

  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 启动时加载历史
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 监听顶部"主页"按钮（layout 派发）
  useEffect(() => {
    const handler = () => goHome();
    window.addEventListener("youna:go-home", handler);
    return () => window.removeEventListener("youna:go-home", handler);
  }, []);

  // 重置所有状态到首页
  function goHome() {
    setScreen("landing");
    setFileName("");
    setFileName2("");
    setFile2(null);
    setResult("");
    setUsedMode("");
    setErr("");
    setCompareMode(false);
    setUserQuestion("");
    setSelectedTemplate(null);
    setTemplateCat("全部");
    setTemplateSearch("");
    setViewHistory(null);
  }

  function autoScroll() {
    requestAnimationFrame(() => {
      const el = resultRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  // 从任意文件提取文字（PDF/Word/图片）
  async function extractTextFromFile(file: File): Promise<string> {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".pdf")) {
      const { text } = await extractPdfText(file);
      return text;
    }
    if (lower.endsWith(".docx")) {
      return await extractDocxText(file);
    }
    return await ocrImage(file);
  }

  // 对比流程：两份都就绪时调 AI
  async function runCompare(f1: File, f2: File) {
    setErr("");
    setResult("");
    setUsedMode("");
    setFileName(f1.name);
    setFileName2(f2.name);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setProgress("正在分析合同 A...");
      const txt1 = await extractTextFromFile(f1);
      setProgress("正在分析合同 B...");
      const txt2 = await extractTextFromFile(f2);
      if (!txt1 || !txt2) throw new Error("其中一份没读到文字");
      const { text: t1 } = truncateContract(txt1);
      const { text: t2 } = truncateContract(txt2);
      const messages = [
        { role: "system" as const, content: COMPARE_PROMPT },
        { role: "user" as const, content: buildCompareText(t1, f1.name, t2, f2.name) },
      ];
      setUsedMode("text");
      setProgress("正在生成对比报告...");
      await dashscopeChatClient({
        apiKey: "",
        messages,
        signal: controller.signal,
        onChunk: (c) => { setResult((prev) => prev + c); autoScroll(); },
      });
      setProgress("完成 ✅");
      saveToHistory({ fileName: f1.name + " vs " + f2.name, summary: result });
      setHistory(loadHistory());
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr("对比失败：" + (e?.message || String(e)));
    } finally {
      setBusy(false); abortRef.current = null;
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    setResult("");
    setUsedMode("");

    // 对比模式
    if (compareMode) {
      if (file2) {
        setFileName(f.name);
        setFileName2(file2.name);
        await runCompare(f, file2);
        setFile2(null);
        setFileName2("");
        if (file2Ref.current) file2Ref.current.value = "";
        return;
      }
      setFileName(f.name);
      return;
    }

    setFileName(f.name);
    const lower = f.name.toLowerCase();
    let kind: "pdf" | "docx" | "image" | null = null;
    if (lower.endsWith(".pdf")) kind = "pdf";
    else if (lower.endsWith(".docx")) kind = "docx";
    else if (/\.(png|jpe?g|webp|bmp)$/.test(lower)) kind = "image";

    if (!kind) {
      setErr("不支持的文件类型，请上传 PDF / Word(.docx) / 图片(jpg、png)");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      let mode: "text" | "vision";
      let messages;

      if (kind === "image") {
        mode = "text";
        setProgress("正在 OCR 识别图片文字（本地，不上传）...");
        const ocrText = await ocrImage(f);
        if (!ocrText) throw new Error("图片里没识别到文字。可能是手写/模糊/纯图，试试用清晰照片。");
        const { text: clipped } = truncateContract(ocrText);
        messages = [
          { role: "system" as const, content: SYSTEM_PROMPT },
          { role: "user" as const, content: buildUserText(clipped, userQuestion) },
        ];
      } else if (kind === "docx") {
        mode = "text";
        setProgress("解析 Word 文档...");
        const text = await extractDocxText(f);
        if (!text) throw new Error("没从这个 Word 里读到文字，可能是空文档或纯图片排版。");
        const { text: clipped } = truncateContract(text);
        messages = [
          { role: "system" as const, content: SYSTEM_PROMPT },
          { role: "user" as const, content: buildUserText(clipped, userQuestion) },
        ];
      } else {
        // PDF：先提取文字，自动判断是否扫描件
        setProgress("读取 PDF 文字...");
        const { text, numPages, avgCharsPerPage } = await extractPdfText(f);
        const looksScanned = avgCharsPerPage < SCAN_THRESHOLD;
        if (forceMode === "vision" || (forceMode === "auto" && looksScanned)) {
          mode = "text";
          setProgress("看起来是扫描件，正在渲染页面...");
          const { images, totalPages, rendered } = await renderPdfToImages(
            f,
            MAX_VISION_PAGES,
            (c, t) => setProgress(`渲染第 ${c} / ${t} 页...`)
          );
          if (rendered < totalPages) {
            setProgress(`共 ${totalPages} 页，只 OCR 前 ${rendered} 页...`);
          }
          setProgress(`正在 OCR 识别 ${images.length} 页（本地，不上传）...`);
          const ocrText = await ocrImages(images);
          if (!ocrText) throw new Error("OCR 没识别到文字，图片可能太模糊。试试用清晰扫描件。");
          const { text: clipped } = truncateContract(ocrText);
          messages = [
            { role: "system" as const, content: SYSTEM_PROMPT },
            { role: "user" as const, content: buildUserText(clipped, userQuestion) },
          ];
        } else {
          mode = "text";
          setProgress(`已读取 ${numPages} 页文字，正在总结...`);
          const { text: clipped } = truncateContract(text);
          messages = [
            { role: "system" as const, content: SYSTEM_PROMPT },
            { role: "user" as const, content: buildUserText(clipped, userQuestion) },
          ];
        }
      }

      setUsedMode(mode);

      setProgress("正在生成总结...");
      await dashscopeChatClient({
        apiKey: "",
        messages: messages!,
        signal: controller.signal,
        onChunk: (c) => {
          setResult((prev) => prev + c);
          autoScroll();
        },
      });
      setProgress("完成 ✅");
      const item = saveToHistory({
        fileName: f.name,
        summary: result,
        userQuestion: userQuestion || undefined,
      });
      setHistory((prev) => [item, ...prev].slice(0, 50));
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setProgress("已停止生成");
      } else {
        setErr("处理失败：" + (e?.message || String(e)));
        setProgress("");
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">

      {/* ── 第一屏：欢迎页 ── */}
      {screen === "landing" && (
        <div className="flex flex-col items-center justify-center min-h-[72vh] text-center">
          <div className="mb-12 animate-fade-in">
            <img src="/icon-192.png" alt="" className="w-20 h-20 rounded-2xl shadow-xl shadow-ink-900/10 mb-8 mx-auto" />
            <div className="text-eyebrow text-ink-4 mb-6 tracking-[0.2em]">YOUR LEGAL COUNSEL · 您的私人法务</div>
            <h1 className="font-serif text-display text-ink mb-6">
              把冗长合同<br />
              <span className="gradient-text">压成你能读懂的要点</span>
            </h1>
            <p className="text-ink-3 text-lg max-w-md mx-auto leading-relaxed">
              上传合同，AI 自动识别关键条款、金额风险与争议解决条款。<br />
              任何手机、任何浏览器、点开即用。
            </p>
          </div>

          {/* 数据条 */}
          <div className="grid grid-cols-3 gap-px max-w-md w-full bg-ink-5 rounded-xl overflow-hidden mb-12 animate-slide-up">
            <div className="bg-white p-4">
              <div className="font-serif text-2xl font-bold text-ink font-num">199</div>
              <div className="text-xs text-ink-4 mt-1">合同模板</div>
            </div>
            <div className="bg-white p-4">
              <div className="font-serif text-2xl font-bold text-ink font-num">14</div>
              <div className="text-xs text-ink-4 mt-1">合同类别</div>
            </div>
            <div className="bg-white p-4">
              <div className="font-serif text-2xl font-bold text-ink">15s</div>
              <div className="text-xs text-ink-4 mt-1">平均出结果</div>
            </div>
          </div>

          <button
            onClick={() => setScreen("dashboard")}
            className="group px-10 py-4 bg-ink text-white rounded-full font-medium text-base hover:bg-ink-2 transition-all active:scale-[0.97] shadow-lg shadow-ink-900/10"
          >
            开始使用
            <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
          </button>

          <div className="mt-10 flex items-center gap-2 text-xs text-ink-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            合同不上传 · 不外传 · 隐私优先
          </div>
        </div>
      )}

      {/* ── 第二屏：仪表盘 ── */}
      {screen === "dashboard" && (
        <div className="animate-fade-in">
          <div className="mb-12 flex items-end justify-between">
            <div>
              <div className="text-eyebrow text-ink-4 mb-3">DASHBOARD</div>
              <h1 className="font-serif text-h1 text-ink">选择功能</h1>
            </div>
            <button onClick={goHome} className="flex items-center gap-1.5 text-xs text-ink-4 hover:text-ink transition-colors px-3 py-1.5 rounded-full border border-ink-5 hover:border-ink-3">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              主页
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <button onClick={() => setScreen("analyze")} className="card-premium group p-8 text-left">
              <div className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-serif text-h2 text-ink mb-2">分析合同</h3>
              <p className="text-sm text-ink-3 leading-relaxed">上传合同文件，AI 自动提取关键条款与风险</p>
              <div className="mt-6 flex items-center text-xs text-ink-3 group-hover:text-ink transition-colors">
                开始分析 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
              </div>
            </button>

            <button onClick={() => setScreen("history")} className="card-premium group p-8 text-left">
              <div className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-serif text-h2 text-ink mb-2">历史记录</h3>
              <p className="text-sm text-ink-3 leading-relaxed">{history.length > 0 ? `已保存 ${history.length} 份分析结果` : "查看之前的分析结果"}</p>
              <div className="mt-6 flex items-center text-xs text-ink-3 group-hover:text-ink transition-colors">
                查看历史 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
              </div>
            </button>

            <button onClick={() => setScreen("templates")} className="card-premium group p-8 text-left">
              <div className="w-11 h-11 rounded-lg bg-ink text-white flex items-center justify-center mb-6">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              </div>
              <h3 className="font-serif text-h2 text-ink mb-2">合同模板</h3>
              <p className="text-sm text-ink-3 leading-relaxed">199 份常用合同范本 · 14 个类别</p>
              <div className="mt-6 flex items-center text-xs text-ink-3 group-hover:text-ink transition-colors">
                浏览模板 <span className="ml-1 transition-transform group-hover:translate-x-1">→</span>
              </div>
            </button>
          </div>

          {/* 信任徽章 */}
          <div className="mt-12 grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="font-serif text-2xl font-bold text-ink font-num">100%</div>
              <div className="text-xs text-ink-4 mt-1">本地 OCR</div>
            </div>
            <div>
              <div className="font-serif text-2xl font-bold text-ink font-num">0</div>
              <div className="text-xs text-ink-4 mt-1">广告</div>
            </div>
            <div>
              <div className="font-serif text-2xl font-bold text-ink font-num">24/7</div>
              <div className="text-xs text-ink-4 mt-1">随时可用</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 第三屏：分析页 ── */}
      {screen === "analyze" && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => setScreen("dashboard")} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              返回
            </button>
            <button onClick={goHome} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1" title="主页">
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
              <input type="checkbox" checked={compareMode} onChange={(e) => { setCompareMode(e.target.checked); setFile2(null); setFileName2(""); setResult(""); setFileName(""); }} disabled={busy} className="hidden" />
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
                    if (f1) { setFileName2(f2.name); await runCompare(f1, f2); setFile2(null); setFileName2(""); if (file2Ref.current) file2Ref.current.value = ""; return; }
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
          {(result || usedMode) && (
            <div className="mt-8 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <div className="text-eyebrow text-ink-4">ANALYSIS RESULT</div>
                {usedMode && <span className="text-[10px] text-ink-4 tracking-[0.15em] uppercase">AI · 文字提取</span>}
              </div>
              {result ? (
                <>
                  <div ref={resultRef} className="p-8 bg-white border border-ink-5 rounded-xl text-sm leading-[1.85] text-ink-2 max-h-[60vh] overflow-auto">
                    {renderSummary(result)}
                  </div>
                  <div className="mt-4 flex gap-2 flex-wrap no-print">
                    <button onClick={() => navigator.clipboard.writeText(result)} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">复制全文</button>
                    <button onClick={() => { const blob = new Blob([result], { type: "text/markdown" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = (fileName || "合同分析") + ".md"; a.click(); URL.revokeObjectURL(u); }} className="px-4 py-2 bg-white border border-ink-5 text-ink-2 rounded-lg text-sm font-medium hover:border-ink-3 transition-all">下载 .md</button>
                    <button onClick={() => window.print()} className="px-4 py-2 bg-white border border-ink-5 text-ink-2 rounded-lg text-sm font-medium hover:border-ink-3 transition-all">打印 PDF</button>
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
          )}
        </div>
      )}

      {/* ── 第四屏：模板浏览 ── */}
      {screen === "templates" && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => { setScreen("dashboard"); setSelectedTemplate(null); setTemplateCat("全部"); setTemplateSearch(""); }} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              返回
            </button>
            <button onClick={goHome} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1" title="主页">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              主页
            </button>
            <span className="text-ink-5">/</span>
            <span className="text-sm text-ink-3">合同模板</span>
          </div>

          <div className="mb-8 flex items-end justify-between">
            <div>
              <div className="text-eyebrow text-ink-4 mb-2">TEMPLATES</div>
              <h1 className="font-serif text-h1 text-ink">合同模板库</h1>
              <p className="text-sm text-ink-3 mt-2">199 份常用合同范本 · 14 个类别 · 一键复制</p>
            </div>
            <div className="hidden sm:block text-right">
              <div className="font-serif text-3xl font-bold text-ink font-num">{TEMPLATES.length}</div>
              <div className="text-xs text-ink-4 mt-1">总模板数</div>
            </div>
          </div>

          {selectedTemplate ? (
            <div className="animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-serif text-h2 text-ink">{selectedTemplate.title}</h2>
                <button onClick={() => setSelectedTemplate(null)} className="text-sm text-ink-3 hover:text-ink transition-colors">← 返回列表</button>
              </div>
              <div className="p-8 bg-white border border-ink-5 rounded-xl">
                <pre className="text-sm leading-[1.85] text-ink-2 whitespace-pre-wrap font-sans">{selectedTemplate.content}</pre>
              </div>
              <button onClick={() => navigator.clipboard.writeText(selectedTemplate.content)} className="mt-4 px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">
                复制全文
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-5">
                <input type="text" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="搜索模板名称..." className="w-full border border-ink-5 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-ink-2/10 focus:border-ink outline-none" />
              </div>
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-2 px-2">
                {[{name:"全部",icon:"",count:199}, ...TEMPLATE_CATEGORIES].map((c) => (
                  <button key={c.name} onClick={() => setTemplateCat(c.name)} className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${templateCat === c.name ? "bg-ink text-white" : "bg-white border border-ink-5 text-ink-3 hover:border-ink-3"}`}>
                    {c.name}{c.count ? ` · ${c.count}` : ""}
                  </button>
                ))}
              </div>
              <div className="grid gap-px sm:grid-cols-2 bg-ink-5 rounded-xl overflow-hidden">
                {TEMPLATES.filter((t) => {
                  if (templateCat !== "全部" && t.category !== templateCat) return false;
                  if (templateSearch && !t.title.includes(templateSearch)) return false;
                  return true;
                }).map((t) => (
                  <button key={t.id} onClick={() => setSelectedTemplate(t)} className="bg-white p-4 text-left hover:bg-ink-6/40 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-ink mb-1 truncate">{t.title}</div>
                        <div className="text-[10px] text-ink-4 tracking-[0.1em] uppercase">{t.category}</div>
                      </div>
                      <span className="text-ink-4 group-hover:text-ink">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 第五屏：历史屏 ── */}
      {screen === "history" && (
        <div className="animate-fade-in">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => { setScreen("dashboard"); setViewHistory(null); }} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              返回
            </button>
            <button onClick={goHome} className="text-ink-4 hover:text-ink transition-colors text-sm flex items-center gap-1" title="主页">
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
              <button onClick={() => setScreen("analyze")} className="px-5 py-2.5 bg-ink text-white rounded-lg text-sm font-medium hover:bg-ink-2 transition-all">立即分析</button>
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
      )}
    </div>
  );
}