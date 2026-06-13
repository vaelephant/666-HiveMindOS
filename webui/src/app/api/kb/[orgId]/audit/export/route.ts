import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const searchParams = new URLSearchParams();
  for (const key of ['days', 'category', 'action', 'q', 'format', 'status']) {
    const value = url.searchParams.get(key);
    if (value != null) searchParams.set(key, value);
  }
  const backend = await kbBackendUrl(orgId, '/audit/export', { searchParams });
  const res = await fetch(backend);
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: '导出失败' }));
    return NextResponse.json(data, { status: res.status });
  }
  const blob = await res.arrayBuffer();
  const format = url.searchParams.get('format') ?? 'csv';
  const contentType = format === 'json' ? 'application/json' : 'text/csv; charset=utf-8';
  const ext = format === 'json' ? 'json' : 'csv';
  return new NextResponse(blob, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="audit-${orgId}.${ext}"`,
    },
  });
}
