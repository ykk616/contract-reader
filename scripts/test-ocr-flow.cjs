// 端到端测试：图片 → OCR → Ollama 文本模型 → 合同总结
// 不依赖浏览器，纯 Node 跑

const fs = require("fs");
const path = require("path");

const TEST_IMAGE = "C:/Users/ykhrx/Desktop/test-contract.png";
const OLLAMA = "http://localhost:11434";

const SYSTEM = `你是一名资深合同审查助理。请仔细阅读合同内容，按下面格式输出（中文、Markdown）：

## 一、合同概览
- 甲方：
- 乙方：
- 签订日期：
- 合同标的：

## 二、关键金额
- 月租金/总价：
- 押金：
- 付款方式：

## 三、重要条款
- 违约责任：
- 争议解决：

## 四、风险提示
逐条列出，标风险等级【高/中/低】。

铁律：没看到的内容写"合同未提及"，不许编造。`;

async function pickTextModel() {
  const r = await fetch(`${OLLAMA}/api/tags`);
  const j = await r.json();
  const models = (j.models || []).map((m) => m.name);
  // 优先用 14b（更聪明）
  const preferred = models.find((m) => m.includes("qwen3:14b") || m.includes("qwen:7b"));
  return preferred || models.find((m) => !m.toLowerCase().includes("embed"));
}

async function ocrWithTesseract(imagePath) {
  // 动态加载 tesseract（node 环境也能用）
  const { createWorker } = require("tesseract.js");
  console.log("🔍 初始化 OCR worker（首次需下载中文语言包 ~15MB）...");
  const t0 = Date.now();
  const worker = await createWorker("chi_sim");
  console.log(`   Worker 就绪，${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const imgBuf = fs.readFileSync(imagePath);
  console.log(`📷 识别中... (${Math.round(imgBuf.length / 1024)} KB)`);
  const t1 = Date.now();
  const { data: { text } } = await worker.recognize(imgBuf);
  console.log(`   OCR 完成，${((Date.now() - t1) / 1000).toFixed(1)}s，${text.length} 字符`);
  await worker.terminate();
  return text.trim();
}

async function summarizeWithOllama(model, contractText) {
  console.log(`🤖 调用 ${model} 生成总结...`);
  const t0 = Date.now();
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `以下是合同全文，请按系统指令输出要点：\n\n${contractText.slice(0, 8000)}` },
      ],
      options: { temperature: 0.2 },
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Ollama ${r.status}: ${t}`);
  }

  let buf = "";
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let fullText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj?.error) throw new Error(obj.error);
        const c = obj?.message?.content ?? "";
        if (c) {
          process.stdout.write(c);
          fullText += c;
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }

  console.log(`\n✅ 总结完成，${((Date.now() - t0) / 1000).toFixed(1)}s，${fullText.length} 字符`);
  return fullText;
}

async function main() {
  console.log("=" .repeat(60));
  console.log("  合同阅读器 端到端测试：图片 → OCR → AI 总结");
  console.log("=" .repeat(60));
  console.log("");

  // Step 1: OCR
  const ocrText = await ocrWithTesseract(TEST_IMAGE);
  console.log("");
  console.log("📝 OCR 提取的文字：");
  console.log("-".repeat(40));
  console.log(ocrText);
  console.log("-".repeat(40));
  console.log("");

  if (!ocrText || ocrText.length < 10) {
    console.error("❌ OCR 文字太少，可能识别失败");
    process.exit(1);
  }

  // Step 2: 检查关键信息是否提取到
  const checks = [
    { label: "甲方", re: /北京.*科技/ },
    { label: "乙方", re: /上海/ },
    { label: "月租金 5000", re: /5000/ },
    { label: "押金 10000", re: /10000/ },
    { label: "签订日期", re: /2026.*6.*月.*30/ },
  ];

  console.log("🔍 关键信息提取检查：");
  for (const c of checks) {
    const ok = c.re.test(ocrText);
    console.log(`   ${ok ? "✅" : "❌"} ${c.label}`);
  }
  console.log("");

  // Step 3: AI 总结
  const model = await pickTextModel();
  if (!model) {
    console.error("❌ 没找到文本模型");
    process.exit(1);
  }
  console.log(`📦 使用模型：${model}`);
  console.log("");

  await summarizeWithOllama(model, ocrText);
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
