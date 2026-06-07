import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; path: string[] }> },
) {
  const { orgId, path } = await params;
  const wikiPath = path.join('/');
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/wiki/${wikiPath}`);
  if (req.nextUrl.searchParams.get('detail') === 'true') {
    url.searchParams.set('detail', 'true');
  }
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({ error: 'not found' }));
  return NextResponse.json(data, { status: res.status });
}
