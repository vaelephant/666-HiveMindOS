import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/sources`);
  const data = await res.json().catch(() => ({ sources: [] }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const contentType = req.headers.get('content-type');
  if (!contentType?.includes('multipart/form-data')) {
    return NextResponse.json({ error: '需要 multipart/form-data' }, { status: 400 });
  }

  const headers: Record<string, string> = { 'content-type': contentType };
  const contentLength = req.headers.get('content-length');
  if (contentLength) headers['content-length'] = contentLength;

  // 流式透传，避免 Next.js 解析/缓冲整个 FormData（大 PDF 会被截断）
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/sources`, {
    method: 'POST',
    headers,
    body: req.body,
    // Node fetch 流式上传需要 duplex
    duplex: 'half',
  } as RequestInit);
  const data = await res.json().catch(() => ({ error: 'upload failed' }));
  return NextResponse.json(data, { status: res.status });
}
