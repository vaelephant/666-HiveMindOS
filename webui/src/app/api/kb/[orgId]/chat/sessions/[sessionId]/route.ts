import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> },
) {
  const { orgId, sessionId } = await params;
  const res = await fetch(await kbBackendUrl(orgId, `/chat/sessions/${sessionId}`), {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> },
) {
  const { orgId, sessionId } = await params;
  const incoming = new URL(req.url).searchParams;
  const res = await fetch(
    await kbBackendUrl(orgId, `/chat/sessions/${sessionId}`, { searchParams: incoming }),
    { method: 'DELETE' },
  );
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
