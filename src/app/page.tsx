"use client";

import { useEffect, useRef, useState } from "react";
import { checkOllama, ollamaChat, pickModels } from "@/lib/ollama";
import { extractPdfText, renderPdfToImages } from "@/lib/pdf";
import { extractDocxText } from "@/lib/docx";
import { blobToBase64 } from "@/lib/files";
import { ocrImage, ocrImages } from "@/lib/ocr";
import { estimateCost, dashscopeChatClient } from "@/lib/dashscope";
import {
  SYSTEM_PROMPT,
  buildUserText,
  buildVisionText,
  truncateContract,
} from "@/lib/prompts";

const MAX_VISION_PAGES = 20;
const SCAN_THRESHOLD = 10; // 平均每页字符 < 此值，判为扫描件

type ForceMode = "auto" | "text" | "vision";
type AiMode = "local" | "cloud";

function loadKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("dashscope_key") || "";
}
function saveKey(k: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("dashscope_key", k);
}

export default function ContractReaderPage() {
  const [ollamaOk, setOllamaOk] = useState<boolean | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [textModel, setTextModel] = useState<string>("");
  const [visionModel, setVisionModel] = useState<string>("");
  const [aiMode, setAiMode] = useState<AiMode>("local");
  const [dashscopeKey, setDashscopeKey] = useState("");

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

  // 启动时探测 Ollama + 读取本机真实模型名 + 加载已保存的 key
  useEffect(() => {
    refreshOllama();
    setDashscopeKey(loadKey());
  }, []);

  // key 变动时自动保存
  useEffect(() => {
    saveKey(dashscopeKey);
  }, [dashscopeKey]);

  async function refreshOllama() {
    const { ok, models } = await checkOllama();
    setOllamaOk(ok);
    setModels(models);
    if (ok) {
      const picked = pickModels(models);
      if (picked.text) setTextModel(picked.text);
      if (picked.vision) setVisionModel(picked.vision);
    }
  }

  function autoScroll() {
    requestAnimationFrame(() => {
      const el = resultRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setErr("");
    setResult("");
    setUsedMode("");
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
    if (aiMode === "local" && !ollamaOk) {
      setErr("没检测到本地 AI（Ollama）。请先双击 start.bat 启动，或切换到云模式。");
      return;
    }
    if (aiMode === "cloud" && !dashscopeKey) {
      setErr("云模式需要填入百炼 API-Key。在下方输入框粘贴。");
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

      if (aiMode === "cloud") {
        setProgress("正在用云 AI（百炼 qwen-turbo）生成总结...");
        await dashscopeChatClient({
          apiKey: dashscopeKey,
          messages: messages!,
          signal: controller.signal,
          onChunk: (c) => {
            setResult((prev) => prev + c);
            autoScroll();
          },
        });
        setProgress("完成 ✅（云 AI · 一次几分钱）");
      } else {
        const model = textModel;
        if (!model) {
          throw new Error("没找到文本模型。请先安装：ollama pull qwen2.5:7b");
        }

        setProgress(`正在用 ${model} 生成总结...`);
        await ollamaChat({
          model,
          messages: messages!,
          signal: controller.signal,
          onChunk: (c) => {
            setResult((prev) => prev + c);
            autoScroll();
          },
        });
        setProgress("完成 ✅");
      }
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
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold">合同阅读器</h1>
        {/* 模式切换 */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setAiMode("local")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              aiMode === "local"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            🖥️ 本地
          </button>
          <button
            onClick={() => setAiMode("cloud")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
              aiMode === "cloud"
                ? "bg-white shadow text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            ☁️ 云
          </button>
        </div>
      </div>

      <p className="text-gray-600 mb-4 text-sm">
        {aiMode === "local"
          ? "把冗长合同压成关键要点和风险提示。支持 PDF、Word、扫描件/照片。全程本地处理，合同不上传、不联网。"
          : "把冗长合同压成关键要点和风险提示。OCR 本地识别，AI 总结走阿里云百炼。一次几分钱，任何人打开就能用。"}
      </p>

      {/* 云模式：API Key 输入 */}
      {aiMode === "cloud" && (
        <div className="mb-4">
          <input
            type="password"
            value={dashscopeKey}
            onChange={(e) => setDashscopeKey(e.target.value)}
            placeholder="粘贴百炼 API-Key（sk- 开头），自动保存在浏览器"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            获取：<a href="https://bailian.console.aliyun.com/?apiKey=1" target="_blank" className="underline">阿里云百炼控制台 → API-Key 管理</a>
          </p>
        </div>
      )}

      {/* Ollama 状态条（仅本地模式） */}
      {aiMode === "local" && ollamaOk === false && (
        <div className="mb-5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠️ 没检测到本地 AI（Ollama）。请双击项目里的 <code>start.bat</code> 启动，
          或确认任务栏有羊驼图标。启动后点
          <button onClick={refreshOllama} className="underline font-medium mx-1">
            重新检测
          </button>
          。
        </div>
      )}
      {aiMode === "local" && ollamaOk && (
        <div className="mb-5 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          ✅ 本地 AI 已就绪。文本模型：<b>{textModel || "未找到"}</b>；图片/扫描件走
          <b>OCR 识别</b>（Tesseract 中文，本地不上传）。
          <button onClick={refreshOllama} className="underline mx-1">
            刷新
          </button>
        </div>
      )}
      {aiMode === "cloud" && (
        <div className="mb-5 rounded-lg border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          ☁️ 云模式：OCR 本地识别 → 文字发给阿里云百炼 AI（加密传输）。一次几分钱。
          {dashscopeKey ? " ✅ Key 已填入" : " ⚠️ 请先粘贴 API-Key"}
        </div>
      )}

      {/* 上传区 */}
      <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-brand bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,image/*"
          onChange={onPick}
          disabled={busy}
          className="hidden"
        />
        <p className="text-gray-600">
          {busy ? "处理中…" : "点击选择合同文件（PDF / Word / 图片）"}
        </p>
        {fileName && <p className="text-xs text-gray-400 mt-2">{fileName}</p>}
      </label>

      {/* 可选项 */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm text-gray-700 mb-1">读取方式</label>
          <select
            value={forceMode}
            onChange={(e) => setForceMode(e.target.value as ForceMode)}
            disabled={busy}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white"
          >
            <option value="auto">自动判断（推荐）</option>
            <option value="text">强制按文字读</option>
            <option value="vision">强制按图片读（扫描件）</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            自动判断不准时再手动切。图片/扫描件会自动 OCR 识别。
          </p>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">想重点关注的问题（可选）</label>
          <input
            type="text"
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            disabled={busy}
            placeholder="例如：违约金合理吗？有没有自动续约？"
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* 进度 / 错误 / 停止 */}
      <div className="mt-4 flex items-center gap-3">
        {progress && <span className="text-brand text-sm">{progress}</span>}
        {busy && (
          <button
            onClick={stop}
            className="text-xs border border-gray-300 rounded px-3 py-1 hover:bg-gray-100"
          >
            停止生成
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-red-600 text-sm">{err}</p>}

      {/* 结果 */}
      {(result || usedMode) && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">总结结果</h2>
            {usedMode && (
              <span className="text-xs text-gray-400">
                方式：{usedMode === "vision" ? "视觉看图" : "文字提取"}
              </span>
            )}
          </div>
          <div
            ref={resultRef}
            className="p-6 bg-white border rounded-lg whitespace-pre-wrap text-sm leading-7 max-h-[60vh] overflow-auto"
          >
            {result || "（等待 AI 输出…）"}
          </div>
          {result && !busy && (
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              className="mt-3 text-sm bg-brand text-white px-4 py-2 rounded-lg font-medium hover:bg-brand-dark"
            >
              复制结果
            </button>
          )}
        </div>
      )}
    </div>
  );
}
