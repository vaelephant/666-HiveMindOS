import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const backend = await kbBackendUrl(orgId, '/workflows/scheduler/status', { withUserId: false });
  const res = await fetch(backend);
  const data = await res.json().catch(() => ({ enabled: false }));
  return NextResponse.json(data, { status: res.status });
}
