// 把前端请求中转给本机 Ollama（http://localhost:11434）。
// 好处：浏览器只和本站同源通信，不用配置 Ollama 的 CORS（OLLAMA_ORIGINS），小白零配置。
// 服务端就在老大本机运行，调用 localhost 没有跨域问题，也支持流式转发。

export const dynamic = "force-dynamic";

const TARGET = "http://localhost:11434";

async function handler(
  req: Request,
  ctx: { params: { path?: string[] } }
): Promise<Response> {
  const path = (ctx.params.path ?? []).join("/");
  const url = `${TARGET}/${path}`;

  try {
    const init: RequestInit = {
      method: req.method,
      headers: { "content-type": req.headers.get("content-type") || "application/json" },
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.text(),
    };
    const resp = await fetch(url, init);
    // 直接把 Ollama 的响应体（含流式 NDJSON）原样转发回前端
    return new Response(resp.body, {
      status: resp.status,
      headers: {
        "content-type": resp.headers.get("content-type") || "application/json",
        "cache-control": "no-store",
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "连不上本机 Ollama：" + (e?.message || String(e)) }),
      { status: 502, headers: { "content-type": "application/json" } }
    );
  }
}

export const GET = handler;
export const POST = handler;
