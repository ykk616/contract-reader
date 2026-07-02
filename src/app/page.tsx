"use client";

import { useEffect, useRef, useState } from "react";
import { extractPdfText, renderPdfToImages } from "@/lib/pdf";
import { extractDocxText } from "@/lib/docx";
import { ocrImage, ocrImages } from "@/lib/ocr";
import { dashscopeChatClient } from "@/lib/dashscope";
import {
  loadHistory,
  saveToHistory,
  type HistoryItem,
} from "@/lib/history";
import { COMPARE_PROMPT, buildCompareText } from "@/lib/compare";
import {
  SYSTEM_PROMPT,
  buildUserText,
  truncateContract,
} from "@/lib/prompts";
import LandingScreen from "@/components/LandingScreen";
import DashboardScreen from "@/components/DashboardScreen";
import AnalyzeScreen from "@/components/AnalyzeScreen";
import TemplatesScreen from "@/components/TemplatesScreen";
import HistoryScreen from "@/components/HistoryScreen";
import ContractResult from "@/components/ContractResult";

const MAX_VISION_PAGES = 20;
const SCAN_THRESHOLD = 10;

type ForceMode = "auto" | "text" | "vision";
type Screen = "landing" | "dashboard" | "analyze" | "templates" | "history";

export default function ContractReaderPage() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // 分析相关状态
  const [compareMode, setCompareMode] = useState(false);
  const [file2, setFile2] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [fileName2, setFileName2] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState("");
  const [usedMode, setUsedMode] = useState<"text" | "vision" | "">("");
  const [forceMode, setForceMode] = useState<ForceMode>("auto");
  const [userQuestion, setUserQuestion] = useState("");

  // 保存原始合同文本供追问使用
  const [processedText, setProcessedText] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const handler = () => goHome();
    window.addEventListener("youna:go-home", handler);
    return () => window.removeEventListener("youna:go-home", handler);
  }, []);

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
    setProcessedText("");
  }

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

  async function runCompare(f1: File, f2: File) {
    setErr("");
    setResult("");
    setUsedMode("");
    setFileName(f1.name);
    setFileName2(f2.name);
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    let fullResult = "";
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
        onChunk: (c) => { fullResult += c; setResult(fullResult); },
      });
      setProgress("完成 ✅");
      saveToHistory({ fileName: f1.name + " vs " + f2.name, summary: fullResult });
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
    let fullResult = "";
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
        setProcessedText(clipped);
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
        setProcessedText(clipped);
        messages = [
          { role: "system" as const, content: SYSTEM_PROMPT },
          { role: "user" as const, content: buildUserText(clipped, userQuestion) },
        ];
      } else {
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
          setProcessedText(clipped);
          messages = [
            { role: "system" as const, content: SYSTEM_PROMPT },
            { role: "user" as const, content: buildUserText(clipped, userQuestion) },
          ];
        } else {
          mode = "text";
          setProgress(`已读取 ${numPages} 页文字，正在总结...`);
          const { text: clipped } = truncateContract(text);
          setProcessedText(clipped);
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
          fullResult += c;
          setResult(fullResult);
        },
      });
      setProgress("完成 ✅");
      const item = saveToHistory({
        fileName: f.name,
        summary: fullResult,
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
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  // 追问
  async function handleFollowUp(question: string) {
    if (!question.trim() || !processedText || !result) return;
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT },
        { role: "user" as const, content: buildUserText(processedText, userQuestion) },
        { role: "assistant" as const, content: result },
        { role: "user" as const, content: question },
      ];
      setResult((prev) => prev + `\n\n---\n\n**🔍 追问：${question}**\n\n`);
      await dashscopeChatClient({
        apiKey: "",
        messages,
        signal: controller.signal,
        onChunk: (c) => { setResult((prev) => prev + c); },
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") setErr("追问失败：" + (e?.message || String(e)));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {screen === "landing" && (
        <LandingScreen onStart={() => setScreen("dashboard")} />
      )}

      {screen === "dashboard" && (
        <DashboardScreen
          onNavigate={setScreen}
          onHome={goHome}
          historyCount={history.length}
        />
      )}

      {screen === "analyze" && (
        <AnalyzeScreen
          fileName={fileName}
          fileName2={fileName2}
          compareMode={compareMode}
          busy={busy}
          progress={progress}
          err={err}
          result={result}
          usedMode={usedMode}
          forceMode={forceMode}
          userQuestion={userQuestion}
          setCompareMode={setCompareMode}
          setForceMode={setForceMode}
          setUserQuestion={setUserQuestion}
          setFileName={setFileName}
          setFileName2={setFileName2}
          setFile2={setFile2}
          onPick={onPick}
          stop={stop}
          onHome={goHome}
          onBack={() => setScreen("dashboard")}
          onCompare={runCompare}
          onFollowUp={handleFollowUp}
        >
          {(result || usedMode) && (
            <ContractResult
              result={result}
              fileName={fileName}
              usedMode={usedMode}
              busy={busy}
            />
          )}
        </AnalyzeScreen>
      )}

      {screen === "templates" && (
        <TemplatesScreen
          onBack={() => setScreen("dashboard")}
          onHome={goHome}
        />
      )}

      {screen === "history" && (
        <HistoryScreen
          history={history}
          setHistory={setHistory}
          onBack={() => setScreen("dashboard")}
          onHome={goHome}
          onNavigateAnalyze={() => setScreen("analyze")}
        />
      )}
    </div>
  );
}
