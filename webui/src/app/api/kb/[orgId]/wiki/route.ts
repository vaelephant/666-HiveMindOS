import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const category = req.nextUrl.searchParams.get('category');
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/wiki`);
  if (category) url.searchParams.set('category', category);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({ pages: [] }));
  return NextResponse.json(data, { status: res.status });
}
