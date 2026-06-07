import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/graph/snapshot`);
  const data = await res.json().catch(() => ({
    nodes: [],
    edges: [],
    stats: { node_count: 0, edge_count: 0 },
  }));
  return NextResponse.json(data, { status: res.status });
}
