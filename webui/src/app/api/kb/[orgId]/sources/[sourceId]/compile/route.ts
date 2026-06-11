import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; sourceId: string }> },
) {
  const { orgId, sourceId } = await params;
  const backend = await kbBackendUrl(orgId, `/sources/${sourceId}/compile`);
  const res = await fetch(backend, { method: 'POST' });
  const data = await res.json().catch(() => ({ error: 'compile failed' }));
  return NextResponse.json(data, { status: res.status });
}
