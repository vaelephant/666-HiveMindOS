import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> },
) {
  const { orgId, workflowId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const backend = await kbBackendUrl(orgId, `/workflows/${workflowId}/run`);
  const res = await fetch(backend, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ detail: '执行失败' }));
  return NextResponse.json(data, { status: res.status });
}
