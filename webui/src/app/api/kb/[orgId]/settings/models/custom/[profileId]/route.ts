import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; profileId: string }> },
) {
  const { orgId, profileId } = await params;
  const res = await fetch(
    await kbBackendUrl(orgId, `/settings/models/custom/${encodeURIComponent(profileId)}`),
    { method: 'DELETE' },
  );
  const data = await res.json().catch(() => ({ detail: '删除失败' }));
  return NextResponse.json(data, { status: res.status });
}
