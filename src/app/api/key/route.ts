// 极简端点：一次返回 API key。前端拿 key 后直接调百炼，绕开 Netlify 10s 超时

export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.DASHSCOPE_API_KEY;
  if (!key) {
    return Response.json({ error: "未配置" }, { status: 500 });
  }
  return Response.json({ key });
}
