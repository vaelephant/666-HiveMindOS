import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; taskId: string }> },
) {
  const { orgId, taskId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/tasks/${taskId}/cancel`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
