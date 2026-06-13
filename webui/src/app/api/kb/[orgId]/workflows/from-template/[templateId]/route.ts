import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> },
) {
  const { orgId, templateId } = await params;
  const backend = await kbBackendUrl(orgId, `/workflows/from-template/${templateId}`);
  const res = await fetch(backend, { method: 'POST' });
  const data = await res.json().catch(() => ({ detail: '创建失败' }));
  return NextResponse.json(data, { status: res.status });
}
