import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/memories/stats`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({
    stats: { total: 0, project: 0, preference: 0, decision: 0, events_this_week: 0, memories_this_week: 0, vector_indexed: 0 },
  }));
  return NextResponse.json(data, { status: res.status });
}
