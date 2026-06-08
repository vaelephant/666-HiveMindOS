import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bot,
  Box,
  ClipboardList,
  Database,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Network,
  Rocket,
  Sparkles,
  Tags,
  Wrench,
} from 'lucide-react';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import PlatformHomeFlowAnimation from '@/components/platform/PlatformHomeFlowAnimation';

const STATS = [
  { label: '数据集与版本', value: '128', unit: '套', hint: '本周 +6' },
  { label: '标注任务队列', value: '2.4', unit: '万条', hint: '待质检 312' },
  { label: '训练作业', value: '14', unit: '进行中', hint: 'GPU 占用 62%' },
  { label: '推理 QPS（峰值）', value: '3.8', unit: 'k', hint: '近 24h 稳定' },
] as const;

const QUICK_LINKS: {
  href: string;
  label: string;
  desc: string;
  icon: typeof Wrench;
  factory: string;
}[] = [
  { href: HIVEMIND_HOME_PATH, label: 'Chat', desc: '企业知识问答，答案带出处', icon: MessageSquare, factory: 'HiveMind' },
  { href: '/agent-tasks', label: '分析任务', desc: '多步骤分析与报告', icon: Bot, factory: 'HiveMind' },
  { href: '/data/workshop', label: '数据工坊', desc: '清洗、转换与特征', icon: Wrench, factory: '数据工厂' },
  { href: '/data/center', label: '数据中心', desc: '资产目录与血缘', icon: Database, factory: '数据工厂' },
  { href: '/annotation/overview', label: '标注中心', desc: '场景、项目与任务', icon: Tags, factory: '数据工厂' },
  { href: '/training', label: '训练中心', desc: '作业与实验', icon: GraduationCap, factory: '模型工厂' },
  { href: '/models', label: '模型中心', desc: '版本与制品', icon: Box, factory: '模型工厂' },
  { href: '/evaluation', label: '评测中心', desc: '基准与报告', icon: ClipboardList, factory: '模型工厂' },
  { href: '/inference', label: '推理服务', desc: '部署与路由', icon: Rocket, factory: '模型工厂' },
  { href: IPFS_MONITOR_BASE_PATH, label: 'IPFS 监控', desc: '节点与带宽', icon: Network, factory: '平台' },
];

const RECENT = [
  { time: '10 分钟前', title: '数据集 ingest-job-7f3a 写入完成', tag: '数据' },
  { time: '32 分钟前', title: '评测任务 eval-bert-v2 已通过阈值', tag: '评测' },
  { time: '1 小时前', title: '训练 trial-19 学习率调度已切换', tag: '训练' },
  { time: '2 小时前', title: '镜像中心同步 registry/core:v1.4.2', tag: '镜像' },
] as const;

const SHORTCUTS = [
  { href: '/annotation/tasks', label: '我的标注任务' },
  { href: '/registry', label: '镜像中心' },
  { href: '/resources', label: '资源中心' },
  { href: '/storage', label: '存储中心' },
  { href: '/platform', label: '平台管理' },
];

export default function PlatformHomeDashboard() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 pb-12 md:p-10">
      <header className="flex flex-col gap-6 border-b border-shell-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-shell-muted">
            DR.SEEK · 星海工作台
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-shell-text md:text-3xl">欢迎回来</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-bright">
              <Sparkles className="h-3 w-3" />
              演示环境
            </span>
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-shell-subtext">
            在一处查看数据资产、标注与模型流水线的脉搏，并快速跳转到常用模块。以下为演示数据，接入真实后端后可替换指标与动态。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <Link
            href="/annotation/scenes"
            className="inline-flex items-center gap-2 rounded-lg border border-shell-border bg-shell-panel px-4 py-2.5 text-sm font-medium text-shell-text shadow-sm transition-colors hover:bg-shell-bg"
          >
            <LayoutDashboard className="h-4 w-4 text-shell-muted" />
            浏览标注场景
          </Link>
          <Link
            href="/hologram"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dim"
          >
            能力全景
            <ArrowRight className="h-4 w-4 opacity-80" />
          </Link>
        </div>
      </header>

      <PlatformHomeFlowAnimation />

      <section aria-label="关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="relative overflow-hidden rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-shell-subtext">{s.label}</p>
            <p className="mt-3 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tabular-nums tracking-tight text-shell-text">{s.value}</span>
              <span className="text-sm font-semibold text-shell-muted">{s.unit}</span>
            </p>
            <p className="mt-2 text-[11px] font-medium text-shell-muted">{s.hint}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label="常用入口">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-shell-text">常用入口</h2>
            <span className="text-[11px] font-medium uppercase tracking-wider text-shell-muted">点击卡片跳转</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex gap-4 rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm transition-all hover:border-brand-primary/30 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-shell-bg text-brand-primary transition-colors group-hover:bg-brand-primary/10">
                  <item.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-shell-text">{item.label}</p>
                    <span className="rounded-md bg-shell-panel-hover px-1.5 py-0.5 text-[10px] font-semibold text-shell-subtext">
                      {item.factory}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-shell-muted">{item.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-shell-subtext transition-transform group-hover:translate-x-0.5 group-hover:text-brand-bright" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-6 lg:col-span-1" aria-label="动态与捷径">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-primary" />
              <h2 className="text-sm font-bold text-shell-text">最近动态</h2>
            </div>
            <ul className="space-y-3 rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
              {RECENT.map((row) => (
                <li key={row.title} className="border-b border-shell-border-dim pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-shell-panel-hover px-1.5 py-0.5 text-[10px] font-semibold text-shell-subtext">
                      {row.tag}
                    </span>
                    <span className="text-[10px] font-medium text-shell-muted">{row.time}</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-snug text-shell-text">{row.title}</p>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-bold text-shell-text">更多捷径</h2>
            <nav className="flex flex-col gap-1 rounded-2xl border border-shell-border bg-shell-bg/80 p-2">
              {SHORTCUTS.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium text-shell-subtext transition-colors hover:bg-shell-panel hover:text-shell-text hover:shadow-sm"
                >
                  {s.label}
                  <ArrowRight className="h-3.5 w-3.5 text-shell-muted" />
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      </div>
    </div>
  );
}
