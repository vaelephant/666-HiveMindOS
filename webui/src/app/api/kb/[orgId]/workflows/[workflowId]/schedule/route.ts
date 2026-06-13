import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> },
) {
  const { orgId, workflowId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const backend = await kbBackendUrl(orgId, `/workflows/${workflowId}/schedule`);
  const res = await fetch(backend, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ detail: '更新调度失败' }));
  return NextResponse.json(data, { status: res.status });
}
