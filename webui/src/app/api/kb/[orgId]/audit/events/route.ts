import { NextResponse } from 'next/server';
import { kbBackendUrl } from '@/lib/kb-backend';
import { prisma } from '@/lib/prisma';

type BackendAuditEvent = {
  user_id?: string | null;
  [key: string]: unknown;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const url = new URL(req.url);
  const searchParams = new URLSearchParams();
  for (const key of ['days', 'category', 'action', 'limit', 'offset', 'q', 'status']) {
    const value = url.searchParams.get(key);
    if (value != null) searchParams.set(key, value);
  }
  const backend = await kbBackendUrl(orgId, '/audit/events', { searchParams });
  const res = await fetch(backend);
  const data = await res.json().catch(() => ({ detail: '审计日志不可用' }));
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const events = (data.events ?? []) as BackendAuditEvent[];
  const userIds = [...new Set(events.map((e) => e.user_id).filter(Boolean))] as string[];

  let userMap = new Map<string, { name: string | null; email: string }>();
  if (userIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    userMap = new Map(users.map((u) => [u.id, { name: u.name, email: u.email }]));
  }

  const enriched = events.map((ev) => {
    const uid = ev.user_id;
    const profile = uid ? userMap.get(uid) : undefined;
    return {
      ...ev,
      user_name: profile?.name ?? null,
      user_email: profile?.email ?? null,
    };
  });

  return NextResponse.json({ ...data, events: enriched });
}
