import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const force = req.nextUrl.searchParams.get('force') === 'true';
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/wiki/migrate`);
  if (force) url.searchParams.set('force', 'true');
  const res = await fetch(url.toString(), { method: 'POST' });
  const data = await res.json().catch(() => ({ migrated: 0, skipped: 0, total: 0 }));
  return NextResponse.json(data, { status: res.status });
}
