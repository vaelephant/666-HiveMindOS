import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const formData = await req.formData();
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/ingest`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({ error: 'invalid response' }));
  return NextResponse.json(data, { status: res.status });
}
