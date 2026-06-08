import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string; jobId: string }> },
) {
  const { orgId, jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/automations/${jobId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}
