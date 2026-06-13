import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; runId: string }> },
) {
  const { orgId, runId } = await params;
  const backend = await kbBackendUrl(orgId, `/workflows/runs/${runId}`);
  const res = await fetch(backend, { method: 'DELETE' });
  const data = await res.json().catch(() => ({ detail: '删除失败' }));
  return NextResponse.json(data, { status: res.status });
}
