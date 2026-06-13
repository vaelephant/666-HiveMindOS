'use client';

import Link from 'next/link';
import { PLATFORM_HOME_PATH } from '@/config/navigation';
import { ModeToggle } from '@/components/mode-toggle';
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Map,
  Package,
  Shield,
  Truck,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

const serif = '[font-family:var(--font-landing-serif),Georgia,serif]';

const deckEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

const deckViewport = { once: true, margin: '-10% 0px -8% 0px' as const };

function deckTransition(duration = 0.92, delay = 0, reduced: boolean) {
  return { duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: deckEase };
}

/** Skip initial keyframes when user prefers reduced motion */
function deckInitial(reduced: boolean, state: { opacity?: number; x?: number; y?: number }) {
  return reduced ? false : state;
}

// public/ 下目前只有 ware.mp4；原 `卡车 1.mp4` 不存在会 404。
// 若放入真实卡车视频，改回对应文件名即可。
const HERO_VIDEO_SRC = encodeURI('/ware.mp4');

/** Full-bleed video with scrim; falls back to QuietField when reduced motion is requested. */
function HeroVideoBackdrop() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <QuietField />
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <video
        className="absolute inset-0 h-full min-h-full w-full min-w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
        src={HERO_VIDEO_SRC}
      />
      {/* Readability scrim + vignette */}
      <div className="absolute inset-0 bg-auth-deep/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-auth-deep/85 via-auth-deep/35 to-auth-deep/88" />
    </div>
  );
}

/** Near-flat backdrop: one soft wash, no grain or animation. */
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

