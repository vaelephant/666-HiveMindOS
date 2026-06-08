import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const limit = req.nextUrl.searchParams.get('limit');
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/memories/events`);
  if (limit) url.searchParams.set('limit', limit);
  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ events: [] }));
  return NextResponse.json(data, { status: res.status });
}
