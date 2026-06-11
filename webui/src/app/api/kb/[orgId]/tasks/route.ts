import { NextResponse } from 'next/server';
import { kbBackendBase, getSessionUserId, mergeUserIntoJsonBody } from '@/lib/kb-backend';

const BACKEND = kbBackendBase();

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/tasks`, { cache: 'no-store' });
  const data = await res.json().catch(() => ({ tasks: [] }));
  return NextResponse.json(data, { status: res.status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const bodyText = await req.text();
  const merged = await mergeUserIntoJsonBody(bodyText);
  const parsed = JSON.parse(merged) as Record<string, unknown>;
  if (!parsed.constraints || typeof parsed.constraints !== 'object') {
    parsed.constraints = {};
  }
  const constraints = parsed.constraints as Record<string, unknown>;
  if (!constraints.user_id) {
    constraints.user_id = await getSessionUserId();
  }
  parsed.constraints = constraints;
  const res = await fetch(`${BACKEND}/api/v1/orgs/${orgId}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed),
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
