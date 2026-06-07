import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sourceId: string }> },
) {
  const { orgId, sourceId } = await params;
  const res = await fetch(
    `${BACKEND}/api/v1/orgs/${orgId}/sources/${sourceId}/compile`,
    { method: 'POST' },
  );
  const data = await res.json().catch(() => ({ error: 'compile failed' }));
  return NextResponse.json(data, { status: res.status });
}
