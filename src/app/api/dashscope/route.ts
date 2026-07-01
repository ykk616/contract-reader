// 服务端代理：前端 → 本路由 → 阿里云百炼 DashScope
// stream=true，数据边生成边返回，避免函数超时

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { model, messages } = body;

    const key = process.env.DASHSCOPE_API_KEY;
    if (!key) {
      return Response.json(
        { error: "服务端未配置 API key。请联系管理员。" },
        { status: 500 }
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
          model: model || "qwen3.7-plus",
          stream: false,
          messages,
          temperature: 0.2,
        }),
      }
    );

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return Response.json(
        { error: `百炼 ${res.status}：${t.slice(0, 300)}` },
        { status: res.status }
      );
    }

    if (!res.body) {
      return Response.json({ error: "百炼返回空响应" }, { status: 502 });
    }

    // 非流式：直接拿 JSON，转成 NDJSON 给前端
    const j = await res.json();
    const content = j?.choices?.[0]?.message?.content ?? "";
    const ndjson =
      JSON.stringify({ message: { content } }) + "\n" +
      JSON.stringify({ done: true }) + "\n";

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