export default function MarketingHome() {
  const prefersReducedMotion = useReducedMotion() === true;

  const heroList = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.14,
        delayChildren: prefersReducedMotion ? 0 : 0.12,
      },
    },
  };

  const heroLine = {
    hidden: prefersReducedMotion
      ? { opacity: 1, y: 0, x: 0 }
      : { opacity: 0, y: 32, x: -16 },
    show: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.88, ease: deckEase },
    },
  };

  const canvasLine = {
    hidden: prefersReducedMotion
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: 32 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: prefersReducedMotion ? 0 : 0.85, ease: deckEase },
    },
  };

  const canvasList = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.16,
        delayChildren: prefersReducedMotion ? 0 : 0.1,
      },
    },
  };

  return (
    <div className="min-h-[100dvh] bg-auth-deep text-zinc-100 antialiased">
      <motion.header
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-auth-deep/80 backdrop-blur-md"
        initial={deckInitial(prefersReducedMotion, { opacity: 0, y: -14 })}
        animate={{ opacity: 1, y: 0 }}
        transition={deckTransition(0.9, 0, prefersReducedMotion)}
      >
        <div className="flex h-16 w-full items-center justify-between pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-shell-panel/[0.02]">
              <Truck className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-zinc-200" strokeWidth={1.75} />
            </span>
            <span className="text-[14px] font-medium tracking-tight text-zinc-200">
              WareMind OS
            </span>
          </Link>
          <nav className="hidden items-center gap-12 text-[13px] text-zinc-500 md:flex">
            <a href="#signal" className="transition-colors hover:text-zinc-200">
              Signal
            </a>
            <a href="#canvas" className="transition-colors hover:text-zinc-200">
              Canvas
            </a>
            <a href="#enter" className="transition-colors hover:text-zinc-200">
              Enter
            </a>
          </nav>
          <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
            <ModeToggle />
            <Link
              href={PLATFORM_HOME_PATH}
              className="rounded-full bg-brand-primary/100 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-indigo-400"
            >
              AI 中台
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full px-4 py-2 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
            >
              Sign in
            </Link>
            <Link
              href="/auth/login?callbackUrl=/dashboard"
              className="rounded-full border border-white/[0.12] bg-shell-panel/[0.04] px-4 py-2 text-[13px] font-semibold text-zinc-100 transition-colors hover:bg-shell-panel/[0.08]"
            >
              仓储演示
            </Link>
          </div>
        </div>
      </motion.header>

      <main>
        <section
          id="signal"
          className="relative min-h-[100dvh] overflow-hidden pb-28 pt-28 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] sm:pl-8 sm:pr-8 md:pb-36 md:pt-36 md:pl-10 md:pr-10 lg:pt-40 lg:pl-12 lg:pr-12 xl:pl-14 xl:pr-14"
        >
          <HeroVideoBackdrop />

          <div className="relative z-10 mx-auto flex w-full max-w-8xl flex-col gap-16 lg:flex-row lg:items-start lg:justify-between lg:gap-14 xl:gap-16">
            <motion.div
              className="max-w-xl lg:pt-4"
              variants={heroList}
              initial="hidden"
              animate="show"
            >
              <motion.p variants={heroLine} className="text-[12px] font-medium tracking-[0.12em] text-zinc-500">
                WAREMIND · 仓储智能
              </motion.p>

              <motion.h1
                variants={heroLine}
                className={`mt-10 text-[2.75rem] font-normal leading-[1.06] tracking-[-0.03em] text-zinc-50 sm:text-[3.25rem] lg:text-[3.75rem] ${serif}`}
              >
                Intelligent warehouse — from manual dispatch to AI decisions and execution.
              </motion.h1>

              <motion.p variants={heroLine} className="mt-10 text-[17px] font-normal leading-[1.65] text-zinc-500">
                让仓库从「人工调度」升级为「AI 自动决策 + 智能执行」的物流大脑——入库、出库、库存、设备与数据一体呈现。
              </motion.p>

              <motion.div variants={heroLine} className="mt-14 flex flex-wrap items-center gap-4 sm:gap-5">
                <Link
                  href={PLATFORM_HOME_PATH}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-shell-panel px-7 py-3 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-zinc-100"
                >
                  进入 AI 中台（数据 / 模型工厂）
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
                <Link
                  href="/auth/login?callbackUrl=/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.2] px-6 py-3 text-[14px] font-medium text-zinc-200 transition-colors hover:border-white/[0.35] hover:bg-shell-panel/[0.06]"
                >
                  WareMind 仓储演示
                </Link>
                <Link
                  href="/auth/login"
                  className="text-[14px] font-medium text-zinc-500 underline-offset-4 transition-colors hover:text-zinc-300 hover:underline"
                >
                  Authenticate
                </Link>
              </motion.div>

              <motion.dl
                variants={heroLine}
                className="mt-24 grid grid-cols-3 gap-8 border-t border-white/[0.06] pt-12 sm:max-w-lg"
              >
                {[
                  { k: 'Corridors', v: '240+' },
                  { k: 'Latency', v: '<120ms' },
                  { k: 'Target', v: '99.9%' },
                ].map((row) => (
                  <div key={row.k} className="min-w-0">
                    <dt className="text-[11px] font-medium tracking-wide text-zinc-600">{row.k}</dt>
                    <dd className={`mt-2 text-2xl font-normal tracking-tight text-zinc-100 sm:text-[1.65rem] ${serif}`}>
                      {row.v}
                    </dd>
                  </div>
                ))}
              </motion.dl>
            </motion.div>

            <motion.div
              initial={deckInitial(prefersReducedMotion, { opacity: 0, x: 40, y: 28 })}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={deckTransition(0.68, 0.12, prefersReducedMotion)}
              className="relative w-full max-w-lg lg:max-w-md lg:shrink-0 xl:max-w-lg lg:min-h-[380px] lg:pt-8"
            >
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950/40">
                <div className="flex items-center justify-between border-b border-white/[0.05] px-6 py-5">
                  <span className="text-[12px] font-medium text-zinc-500">Ledger</span>
                  <span className="text-[11px] text-zinc-600">demo stream</span>
                </div>
                <div className="divide-y divide-white/[0.04] px-2 py-1 font-mono text-[11px] leading-6 text-zinc-500">
                  {[
                    ['14:22:06', 'TR-8844', 'I-40 · AZ'],
                    ['14:22:01', 'TR-9012', 'Houston'],
                    ['14:21:54', 'SYS', 'route plan'],
                    ['14:21:48', 'TR-8710', 'Miami DC'],
                  ].map(([a, b, c]) => (
                    <div key={`${a}-${b}`} className="flex flex-wrap items-baseline gap-x-4 px-4 py-3.5">
                      <span className="text-zinc-600">{a}</span>
                      <span className="font-medium text-zinc-400">{b}</span>
                      <span className="text-zinc-500">{c}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/[0.05] px-6 py-6">
                  <p className={`text-[15px] leading-relaxed text-zinc-500 ${serif}`}>
                    Dispatch sees the corridor. Finance sees the proof.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section
          id="canvas"
          className="border-t border-white/[0.04] px-6 py-28 md:px-10 md:py-36 lg:px-14 lg:py-44"
        >
          <div className="mx-auto max-w-6xl">
            <motion.div
              variants={canvasList}
              initial="hidden"
              whileInView="show"
              viewport={deckViewport}
              className="flex max-w-2xl flex-col gap-8"
            >
              <motion.p variants={canvasLine} className="text-[12px] font-medium tracking-[0.12em] text-zinc-500">
                CANVAS
              </motion.p>
              <motion.h2
                variants={canvasLine}
                className={`text-[2rem] font-normal leading-[1.15] tracking-[-0.02em] text-zinc-50 sm:text-[2.35rem] ${serif}`}
              >
                Modules for the nine core flows of a modern WMS + AI.
              </motion.h2>
              <motion.p variants={canvasLine} className="max-w-md text-[16px] leading-relaxed text-zinc-500">
                主数据、入出库、库存与设备统一入口；深度在需要时出现，日常保持克制。
              </motion.p>
            </motion.div>

            <div className="mt-20 grid auto-rows-[minmax(160px,auto)] gap-6 sm:grid-cols-2 lg:mt-28 lg:grid-cols-4 lg:gap-8">
              <motion.a
                href="/slot-ai"
                initial={deckInitial(prefersReducedMotion, { opacity: 0, y: 44, x: -20 })}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={deckViewport}
                transition={deckTransition(1, 0, prefersReducedMotion)}
                className="group flex flex-col rounded-2xl border border-white/[0.06] bg-transparent p-9 transition-colors hover:border-white/[0.1] sm:col-span-2 sm:row-span-2 lg:min-h-[320px] lg:p-10"
              >
                <Map className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
                <span className="mt-10 text-[11px] font-medium tracking-wide text-zinc-600">智能库位</span>
                <h3 className={`mt-3 text-xl font-normal text-zinc-100 sm:text-2xl ${serif}`}>动线与库位推荐</h3>
                <p className="mt-4 max-w-sm flex-1 text-[14px] leading-relaxed text-zinc-500">
                  综合尺寸、重量、周转与热销度，输出可下发的库位与拣货顺序。
                </p>
                <span className="mt-10 inline-flex items-center gap-1 text-[13px] font-medium text-zinc-400">
                  Explore
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </motion.a>

              {[
                {
                  href: '/inventory',
                  icon: Truck,
                  tag: '实时',
                  title: '库存态势',
                  body: '库区级别的在库与告警视图。',
                },
                {
                  href: '/stocktake',
                  icon: ClipboardCheck,
                  tag: '盘点',
                  title: '差异闭环',
                  body: '复盘、冻结与账务修正链路。',
                },
                {
                  href: '/analytics',
                  icon: BarChart3,
                  tag: '分析',
                  title: '周转与风险',
                  body: '波峰、滞销与缺货预警。',
                },
                {
                  href: '/outbound',
                  icon: Package,
                  tag: '出库',
                  title: '订单与发运',
                  body: '轨迹、节点与证明链。',
                },
              ].map((item, i) => (
                <motion.a
                  key={item.title}
                  href={item.href}
                  initial={deckInitial(prefersReducedMotion, {
                    opacity: 0,
                    y: 40,
                    x: i % 2 === 0 ? -12 : 12,
                  })}
                  whileInView={{ opacity: 1, y: 0, x: 0 }}
                  viewport={deckViewport}
                  transition={deckTransition(0.88, 0.1 + i * 0.1, prefersReducedMotion)}
                  className="group flex flex-col rounded-2xl border border-white/[0.06] bg-transparent p-8 transition-colors hover:border-white/[0.1] lg:p-9"
                >
                  <item.icon className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
                  <p className="mt-8 text-[11px] font-medium tracking-wide text-zinc-600">{item.tag}</p>
                  <h3 className={`mt-2 text-lg font-normal text-zinc-100 ${serif}`}>{item.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-zinc-500">{item.body}</p>
                </motion.a>
              ))}

              <motion.div
                initial={deckInitial(prefersReducedMotion, { opacity: 0, y: 44, x: 16 })}
                whileInView={{ opacity: 1, y: 0, x: 0 }}
                viewport={deckViewport}
                transition={deckTransition(1, 0.22, prefersReducedMotion)}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-transparent p-9 sm:col-span-2 lg:p-10"
              >
                <div>
                  <Shield className="h-5 w-5 text-zinc-500" strokeWidth={1.75} />
                  <h3 className={`mt-8 text-lg font-normal text-zinc-100 sm:text-xl ${serif}`}>权限与审计</h3>
                  <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-zinc-500">
                    角色化流程与操作留痕，满足仓内合规与财务对账要求。
                  </p>
                </div>
                <p className="mt-12 text-[12px] text-zinc-600">演示环境 · 可对接企业 IdP。</p>
              </motion.div>
            </div>
          </div>
        </section>

        <section
          id="enter"
          className="border-t border-white/[0.04] px-6 py-28 md:px-10 md:py-36 lg:px-14 lg:py-44"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-14 lg:flex-row lg:items-end lg:justify-between lg:gap-20">
            <motion.div
              initial={deckInitial(prefersReducedMotion, { opacity: 0, x: -32, y: 28 })}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={deckViewport}
              transition={deckTransition(1, 0, prefersReducedMotion)}
              className="max-w-lg"
            >
              <h2 className={`text-[1.85rem] font-normal tracking-[-0.02em] text-zinc-50 sm:text-[2.25rem] ${serif}`}>
                Step into the demo.
              </h2>
              <p className="mt-6 text-[16px] leading-relaxed text-zinc-500">
                No deck — the product is alive. Mock data now; your stack later.
              </p>
            </motion.div>
            <motion.div
              initial={deckInitial(prefersReducedMotion, { opacity: 0, x: 32, y: 28 })}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={deckViewport}
              transition={deckTransition(1, 0.18, prefersReducedMotion)}
              className="flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-full border border-white/[0.1] bg-zinc-100 px-9 py-3.5 text-[14px] font-semibold text-zinc-950 transition-colors hover:bg-shell-panel"
              >
                Sign in
              </Link>
              <Link
                href={PLATFORM_HOME_PATH}
                className="inline-flex items-center justify-center rounded-full px-9 py-3.5 text-[14px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
              >
                AI 中台 →
              </Link>
              <Link
                href="/auth/login?callbackUrl=/dashboard"
                className="inline-flex items-center justify-center rounded-full px-9 py-3.5 text-[14px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
              >
                仓储演示 →
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <motion.footer
        className="border-t border-white/[0.04] px-6 py-16 md:px-10 lg:px-14"
        initial={deckInitial(prefersReducedMotion, { opacity: 0, y: 20 })}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={deckViewport}
        transition={deckTransition(0.88, 0, prefersReducedMotion)}
      >
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3 text-[13px] text-zinc-500">
            <Truck className="h-4 w-4 text-zinc-600" strokeWidth={1.75} />
            <span className="text-zinc-400">WareMind OS</span>
            <span className="text-zinc-700">·</span>
            <span>仓储指挥中心</span>
          </div>
          <p className="text-[12px] text-zinc-600">
            © {new Date().getFullYear()} · demonstration
          </p>
        </div>
      </motion.footer>
    </div>
  );
}
