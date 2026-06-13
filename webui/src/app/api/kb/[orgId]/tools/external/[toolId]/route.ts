import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ orgId: string; toolId: string }> },
) {
  const { orgId, toolId } = await params;
  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/tools/external/${toolId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
