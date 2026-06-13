import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const res = await fetch(
    `${BACKEND}/api/v1/orgs/${orgId}/workflows/runs${qs ? `?${qs}` : ''}`,
    { cache: 'no-store' },
  );
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}
