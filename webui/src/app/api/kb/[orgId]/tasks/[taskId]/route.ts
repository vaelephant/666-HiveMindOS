import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/tasks/${taskId}`, {
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
