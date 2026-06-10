'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { LogOut, UserCircle } from 'lucide-react';
import { useOrgId } from '@/components/auth/OrgProvider';

export function UserMenu() {
  const { data: session, status } = useSession();
  const orgId = useOrgId();

  if (status !== 'authenticated' || !session?.user) {
    return (
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-2.5 py-1.5 text-[11px] font-medium text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text"
      >
        <UserCircle className="h-4 w-4" />
        登录
      </Link>
    );
  }

  const label = session.user.name || session.user.email || '用户';

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account"
        className="hidden max-w-[140px] truncate text-right text-[11px] leading-tight transition-colors hover:text-brand-primary sm:block"
        title={`${label} · org: ${orgId}`}
      >
        <p className="font-semibold text-shell-text">{label}</p>
        <p className="font-mono text-[10px] text-shell-muted">{orgId}</p>
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/auth/login' })}
        className="inline-flex items-center gap-1 rounded-lg border border-shell-border px-2 py-1.5 text-[11px] font-medium text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text"
        title="退出登录"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">退出</span>
      </button>
    </div>
  );
}
