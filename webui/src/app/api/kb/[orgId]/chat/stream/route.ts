import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const res = await fetch(await kbBackendUrl(orgId, '/chat/stream', { withUserId: false }), {
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
