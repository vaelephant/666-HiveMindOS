import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(await kbBackendUrl(orgId, '/memories'), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ memories: [] }));
  return NextResponse.json(data, { status: res.status });
}
