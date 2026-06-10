import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const incoming = new URL(req.url).searchParams;
  const res = await fetch(await kbBackendUrl(orgId, '/memories/events', { searchParams: incoming }), {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({ events: [] }));
  return NextResponse.json(data, { status: res.status });
}
