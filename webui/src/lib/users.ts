import 'server-only';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

export function slugifyOrgId(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `u-${base || 'user'}-${suffix}`;
}

export async function createUser(input: { email: string; password: string }) {
  const email = input.email.toLowerCase().trim();

  if (!isValidEmail(email)) {
    throw new Error('邮箱格式不正确');
  }
  if (input.password.length < 8) {
    throw new Error('密码至少 8 位');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('该邮箱已注册');
  }

  const localPart = email.split('@')[0] ?? '';
  let orgId = slugifyOrgId(localPart || 'user');
  for (let i = 0; i < 5; i += 1) {
    const clash = await prisma.user.findUnique({ where: { orgId } });
    if (!clash) break;
    orgId = slugifyOrgId(localPart);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.create({
    data: {
      name: localPart || null,
      email,
      passwordHash,
      orgId,
      role: 'user',
    },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true,
      createdAt: true,
    },
  });
}
