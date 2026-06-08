import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; runId: string }> },
) {
  const { orgId, runId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/automations/runs/${runId}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}
