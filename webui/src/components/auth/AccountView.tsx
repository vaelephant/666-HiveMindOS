'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { BarChart3, Box, Check, Loader2, LogOut, Pencil, Shield, User, X } from 'lucide-react';
import { ModelSettings } from '@/components/auth/model-settings';
import { TokenUsageStats } from '@/components/auth/token-usage-stats';
import { cn } from '@/lib/utils';

type AccountUser = {
  id: string;
  name: string | null;
  email: string;
  orgId: string;
  role: string;
  createdAt: string | Date;
};

type SectionId = 'profile' | 'models' | 'usage';

const sections: { id: SectionId; label: string }[] = [
  { id: 'profile', label: '账户信息' },
  { id: 'models', label: '模型设置' },
  { id: 'usage', label: '使用统计' },
];

export function AccountView({ user: initialUser }: { user: AccountUser }) {
  const [active, setActive] = useState<SectionId>('profile');
  const [user, setUser] = useState(initialUser);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initialUser.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const created =
    user.createdAt instanceof Date
      ? user.createdAt.toLocaleDateString('zh-CN')
      : new Date(user.createdAt).toLocaleDateString('zh-CN');

  async function saveName() {
    setSavingName(true);
    setNameError(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? '保存失败');
      setUser((u) => ({ ...u, name: data.user?.name ?? (nameDraft.trim() || null) }));
      setEditingName(false);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingName(false);
    }
  }

  return (
    <div className="w-full py-6 md:py-8">
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <User className="size-6 text-brand-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">账户</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                个人中心
              </h1>
            </div>
          </div>
          {active === 'profile' ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/auth/login' })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-shell-border px-3 py-2 text-[12px] font-medium text-shell-muted transition-colors hover:text-shell-text"
            >
              <LogOut className="size-3.5" />
              退出登录
            </button>
          ) : null}
        </div>

        <nav className="mt-5 flex flex-wrap gap-1 border-t border-shell-border pt-4" aria-label="个人中心分区">
          {sections.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  on
                    ? 'bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/20'
                    : 'text-shell-muted hover:bg-shell-panel-hover hover:text-shell-text',
                )}
              >
                {s.id === 'usage' ? (
                  <BarChart3 className="size-3.5" />
                ) : s.id === 'models' ? (
                  <Box className="size-3.5" />
                ) : (
                  <User className="size-3.5" />
                )}
                {s.label}
              </button>
            );
          })}
        </nav>
      </header>

      {active === 'profile' ? (
        <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8 text-brand-primary">
              <span className="text-[15px] font-bold">
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    placeholder="显示名称"
                    maxLength={64}
                    className="min-w-[200px] rounded-lg border border-shell-border bg-shell-bg px-3 py-1.5 text-[14px] text-shell-text focus:border-brand-primary/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={savingName}
                    onClick={() => void saveName()}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                  >
                    {savingName ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                    保存
                  </button>
                  <button
                    type="button"
                    disabled={savingName}
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(user.name ?? '');
                      setNameError(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-shell-border px-2.5 py-1.5 text-[12px] text-shell-muted"
                  >
                    <X className="size-3.5" />
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-[16px] font-semibold text-shell-text">{user.name || '未设置姓名'}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(user.name ?? '');
                      setEditingName(true);
                    }}
                    className="rounded-md p-1 text-shell-muted hover:bg-shell-bg hover:text-brand-primary"
                    aria-label="编辑姓名"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                </div>
              )}
              {nameError && <p className="mt-1 text-[12px] text-red-600">{nameError}</p>}
              <p className="mt-0.5 text-[13px] text-shell-muted">{user.email}</p>
              <p className="mt-1 text-[11px] text-shell-muted">姓名会显示在审计日志等处的「操作人」字段</p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3 border-t border-shell-border pt-5 sm:grid-cols-2">
            <div className="rounded-xl border border-shell-border bg-shell-bg/60 px-4 py-3">
              <dt className="text-[11px] font-medium text-shell-muted">用户 ID</dt>
              <dd className="mt-1 break-all font-mono text-[12px] text-shell-subtext">{user.id}</dd>
            </div>
            <div className="rounded-xl border border-shell-border bg-shell-bg/60 px-4 py-3">
              <dt className="text-[11px] font-medium text-shell-muted">数据空间 org</dt>
              <dd className="mt-1 break-all font-mono text-[12px] text-shell-subtext">{user.orgId}</dd>
            </div>
            <div className="rounded-xl border border-shell-border bg-shell-bg/60 px-4 py-3">
              <dt className="text-[11px] font-medium text-shell-muted">角色</dt>
              <dd className="mt-1 inline-flex items-center gap-1.5 text-[13px] text-shell-text">
                <Shield className="size-3.5 text-shell-muted" />
                {user.role}
              </dd>
            </div>
            <div className="rounded-xl border border-shell-border bg-shell-bg/60 px-4 py-3">
              <dt className="text-[11px] font-medium text-shell-muted">注册时间</dt>
              <dd className="mt-1 text-[13px] text-shell-text">{created}</dd>
            </div>
          </dl>

          <p className="mt-5 rounded-xl bg-brand-primary/5 px-4 py-3 text-[12px] leading-relaxed text-shell-muted">
            Chat 会话、智慧记忆、候选池等数据均按 <span className="font-mono text-shell-subtext">org_id</span> 与{' '}
            <span className="font-mono text-shell-subtext">user_id</span> 隔离；切换账号后只会看到自己的内容。
          </p>
        </section>
      ) : active === 'models' ? (
        <ModelSettings />
      ) : (
        <TokenUsageStats />
      )}
    </div>
  );
}
