// 服务端代理：前端 → 本路由 → 阿里云百炼 DashScope
// 把百炼的 SSE 转成 NDJSON（跟 Ollama 格式一致），前端不用改解析逻辑

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, model, messages } = body;

    const key = apiKey || process.env.DASHSCOPE_API_KEY;
    if (!key) {
      return Response.json(
        { error: "缺少 API key。请在设置里填入百炼 API-Key。" },
        { status: 400 }
      );
    }

    const res = await fetch(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: model || "deepseek-v4-flash",
          // 不用流式——百炼兼容模式对流式支持参差，非流式更稳
          // 一份合同几百字，1-3 秒就出全
          stream: false,
          messages,
          temperature: 0.2,
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return Response.json(
        { error: `百炼返回 ${res.status}：${t.slice(0, 300)}` },
        { status: res.status }
      );
    }

    // 非流式：拿到完整 JSON，转成 NDJSON 给前端（保持前端解析逻辑不变）
    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content ?? "";
    const ndjson = JSON.stringify({ message: { content } }) + "\n" + JSON.stringify({ done: true }) + "\n";

    return new Response(ndjson, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return Response.json(
      { error: "连接百炼失败：" + (e?.message || String(e)) },
      { status: 502 }
    );
  }
}
