import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const incoming = new URL(req.url);
  const backend = new URL(await kbBackendUrl(orgId, '/memories'));
  const sourceType = incoming.searchParams.get('source_type');
  if (sourceType) backend.searchParams.set('source_type', sourceType);
  const res = await fetch(backend.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ memories: [] }));
  return NextResponse.json(data, { status: res.status });
}
