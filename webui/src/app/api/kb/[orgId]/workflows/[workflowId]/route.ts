import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> },
) {
  const { orgId, workflowId } = await params;
  const backend = await kbBackendUrl(orgId, `/workflows/${workflowId}`);
  const res = await fetch(backend, { cache: 'no-store' });
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> },
) {
  const { orgId, workflowId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const backend = await kbBackendUrl(orgId, `/workflows/${workflowId}`);
  const res = await fetch(backend, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ detail: '更新失败' }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; workflowId: string }> },
) {
  const { orgId, workflowId } = await params;
  const backend = await kbBackendUrl(orgId, `/workflows/${workflowId}`);
  const res = await fetch(backend, { method: 'DELETE' });
  const data = await res.json().catch(() => ({ detail: '删除失败' }));
  return NextResponse.json(data, { status: res.status });
}
