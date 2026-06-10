import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; sourceId: string }> },
) {
  const { orgId, sourceId } = await params;
  const search = req.nextUrl.search;
  const range = req.headers.get('range');
  const res = await fetch(
    `${BACKEND}/api/v1/orgs/${orgId}/sources/${sourceId}/file${search}`,
    { headers: range ? { range } : undefined },
  );
  if (!res.ok && res.status !== 206) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text }, { status: res.status });
  }
  const headers = new Headers();
  for (const key of ['content-disposition', 'content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = res.headers.get(key);
    if (value) headers.set(key, value);
  }
  return new NextResponse(res.body, { status: res.status, headers });
}
