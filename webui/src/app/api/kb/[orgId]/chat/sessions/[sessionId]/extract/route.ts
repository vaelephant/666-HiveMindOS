import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> },
) {
  const { orgId, sessionId } = await params;
  const bodyText = await req.text();
  const body = await mergeUserIntoJsonBody(bodyText);
  const backend = await kbBackendUrl(orgId, `/chat/sessions/${sessionId}/extract`);
  const res = await fetch(backend, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ detail: '提炼失败' }));
  return NextResponse.json(data, { status: res.status });
}
