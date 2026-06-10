import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sourceId: string }> },
) {
  const { orgId, sourceId } = await params;
  const body = await req.text();
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/sources/${sourceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const data = await res.json().catch(() => ({ error: 'patch failed' }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sourceId: string }> },
) {
  const { orgId, sourceId } = await params;
  const res = await fetch(
    `${BACKEND}/api/v1/orgs/${orgId}/sources/${sourceId}`,
    { method: 'DELETE' },
  );
  const data = await res.json().catch(() => ({ error: 'delete failed' }));
  return NextResponse.json(data, { status: res.status });
}
