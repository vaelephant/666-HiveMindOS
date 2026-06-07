'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Warehouse, ArrowRight, Loader2 } from 'lucide-react';

/** Background video from /public (URL-encoded for non-ASCII filename) */
const LOGIN_BG_VIDEO = encodeURI('/ware.mp4');

export default function LoginView() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // Demo: no backend — accept any non-empty and go to dashboard
      await new Promise((r) => setTimeout(r, 650));
      if (!username.trim() || !password) {
        setError('Please enter username and password.');
        setSubmitting(false);
        return;
      }
      router.push('/dashboard');
    } catch {
      setError('Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen min-h-[100dvh] flex-col lg:flex-row">
      <div className="relative hidden w-1/2 flex-col justify-between bg-gradient-to-br from-auth-deep via-auth-mid to-shell-panel p-12 lg:flex">
        <div className="flex items-center gap-3">
        
          <div>
            <p className="text-sm font tracking-tight text-white">WareMind</p>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-auth-accent-soft/80">
             管理仓库更简单
            </p>
          </div>
        </div>
        <div className="w-full min-w-0 space-y-4">
          <h2 className="whitespace-nowrap text-3xl font leading-tight tracking-tight text-white">
            管理仓库更简单，一眼看清入出库与库存。
          </h2>
          <p className="text-sm font-medium leading-relaxed text-shell-subtext">
            主数据、波次、设备与 AI 决策同屏协作——演示环境一键进入。
          </p>
        </div>
        <p className="text-[11px] font-medium text-white/35">
          © {new Date().getFullYear()} WareMind · 演示登录
        </p>
      </div>

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
          <h1 className="text-xl font text-white tracking-tight">Sign in</h1>
          <p className="mt-1 text-[13px] font-medium text-shell-muted">
            Demo defaults: <span className="font-mono text-shell-subtext">admin / admin</span>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-shell-muted">
                Username
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input-field w-full py-3 pl-10 pr-4 text-[14px] font-medium text-white"
                  placeholder="admin"
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="text-[11px] font-bold uppercase tracking-wider text-shell-muted">
                  Password
                </label>
                <button
                  type="button"
                  className="text-[11px] font-bold text-auth-accent-soft hover:text-brand-bright"
                  onClick={() => {}}
                >
                  Forgot?
                </button>
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
                  placeholder="admin"
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
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[12px] font-medium text-shell-muted">
            想了解产品？{' '}
            <Link href="/auth/invite" className="font-bold text-auth-accent-soft hover:text-brand-bright">
              查看推广页
            </Link>
          </p>
          </div>

          <Link
            href="/dashboard"
            className="mt-8 text-[12px] font-bold text-shell-muted underline-offset-4 hover:text-white hover:underline"
          >
            Skip sign-in (demo) →
          </Link>
        </div>
      </div>
    </div>
  );
}
