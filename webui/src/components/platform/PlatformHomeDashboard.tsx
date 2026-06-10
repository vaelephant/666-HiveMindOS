'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  Brain,
  ClipboardList,
  Loader2,
  MessageSquare,
  Network,
  Rocket,
  Sparkles,
} from 'lucide-react';
import { HIVEMIND_HOME_PATH, KB_BASE_PATH } from '@/config/navigation';
import PlatformHomeFlowAnimation from '@/components/platform/PlatformHomeFlowAnimation';
import { getOverviewData, listTasks } from '@/lib/kb-api';
import type { ActivityRecord, AgentTask, OverviewData } from '@/lib/kb-types';

const QUICK_LINKS = [
  {
    href: '/tasks/agent',
    label: '自主任务',
    desc: '说出目标，系统自动规划并执行',
    icon: Bot,
  },
  {
    href: HIVEMIND_HOME_PATH,
    label: 'HiveMind Chat',
    desc: '带知识出处的企业对话',
    icon: MessageSquare,
  },
  {
    href: '/memories',
    label: '智慧进化',
    desc: '从对话提炼的可复用智慧',
    icon: Brain,
  },
  {
    href: `${KB_BASE_PATH}/wiki`,
    label: '知识 Wiki',
    desc: '结构化文档与实体图谱',
    icon: BookOpen,
  },
  {
    href: `${KB_BASE_PATH}/overview`,
    label: '知识概览',
    desc: '资料、候选池与编译动态',
    icon: Network,
  },
  {
    href: '/tasks/ops',
    label: '定时运维',
    desc: '自动化巡检与批处理任务',
    icon: ClipboardList,
  },
] as const;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function activityTitle(item: ActivityRecord): string {
  if (item.kind === 'chat') return item.title || '新对话';
  if (item.kind === 'memory') return item.memory_title;
  if (item.kind === 'candidate') return item.title;
  return item.filename;
}

function activityTag(item: ActivityRecord): string {
  if (item.kind === 'chat') return '对话';
  if (item.kind === 'memory') return '智慧';
  if (item.kind === 'candidate') return '候选';
  return '资料';
}

type StatCard = {
  label: string;
  value: string;
  unit: string;
  hint: string;
  accent?: boolean;
};

function buildStats(overview: OverviewData | null, tasks: AgentTask[]): StatCard[] {
  const s = overview?.stats;
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const done = tasks.filter((t) => t.status === 'done').length;

  return [
    {
      label: '进行中任务',
      value: String(running + pending),
      unit: '个',
      hint: running > 0 ? `${running} 个正在执行` : pending > 0 ? `${pending} 个排队中` : '暂无活跃任务',
      accent: running > 0,
    },
    {
      label: '已完成任务',
      value: String(done),
      unit: '个',
      hint: '累计交付',
    },
    {
      label: '智慧沉淀',
      value: String(s?.memory_count ?? 0),
      unit: '条',
      hint: (s?.memories_week ?? 0) > 0 ? `本周 +${s?.memories_week}` : '执行后自动提取',
      accent: (s?.memories_week ?? 0) > 0,
    },
    {
      label: '对话会话',
      value: String(s?.chat_session_count ?? 0),
      unit: '个',
      hint: (s?.chat_sessions_week ?? 0) > 0 ? `本周 +${s?.chat_sessions_week}` : 'Chat 协作记录',
      accent: (s?.chat_sessions_week ?? 0) > 0,
    },
  ];
}

