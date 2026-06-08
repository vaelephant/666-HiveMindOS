import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/automations/runs`);
  const incoming = new URL(req.url);
  for (const key of ['job_id', 'limit']) {
    const v = incoming.searchParams.get(key);
    if (v) url.searchParams.set(key, v);
  }
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}
