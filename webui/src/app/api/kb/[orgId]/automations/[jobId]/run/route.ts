import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; jobId: string }> },
) {
  const { orgId, jobId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const res = await fetch(
    await kbBackendUrl(orgId, `/automations/${jobId}/run`, { withUserId: false }),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    },
  );
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}
