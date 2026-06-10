import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(await kbBackendUrl(orgId, '/chat/sessions'), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ sessions: [] }));
  return NextResponse.json(data, { status: res.status });
}
