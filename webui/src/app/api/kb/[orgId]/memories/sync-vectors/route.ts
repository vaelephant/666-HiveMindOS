import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(await kbBackendUrl(orgId, '/memories/sync-vectors'), { method: 'POST' });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
