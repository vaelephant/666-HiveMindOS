import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/workflows`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ detail: '创建失败' }));
  return NextResponse.json(data, { status: res.status });
}
