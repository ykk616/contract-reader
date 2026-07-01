// 阿里云百炼 DashScope API（OpenAI 兼容模式）

// ========== 客户端调用（前端 → /api/dashscope → 百炼） ==========

export async function dashscopeChatClient(opts: {
  apiKey: string;
  model?: string;
  messages: { role: string; content: string }[];
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const res = await fetch("/api/dashscope", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: opts.apiKey,
      model: opts.model || "deepseek-v4-flash",
      messages: opts.messages,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as any)?.error || `百炼请求失败 ${res.status}`);
  }
  if (!res.body) throw new Error("百炼没有返回数据");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
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
        if (e instanceof Error && !e.message.includes("JSON")) throw e;
      }
    }
  }
}

// ========== 服务端调用 ==========

const BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1";

export type DashMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

// 各模型价格（元/千 token），用于成本提示
const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "deepseek-v4-flash": { in: 0.0001, out: 0.0002 },
  "qwen3.7-plus": { in: 0.0008, out: 0.002 },
  "qwen3.7-max": { in: 0.02, out: 0.06 },
  "qwen-turbo-latest": { in: 0.0003, out: 0.0006 },
  "qwen-plus-latest": { in: 0.0008, out: 0.002 },
  "qwen-max-latest": { in: 0.02, out: 0.06 },
};

// 流式调用百炼，回调每块文本，返回总用量
export async function dashscopeChat(opts: {
  apiKey: string;
  model?: string;
  messages: DashMessage[];
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<{ totalTokens: number; model: string }> {
  const model = opts.model || "qwen-turbo-latest";

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: opts.messages,
      temperature: 0.2,
      stream_options: { include_usage: true },
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`百炼返回 ${res.status}${t ? "：" + t.slice(0, 300) : ""}`);
  }
  if (!res.body) throw new Error("百炼没有返回数据流");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalTokens = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t || !t.startsWith("data:")) continue;
      const json = t.slice(5).trim();
      if (json === "[DONE]") continue;
      try {
        const obj = JSON.parse(json);
        const c = obj?.choices?.[0]?.delta?.content ?? "";
        if (c) opts.onChunk(c);
        const usage = obj?.usage;
        if (usage?.total_tokens) totalTokens = usage.total_tokens;
      } catch {
        // 半截 JSON，跳过
      }
    }
  }

  return { totalTokens, model };
}

export function estimateCost(model: string, tokens: number): string {
  const p = MODEL_PRICES[model];
  if (!p) return "未知";
  // 粗略假设输入:输出 = 3:1
  const inTokens = tokens * 0.75;
  const outTokens = tokens * 0.25;
  const cost = (inTokens / 1000) * p.in + (outTokens / 1000) * p.out;
  if (cost < 0.01) return "少于 0.01 元";
  return `约 ${cost.toFixed(2)} 元`;
}
