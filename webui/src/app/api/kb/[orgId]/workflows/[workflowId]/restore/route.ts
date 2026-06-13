import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> },
) {
  const { orgId, workflowId } = await params;
  const backend = await kbBackendUrl(orgId, `/workflows/${workflowId}/restore`);
  const res = await fetch(backend, { method: 'POST' });
  const data = await res.json().catch(() => ({ detail: '恢复失败' }));
  return NextResponse.json(data, { status: res.status });
}
