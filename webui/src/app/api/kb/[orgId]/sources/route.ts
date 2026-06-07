import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/sources`);
  const data = await res.json().catch(() => ({ sources: [] }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const formData = await req.formData();
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/sources`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json().catch(() => ({ error: 'upload failed' }));
  return NextResponse.json(data, { status: res.status });
}
