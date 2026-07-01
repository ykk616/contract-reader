// 用 Node + 内置 fetch 直接打 Ollama API 测视觉模型。
// 下完模型立刻跑这个：node scripts/test-vision.cjs
// 不需要浏览器，比走 Playwright 快得多。

const fs = require("fs");
const path = require("path");

const TEST_IMAGE = path.resolve(__dirname, "..", "..", "test-contract.png");
const OLLAMA = "http://localhost:11434";

// 从已装模型里找视觉模型（先确认它真的在了）
async function pickVisionModel() {
  const r = await fetch(`${OLLAMA}/api/tags`);
  const j = await r.json();
  const models = (j.models || []).map((m) => m.name);
  console.log("[已装模型]", models.join(", "));
  return models.find((m) => {
    const x = m.toLowerCase();
    return (
      x.includes("-vl") ||
      x.includes("vl:") ||
      x.includes("vl-") ||
      x.endsWith("vl") ||
      x.includes("vision") ||
      x.includes("llava") ||
      x.includes("minicpm-v") ||
      x.includes("llama3.2-vision")
    );
  });
}

function fileToBase64(p) {
  return fs.readFileSync(p).toString("base64");
}

const SYSTEM = `你是一名严谨的中国合同审查助理。请仔细阅读图片里的合同内容，按下面格式严格输出（中文、Markdown）：

## 一、合同主体
- 甲方：
- 乙方：
- 签订日期：

## 二、关键金额与时间
- 月租金 / 总价：
- 押金：
- 付款节点：
- 租期 / 履行期：

## 三、违约与争议
- 违约金：
- 争议解决（法院/仲裁）：

## 四、特别提示（你觉得对我方不利的条款）
- （列出风险）

铁律：图片里看不到/不确定的地方，明确写"图片未显示，建议人工核对"。`;

async function main() {
  const vision = await pickVisionModel();
  if (!vision) {
    console.error("❌ 没找到视觉模型。先 ollama pull 一个视觉模型。");
    process.exit(1);
  }
  console.log("✅ 用视觉模型:", vision);

  if (!fs.existsSync(TEST_IMAGE)) {
    console.error("❌ 找不到测试图:", TEST_IMAGE);
    process.exit(1);
  }
  const imgB64 = fileToBase64(TEST_IMAGE);
  console.log("📷 测试图:", TEST_IMAGE, `(${Math.round(fs.statSync(TEST_IMAGE).size / 1024)} KB)`);

  const t0 = Date.now();
  console.log("🚀 调 Ollama /api/chat ...");
  console.log("=".repeat(60));

  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: vision,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: "请仔细阅读下面这张合同扫描件图片，按系统指令输出要点。",
          images: [imgB64],
        },
      ],
      options: { temperature: 0.2 },
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error("❌ Ollama 报错:", r.status, t);
    process.exit(1);
  }

  let buf = "";
  const reader = r.body.getReader();
  const dec = new TextDecoder();
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
        if (obj?.error) {
          console.error("❌ Ollama 流里报错:", obj.error);
          process.exit(1);
        }
        const c = obj?.message?.content ?? "";
        if (c) process.stdout.write(c);
        if (obj?.done) {
          console.log("\n" + "=".repeat(60));
          console.log(`✅ 完成。用时 ${((Date.now() - t0) / 1000).toFixed(1)} 秒。`);
        }
      } catch (e) {
        // 半截 JSON，忽略
      }
    }
  }
}

main().catch((e) => {
  console.error("💥", e);
  process.exit(1);
});
