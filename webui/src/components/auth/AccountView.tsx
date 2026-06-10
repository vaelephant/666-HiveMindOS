'use client';

import { signOut } from 'next-auth/react';
import { LogOut, Shield, User } from 'lucide-react';

type AccountUser = {
  id: string;
  name: string | null;
  email: string;
  orgId: string;
  role: string;
  createdAt: string | Date;
};

export function AccountView({ user }: { user: AccountUser }) {
  const created =
    user.createdAt instanceof Date
      ? user.createdAt.toLocaleDateString('zh-CN')
      : new Date(user.createdAt).toLocaleDateString('zh-CN');

  return (
    <div className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-shell-text">账户</h1>
        <p className="mt-1 text-sm text-shell-muted">你的登录身份与数据工作空间（org）信息</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-shell-border bg-shell-panel/60 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-shell-text">{user.name || '未设置姓名'}</p>
            <p className="text-sm text-shell-muted">{user.email}</p>
          </div>
        </div>

        <dl className="grid gap-3 border-t border-shell-border pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-shell-muted">用户 ID</dt>
            <dd className="font-mono text-xs text-shell-subtext">{user.id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-shell-muted">数据空间 org</dt>
            <dd className="font-mono text-xs text-shell-subtext">{user.orgId}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-shell-muted">角色</dt>
            <dd className="inline-flex items-center gap-1 text-shell-text">
              <Shield className="h-3.5 w-3.5 text-shell-muted" />
              {user.role}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-shell-muted">注册时间</dt>
            <dd className="text-shell-text">{created}</dd>
          </div>
        </dl>

        <p className="border-t border-shell-border pt-4 text-xs leading-relaxed text-shell-muted">
          Chat 会话、智慧记忆、候选池等数据均按 <span className="font-mono">org_id</span> 与{' '}
          <span className="font-mono">user_id</span> 隔离；切换账号后只会看到自己的内容。
        </p>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
          className="inline-flex items-center gap-2 rounded-xl border border-shell-border px-4 py-2 text-sm font-medium text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>
    </div>
  );
}
