const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: req.signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ detail: '服务不可用' }));
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
