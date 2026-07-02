// 阿里云百炼 DashScope API（OpenAI 兼容模式）
// 浏览器直连百炼，绕开 Netlify 10s 函数超时

const DASHSCOPE = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

let _cachedKey: string | null = null;

// 从 Netlify 环境变量拿 key（一次，然后缓存）
async function getKey(): Promise<string> {
  if (_cachedKey) return _cachedKey;
  const res = await fetch("/api/key");
  if (!res.ok) throw new Error("无法获取 API key");
  const j = await res.json();
  _cachedKey = j.key as string;
  return _cachedKey || "";
}

// ========== 客户端直接调百炼（不用 Netlify 代理，避免 10s 超时）==========

export async function dashscopeChatClient(opts: {
  apiKey?: string;  // 忽略，从 /api/key 拿
  model?: string;
  messages: { role: string; content: string }[];
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const key = await getKey();
  const model = opts.model || "qwen3.7-plus";

  const res = await fetch(DASHSCOPE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      messages: opts.messages,
      temperature: 0.2,
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`百炼 ${res.status}：${t.slice(0, 300)}`);
  }

  const j = await res.json();
  const content = j?.choices?.[0]?.message?.content ?? "";
  // 模拟流式：一次性回调完整内容（前端 NDJSON 解析不变）
  if (content) opts.onChunk(content);
}

// 价格估算
const MODEL_PRICES: Record<string, { in: number; out: number }> = {
  "qwen3.7-plus": { in: 0.0008, out: 0.002 },
  "qwen3.7-max": { in: 0.02, out: 0.06 },
  "deepseek-v4-flash": { in: 0.0001, out: 0.0002 },
};
export function estimateCost(model: string, tokens: number): string {
  const p = MODEL_PRICES[model] || { in: 0.001, out: 0.002 };
  const inTokens = tokens * 0.75;
  const outTokens = tokens * 0.25;
  const cost = (inTokens / 1000) * p.in + (outTokens / 1000) * p.out;
  if (cost < 0.01) return "≈ 0.01 元";
  return `≈ ${cost.toFixed(2)} 元`;
}