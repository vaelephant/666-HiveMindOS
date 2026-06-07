import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string; sourceId: string }> },
) {
  const { orgId, sourceId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/sources/${sourceId}/file`);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    return NextResponse.json({ error: text }, { status: res.status });
  }
  const blob = await res.blob();
  const headers = new Headers();
  const disposition = res.headers.get('content-disposition');
  const contentType = res.headers.get('content-type');
  if (disposition) headers.set('content-disposition', disposition);
  if (contentType) headers.set('content-type', contentType);
  return new NextResponse(blob, { status: 200, headers });
}
