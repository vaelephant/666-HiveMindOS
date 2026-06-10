'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Map,
  Shield,
  Truck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

const serif = '[font-family:var(--font-landing-serif),Georgia,serif]';

const HERO_VIDEO_SRC = `/${encodeURIComponent('卡车 1.mp4')}`;

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

function QuietField() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute -top-1/2 left-1/2 h-[85%] w-[min(120%,56rem)] -translate-x-1/2 rounded-full opacity-[0.14] blur-[100px]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.35), transparent 62%)',
        }}
      />
    </div>
  );
}

function HeroBackdrop({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
        <div className="absolute inset-0 bg-auth-deep" />
        <QuietField />
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      <video
        className="absolute inset-0 h-full min-h-full w-full min-w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        tabIndex={-1}
        src={HERO_VIDEO_SRC}
      />
      <div className="absolute inset-0 bg-auth-deep/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-auth-deep/85 via-auth-deep/35 to-auth-deep/88" />
    </div>
  );
}

export default function InvitePromoView() {
  const prefersReducedMotion = useReducedMotion() === true;

  return (
    <div className="relative min-h-[100dvh]">
      <HeroBackdrop reducedMotion={prefersReducedMotion} />

      <header className="relative z-10 border-b border-white/[0.04] bg-auth-deep/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 md:px-10">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-shell-panel/[0.02]">
              <Truck className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-200" strokeWidth={1.75} />
            </span>
            <span className="text-[14px] font-medium tracking-tight text-zinc-200">WareMind OS</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
            >
              首页
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
            >
              登录
            </Link>
            <Link
              href="/auth/login?callbackUrl=/dashboard"
              className="rounded-full bg-zinc-100 px-5 py-2 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-shell-panel"
            >
              演示
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 md:px-10 md:pb-32 md:pt-24">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.65, ease }}
          className="max-w-2xl"
        >
          <p className="text-[12px] font-medium tracking-[0.12em] text-zinc-500">产品与推广</p>

          <h1
            className={`mt-10 text-balance text-[2.25rem] font leading-[1.12] tracking-[-0.03em] text-zinc-50 sm:text-[2.75rem] md:text-[3.15rem] ${serif}`}
          >
            WareMind OS：AI 驱动的物流仓库大脑，让执行更省事
          </h1>

          <p className="mt-10 text-pretty text-[17px] font-normal leading-[1.65] text-zinc-500">
            WareMind 把基础主数据、入出库、实时库存、设备与数据分析放进同一控制台，辅以 WareBrain 做补货预测、拣货路径、异常洞察与日报。以下为能力切片；可打开控制台走通演示链路。
          </p>

          <div className="mt-14 flex flex-wrap items-center gap-5">
            <Link
              href="/auth/login?callbackUrl=/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-shell-panel px-7 py-3 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
            >
              打开控制台
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link
              href="/auth/login"
              className="text-[14px] font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
            >
              已有账号，去登录
            </Link>
          </div>
        </motion.div>

        <motion.ul
          initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, delay: prefersReducedMotion ? 0 : 0.08, ease }}
          className="mt-24 grid gap-6 sm:grid-cols-2 lg:mt-28 lg:grid-cols-4 lg:gap-8"
        >
          {[
            {
              icon: Map,
              tag: '库位',
              title: '智能库位推荐',
              desc: '按尺寸、重量、周转率与热销度输出动线与垛位。',
            },
            {
              icon: Truck,
              tag: '库存',
              title: '实时库内态势',
              desc: '在库 SKU、巷道占用与告警一屏可读。',
            },
            {
              icon: ClipboardCheck,
              tag: '盘点',
              title: '差异闭环',
              desc: '扫码盘点、分析与库存修正可追溯。',
            },
            {
              icon: BarChart3,
              tag: '分析',
              title: '运营与预测',
              desc: '周转、滞销与波峰复盘，对齐周会与 KPI。',
            },
          ].map(({ icon: Icon, tag, title, desc }) => (
            <li
              key={title}
              className="flex flex-col rounded-2xl border border-white/[0.06] bg-transparent p-8 transition-colors lg:p-9"
            >
              <Icon className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
              <p className="mt-8 text-[11px] font-medium tracking-wide text-zinc-600">{tag}</p>
              <h2 className={`mt-2 text-lg font-normal text-zinc-100 ${serif}`}>{title}</h2>
              <p className="mt-2 flex-1 text-[13px] leading-relaxed text-zinc-500">{desc}</p>
            </li>
          ))}
        </motion.ul>

        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.55, delay: prefersReducedMotion ? 0 : 0.12, ease }}
          className="mt-16 rounded-2xl border border-white/[0.06] bg-zinc-950/40 p-8 sm:p-10 md:flex md:items-start md:justify-between md:gap-10"
        >
          <div className="flex gap-4 md:max-w-xl">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-shell-panel/[0.02]">
              <Shield className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className={`text-xl font-normal text-zinc-100 ${serif}`}>售前与渠道 brief</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-zinc-500">
                为客户或合作伙伴快速对齐能力边界时，可直接分享本页；演示环境与正式权限仍可分开管控。
              </p>
            </div>
          </div>
          <Link
            href="/auth/login?callbackUrl=/dashboard"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-shell-panel px-6 py-2.5 text-[13px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-100 md:mt-0 md:shrink-0"
          >
            进入演示
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        </motion.section>

        <p className="mt-20 text-center text-[11px] font-medium text-zinc-600">
          © {new Date().getFullYear()} WareMind OS
        </p>
      </main>
    </div>
  );
}
