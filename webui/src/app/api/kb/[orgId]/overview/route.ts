import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/overview`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ stats: {}, recent_activity: [] }));
  return NextResponse.json(data, { status: res.status });
}
