import { NextResponse } from 'next/server';
import { kbBackendUrl, mergeUserIntoJsonBody } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(await kbBackendUrl(orgId, '/chat/starters'), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ detail: '读取快捷问题失败' }));
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await mergeUserIntoJsonBody(await req.text());
  const res = await fetch(await kbBackendUrl(orgId, '/chat/starters'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ detail: '保存失败' }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(await kbBackendUrl(orgId, '/chat/starters'), { method: 'DELETE' });
  const data = await res.json().catch(() => ({ detail: '重置失败' }));
  return NextResponse.json(data, { status: res.status });
}
