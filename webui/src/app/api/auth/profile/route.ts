import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 64) : undefined;
  if (name === undefined) {
    return NextResponse.json({ error: '请提供 name 字段' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name || null },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user });
}
