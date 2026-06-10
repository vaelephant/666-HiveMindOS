'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

const LOGIN_BG_VIDEO = encodeURI('/ware.mp4');

export default function RegisterView() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? '注册失败');
        setSubmitting(false);
        return;
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('账号已创建，但自动登录失败，请手动登录');
        setSubmitting(false);
        router.push('/auth/login');
        return;
      }

      router.push('/home');
      router.refresh();
    } catch {
      setError('网络异常，请稍后重试');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-col lg:flex-row">
      <AuthBrandPanel
        kicker="HiveMind OS"
        title="企业自动执行系统"
        description="说出业务目标，系统自动规划、执行、复盘——复杂流程跑通，交付物落地，执行路径持续沉淀为组织经验。"
      />

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <video
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden
        >
          <source src={LOGIN_BG_VIDEO} type="video/mp4" />
        </video>
        <div
          className="absolute inset-0 bg-gradient-to-t from-auth-deep/90 via-auth-mid/60 to-auth-accent/20"
          aria-hidden
        />

        <div className="relative z-10 w-full max-w-[400px] rounded-2xl border border-brand-primary/30 bg-auth-deep/45 p-8 shadow-2xl shadow-brand-primary/10 backdrop-blur-md">
          <h1 className="text-xl font text-white tracking-tight">注册账号</h1>
          <p className="mt-1 text-[13px] font-medium text-shell-muted">使用邮箱注册，仅需设置一次密码</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-shell-muted">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full py-3 pl-10 pr-4 text-[14px] font-medium text-white"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-shell-muted">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted" />
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full py-3 pl-10 pr-11 text-[14px] font-medium text-white"
                  placeholder="至少 8 位"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-shell-muted hover:bg-slate-800 hover:text-shell-subtext"
                  aria-label={showPw ? '隐藏密码' : '显示密码'}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-lg bg-red-950/50 px-3 py-2 text-[12px] font-medium text-red-300 ring-1 ring-red-900/80">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[14px] font-black shadow-lg shadow-brand-primary/25 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  创建账号
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-[12px] font-medium text-shell-muted">
            已有账号？{' '}
            <Link href="/auth/login" className="font-bold text-auth-accent-soft hover:text-brand-bright">
              去登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
