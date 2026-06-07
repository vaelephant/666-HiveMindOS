import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string; path: string[] }> },
) {
  const { orgId, path } = await params;
  const wikiPath = path.join('/');
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/wiki/${wikiPath}`);
  const data = await res.json().catch(() => ({ error: 'not found' }));
  return NextResponse.json(data, { status: res.status });
}
