import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const entityType = req.nextUrl.searchParams.get('entity_type');
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/graph/entities`);
  if (entityType) url.searchParams.set('entity_type', entityType);
  const res = await fetch(url.toString());
  const data = await res.json().catch(() => ({ entities: [] }));
  return NextResponse.json(data, { status: res.status });
}
