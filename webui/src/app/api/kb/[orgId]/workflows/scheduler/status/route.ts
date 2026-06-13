import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/workflows/scheduler/status`);
  const data = await res.json().catch(() => ({ enabled: false }));
  return NextResponse.json(data, { status: res.status });
}
