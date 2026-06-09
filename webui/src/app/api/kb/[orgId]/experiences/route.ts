import { NextResponse } from 'next/server';

const BACKEND = process.env.KB_API_BASE_URL ?? 'http://localhost:8000';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(`${BACKEND}/api/v1/orgs/${orgId}/experiences`);
  const taskType = req.nextUrl.searchParams.get('task_type');
  const limit = req.nextUrl.searchParams.get('limit');
  if (taskType) url.searchParams.set('task_type', taskType);
  if (limit) url.searchParams.set('limit', limit);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  const data = await res.json().catch(() => ({ experiences: [] }));
  return NextResponse.json(data, { status: res.status });
}
