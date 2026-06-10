'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { LogOut, UserCircle } from 'lucide-react';
import { useOrgId } from '@/components/auth/OrgProvider';

type SidebarUserProps = {
  collapsed?: boolean;
};

function userInitial(name: string, email?: string | null): string {
  const seed = name || email || 'U';
  return seed.charAt(0).toUpperCase();
}

export function SidebarUser({ collapsed = false }: SidebarUserProps) {
  const { data: session, status } = useSession();
  const orgId = useOrgId();

  if (status === 'loading') {
    return (
      <div
        className={`rounded-xl border border-shell-border-dim bg-shell-panel-hover/60 ${
          collapsed ? 'flex justify-center p-2' : 'p-2.5'
        }`}
      >
        <div className="h-8 w-8 animate-pulse rounded-full bg-shell-border" />
      </div>
    );
  }

  if (status !== 'authenticated' || !session?.user) {
    return (
      <Link
        href="/auth/login"
        title="登录"
        className={`flex items-center rounded-xl border border-shell-border-dim bg-shell-panel-hover/60 text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text ${
          collapsed ? 'justify-center p-2' : 'gap-3 p-2.5'
        }`}
      >
        <UserCircle className="h-5 w-5 shrink-0" />
        {!collapsed ? <span className="text-[12px] font-medium">登录</span> : null}
      </Link>
    );
  }

  const label = session.user.name || session.user.email?.split('@')[0] || '用户';
  const email = session.user.email ?? '';
  const initial = userInitial(label, email);

  return (
    <div
      className={`flex items-center rounded-xl border border-shell-border-dim bg-shell-panel-hover/60 ${
        collapsed ? 'justify-center p-2' : 'gap-2 p-2'
      }`}
    >
      <Link
        href="/account"
        title={collapsed ? label : undefined}
        className={`flex min-w-0 items-center transition-opacity hover:opacity-90 ${
          collapsed ? '' : 'flex-1 gap-2.5'
        }`}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-dim text-[13px] font-bold text-brand-on-primary shadow-sm shadow-brand-primary/20">
          {initial}
        </div>
        {!collapsed ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-shell-text">{label}</p>
            <p className="truncate text-[10px] text-shell-muted">{email || orgId}</p>
          </div>
        ) : null}
      </Link>
      {!collapsed ? (
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="shrink-0 rounded-lg p-1.5 text-shell-muted transition-colors hover:bg-shell-bg hover:text-shell-text"
          title="退出登录"
        >
          <LogOut className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
