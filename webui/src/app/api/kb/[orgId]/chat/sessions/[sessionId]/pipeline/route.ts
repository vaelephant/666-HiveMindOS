import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; sessionId: string }> },
) {
  const { orgId, sessionId } = await params;
  const res = await fetch(
    await kbBackendUrl(orgId, `/chat/sessions/${sessionId}/pipeline`),
    { cache: 'no-store' },
  );
  const data = await res.json().catch(() => ({ pipeline: null }));
  return NextResponse.json(data, { status: res.status });
}
