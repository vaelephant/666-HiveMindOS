import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const days = url.searchParams.get('days') ?? '30';
  const backend = await kbBackendUrl(orgId, '/usage/stats', {
    searchParams: new URLSearchParams({ days }),
  });
  const res = await fetch(backend);
  const data = await res.json().catch(() => ({ detail: '用量统计不可用' }));
  return NextResponse.json(data, { status: res.status });
}
