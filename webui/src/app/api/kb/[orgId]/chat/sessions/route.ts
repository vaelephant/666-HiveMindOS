import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/chat/sessions`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ sessions: [] }));
  return NextResponse.json(data, { status: res.status });
}