export default function PlatformHomeDashboard() {
  const { data: session } = useSession();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getOverviewData().catch(() => null),
      listTasks().catch(() => [] as AgentTask[]),
    ])
      .then(([ov, ts]) => {
        if (ov) setOverview(ov);
        setTasks(ts);
      })
      .finally(() => setLoading(false));
  }, []);

  const displayName =
    session?.user?.name || session?.user?.email?.split('@')[0] || '用户';

  const stats = useMemo(() => buildStats(overview, tasks), [overview, tasks]);
  const recent = overview?.recent_activity?.slice(0, 5) ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-10 p-6 pb-12 md:p-10">
      <header className="flex flex-col gap-6 border-b border-shell-border pb-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-shell-muted">
            HiveMind OS · 企业自动执行系统
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-shell-text md:text-3xl">
              你好，{displayName}
            </h1>
            {session?.user?.orgId ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-brand-bright">
                {session.user.orgId}
              </span>
            ) : null}
          </div>
          <p className="max-w-xl text-sm leading-relaxed text-shell-subtext">
            说出业务目标，系统自动规划、执行、复盘。下方是你的任务脉搏、知识沉淀与最近动态。
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          <Link
            href={HIVEMIND_HOME_PATH}
            className="inline-flex items-center gap-2 rounded-lg border border-shell-border bg-shell-panel px-4 py-2.5 text-sm font-medium text-shell-text shadow-sm transition-colors hover:bg-shell-bg"
          >
            <MessageSquare className="h-4 w-4 text-shell-muted" />
            开始对话
          </Link>
          <Link
            href="/tasks/agent"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dim"
          >
            <Rocket className="h-4 w-4 opacity-90" />
            发起自主任务
            <ArrowRight className="h-4 w-4 opacity-80" />
          </Link>
        </div>
      </header>

      <PlatformHomeFlowAnimation />

      <section aria-label="关键指标" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex h-[108px] items-center justify-center rounded-2xl border border-shell-border bg-shell-panel"
              >
                <Loader2 className="h-5 w-5 animate-spin text-shell-muted" />
              </div>
            ))
          : stats.map((s) => (
              <div
                key={s.label}
                className="relative overflow-hidden rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-sm"
              >
                {s.accent ? (
                  <div className="absolute right-0 top-0 h-16 w-16 rounded-bl-full bg-brand-primary/5" />
                ) : null}
                <p className="text-xs font-medium text-shell-subtext">{s.label}</p>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-bold tabular-nums tracking-tight text-shell-text">
                    {s.value}
                  </span>
                  <span className="text-sm font-semibold text-shell-muted">{s.unit}</span>
                </p>
                <p className="mt-2 text-[11px] font-medium text-shell-muted">{s.hint}</p>
              </div>
            ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section className="lg:col-span-2" aria-label="核心入口">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-shell-text">核心能力</h2>
            <span className="text-[11px] font-medium uppercase tracking-wider text-shell-muted">
              从这里开始
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {QUICK_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex gap-4 rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm transition-all hover:border-brand-primary/30 hover:shadow-md"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8 text-brand-primary transition-colors group-hover:bg-brand-primary/15">
                  <item.icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-shell-text">{item.label}</p>
                  <p className="mt-0.5 truncate text-xs text-shell-muted">{item.desc}</p>
                </div>
                <ArrowRight className="h-5 w-5 shrink-0 text-shell-subtext transition-transform group-hover:translate-x-0.5 group-hover:text-brand-bright" />
              </Link>
            ))}
          </div>
        </section>

        <aside className="space-y-6 lg:col-span-1" aria-label="最近动态">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-primary" />
              <h2 className="text-sm font-bold text-shell-text">最近动态</h2>
            </div>
            <ul className="space-y-3 rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
              {loading ? (
                <li className="flex items-center gap-2 py-4 text-[13px] text-shell-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中…
                </li>
              ) : recent.length === 0 ? (
                <li className="py-4 text-center text-[13px] text-shell-muted">
                  <Sparkles className="mx-auto mb-2 h-5 w-5 text-brand-primary/60" />
                  暂无动态。发起一次对话或自主任务，活动会出现在这里。
                </li>
              ) : (
                recent.map((row, i) => (
                  <li
                    key={`${row.kind}-${activityTitle(row)}-${i}`}
                    className="border-b border-shell-border-dim pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-brand-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-brand-primary">
                        {activityTag(row)}
                      </span>
                      <span className="text-[10px] font-medium text-shell-muted">
                        {timeAgo(row.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-shell-text">
                      {activityTitle(row)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>

          {!loading && tasks.length > 0 ? (
            <div>
              <h2 className="mb-3 text-sm font-bold text-shell-text">近期任务</h2>
              <ul className="space-y-2 rounded-2xl border border-shell-border bg-shell-bg/80 p-2">
                {tasks.slice(0, 4).map((task) => (
                  <li key={task.id}>
                    <Link
                      href={`/tasks/agent?taskId=${task.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[13px] transition-colors hover:bg-shell-panel hover:shadow-sm"
                    >
                      <span className="min-w-0 truncate font-medium text-shell-text">
                        {task.input.slice(0, 48)}
                        {task.input.length > 48 ? '…' : ''}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          task.status === 'running'
                            ? 'bg-brand-primary/10 text-brand-primary'
                            : task.status === 'done'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-shell-panel-hover text-shell-muted'
                        }`}
                      >
                        {task.status === 'running'
                          ? '执行中'
                          : task.status === 'done'
                            ? '已完成'
                            : task.status === 'pending'
                              ? '排队'
                              : task.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
