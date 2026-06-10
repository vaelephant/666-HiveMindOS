import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { AccountView } from '@/components/auth/AccountView';

export const metadata: Metadata = {
  title: '账户 · HiveMind OS',
  description: '查看与管理你的 HiveMind OS 账户信息。',
};

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/login?callbackUrl=/account');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      orgId: true,
      role: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect('/auth/login');
  }

  return <AccountView user={user} />;
}
