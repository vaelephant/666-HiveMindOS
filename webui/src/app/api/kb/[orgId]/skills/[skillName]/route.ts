import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; skillName: string }> },
) {
  const { orgId, skillName } = await params;
  const res = await fetch(
    await kbBackendUrl(orgId, `/skills/${encodeURIComponent(skillName)}`, { withUserId: false }),
  );
  const data = await res.json().catch(() => ({ detail: '不可用' }));
  return NextResponse.json(data, { status: res.status });
}
