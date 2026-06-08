import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8006';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> },
) {
  const { orgId, sessionId } = await params;
  const res = await fetch(
    `${BACKEND}/api/v1/orgs/${orgId}/chat/sessions/${sessionId}`,
    { cache: 'no-store' },
  );
  const data = await res.json().catch(() => ({ detail: '服务不可用' }));
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> },
) {
  const { orgId, sessionId } = await params;
  const url = new URL(req.url);
  const recap = url.searchParams.get('recap');
  const backendUrl = new URL(`${BACKEND}/api/v1/orgs/${orgId}/chat/sessions/${sessionId}`);
  if (recap === 'true') backendUrl.searchParams.set('recap', 'true');
  const res = await fetch(backendUrl.toString(), { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
