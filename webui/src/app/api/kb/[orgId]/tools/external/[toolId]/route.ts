import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; toolId: string }> },
) {
  const { orgId, toolId } = await params;
  const body = await req.json().catch(() => ({}));
  const backend = await kbBackendUrl(orgId, `/tools/external/${toolId}`);
  const res = await fetch(backend, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
