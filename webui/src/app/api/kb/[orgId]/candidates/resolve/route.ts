import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const res = await fetch(await kbBackendUrl(orgId, '/candidates/resolve', { withUserId: false }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
