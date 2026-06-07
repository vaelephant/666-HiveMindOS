import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; name: string }> },
) {
  const { orgId, name } = await params;
  const res = await fetch(
    `${BACKEND}/api/v1/orgs/${orgId}/graph/entity/${encodeURIComponent(name)}`,
  );
  const data = await res.json().catch(() => ({ error: 'not found' }));
  return NextResponse.json(data, { status: res.status });
}
