import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const searchParams = new URLSearchParams();
  for (const key of ['days', 'category', 'action', 'limit', 'offset']) {
    const value = url.searchParams.get(key);
    if (value != null) searchParams.set(key, value);
  }
  const backend = await kbBackendUrl(orgId, '/audit/events', { searchParams });
  const res = await fetch(backend);
  const data = await res.json().catch(() => ({ detail: '审计日志不可用' }));
  return NextResponse.json(data, { status: res.status });
}
