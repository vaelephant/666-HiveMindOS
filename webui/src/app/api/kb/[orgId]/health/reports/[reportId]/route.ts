import { NextRequest, NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; reportId: string }> },
) {
  const { orgId, reportId } = await params;
  const search = new URL(req.url).searchParams;
  const backendSearch = new URLSearchParams();
  if (search.get('include_full_text') === 'true') {
    backendSearch.set('include_full_text', 'true');
  }

  const url = await kbBackendUrl(orgId, `/health/reports/${reportId}`, {
    searchParams: backendSearch.size > 0 ? backendSearch : undefined,
  });
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({ error: 'not found' }));
  return NextResponse.json(data, { status: res.status });
}
