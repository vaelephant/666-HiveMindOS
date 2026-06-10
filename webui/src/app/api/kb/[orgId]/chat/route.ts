import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const res = await fetch(await kbBackendUrl(orgId, '/chat', { withUserId: false }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ answer: '服务暂时不可用', sources: [] }));
  return NextResponse.json(data, { status: res.status });
}
