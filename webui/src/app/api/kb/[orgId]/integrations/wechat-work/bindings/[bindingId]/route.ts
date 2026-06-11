import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; bindingId: string }> },
) {
  const { orgId, bindingId } = await params;
  const res = await fetch(
    await kbBackendUrl(orgId, `/integrations/wechat-work/bindings/${bindingId}`, { withUserId: false }),
    { method: 'DELETE' },
  );
  const data = await res.json().catch(() => ({ ok: false }));
  return NextResponse.json(data, { status: res.status });
}
