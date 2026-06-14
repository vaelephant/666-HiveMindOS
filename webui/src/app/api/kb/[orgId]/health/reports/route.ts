import { NextRequest, NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const search = new URL(req.url).searchParams;
  const backendSearch = new URLSearchParams();
  const limit = search.get('limit');
  const offset = search.get('offset');
  if (limit) backendSearch.set('limit', limit);
  if (offset) backendSearch.set('offset', offset);

  const url = await kbBackendUrl(orgId, '/health/reports', {
    searchParams: backendSearch.size > 0 ? backendSearch : undefined,
  });
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({ reports: [] }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('multipart/form-data')) {
    return NextResponse.json({ error: '需要 multipart/form-data' }, { status: 400 });
  }

  const headers: Record<string, string> = { 'content-type': contentType };
  const contentLength = req.headers.get('content-length');
  if (contentLength) headers['content-length'] = contentLength;

  const url = await kbBackendUrl(orgId, '/health/reports', { withUserId: false });
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: req.body,
    duplex: 'half',
  } as RequestInit);
  const data = await res.json().catch(() => ({ error: 'upload failed' }));
  return NextResponse.json(data, { status: res.status });
}
