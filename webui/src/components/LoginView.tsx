'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Lock, Mail, Warehouse, ArrowRight, Loader2 } from 'lucide-react';
import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

/** Background video from /public (URL-encoded for non-ASCII filename) */
const LOGIN_BG_VIDEO = encodeURI('/ware.mp4');

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/home';
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
      if (!email.trim() || !password) {
        setError('请输入邮箱和密码');
        setSubmitting(false);
        return;
      }

      const result = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('邮箱或密码错误');
        setSubmitting(false);
        return;
      }

      router.push(callbackUrl.startsWith('/') ? callbackUrl : '/home');
      router.refresh();
    } catch {
      setError('登录失败，请稍后重试');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-col lg:flex-row">
      <AuthBrandPanel
        brand="HiveMind OS"
        kicker="欢迎回来"
        title="企业自动执行系统"
        description="说出业务目标，系统自动规划、执行、复盘——你定方向，复杂流程跑通，交付物持续落地。"
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

        <div className="relative z-10 flex w-full flex-col items-center">
          <div className="mb-8 flex w-full max-w-[400px] items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/25 ring-1 ring-white/20">
              <Warehouse className="h-5 w-5 text-auth-accent-soft" strokeWidth={2.25} />
            </div>
            <span className="text-lg font-black text-white">WareMind OS</span>
          </div>

          <div className="w-full max-w-[400px] rounded-2xl border border-brand-primary/30 bg-auth-deep/45 p-8 shadow-2xl shadow-brand-primary/10 backdrop-blur-md">
          <h1 className="text-xl font text-white tracking-tight">登录</h1>
          <p className="mt-1 text-[13px] font-medium text-shell-muted">
            使用注册邮箱登录 HiveMind OS
          </p>

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
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wider text-shell-muted">
                  密码
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted" />
                <input
                  id="password"
                  name="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full py-3 pl-10 pr-11 text-[14px] font-medium text-white"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-shell-muted hover:bg-slate-800 hover:text-shell-subtext"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
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
                  登录
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[12px] font-medium text-shell-muted">
            还没有账号？{' '}
            <Link href="/auth/register" className="font-bold text-auth-accent-soft hover:text-brand-bright">
              立即注册
            </Link>
            {' · '}
            <Link href="/auth/invite" className="font-bold text-auth-accent-soft hover:text-brand-bright">
              了解产品
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  );
}
