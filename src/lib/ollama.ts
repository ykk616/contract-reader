// 调用本机 Ollama。合同文本/图片只发给本机，不上传外部。
// 走本站的中转接口 /api/ollama/*（见 src/app/api/ollama/[...path]/route.ts），免去浏览器跨域配置。

const OLLAMA_BASE = "/api/ollama";

export type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[]; // 视觉模型用：纯 base64（不带 data:image/...;base64, 前缀）
};

// 探测 Ollama 是否在跑，并返回本机已安装的模型真实名字（不靠硬编）。
export async function checkOllama(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!r.ok) return { ok: false, models: [] };
    const j = await r.json();
    const models: string[] = (j.models ?? []).map((m: any) => m.name).filter(Boolean);
    return { ok: true, models };
  } catch {
    return { ok: false, models: [] };
  }
}

// 从本机模型列表里挑出"文本模型"和"视觉模型"。
export function pickModels(models: string[]): { text?: string; vision?: string } {
  const isVision = (s: string) => {
    const x = s.toLowerCase();
    return x.includes("-vl") || x.includes("vl:") || x.includes("vl-") || x.endsWith("vl") ||
      x.includes("vision") || x.includes("llava") || x.includes("minicpm-v") || x.includes("llama3.2-vision");
  };
  const isEmbed = (s: string) => s.toLowerCase().includes("embed");
  const vision = models.find(isVision);
  const text =
    models.find((m) => m.toLowerCase().includes("qwen2.5") && !isVision(m)) ||
    models.find((m) => !isVision(m) && !isEmbed(m));
  return { text, vision };
}

// 流式调用 /api/chat，逐块回调内容。
export async function ollamaChat(opts: {
  model: string;
  messages: OllamaMessage[];
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      stream: true,
      messages: opts.messages,
      options: { temperature: 0.2 },
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Ollama 返回 ${res.status}${t ? "：" + t : ""}`);
  }
  if (!res.body) throw new Error("Ollama 没有返回数据流");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // 最后一行可能是半截，留到下次
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj?.error) throw new Error(String(obj.error));
        const c = obj?.message?.content ?? "";
        if (c) opts.onChunk(c);
        if (obj?.done) return;
      } catch (e) {
        // JSON.parse 失败说明是半行，忽略；真正的 error 已 throw
        if (e instanceof Error && e.message && !e.message.includes("JSON")) throw e;
      }
    }
  }
}
