'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MessageSquare,
  ShieldAlert,
  Users,
  XCircle,
} from 'lucide-react';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';
import { WikiMarkdown } from '@/components/knowledge-base/wiki-markdown';
import type { AgentTask, TaskPhase } from '@/lib/kb-types';
import {
  GATE_LABELS,
  actionLabel,
  avgDimensionScores,
  buildTimeline,
  formatStepSummary,
  getApprovalContext,
  type TimelineItem,
} from '@/lib/task-display';

const PHASE_LABEL: Record<TaskPhase, string> = {
  pending: '等待中',
  planning: '规划中',
  planned: '计划就绪',
  executing: '执行中',
  reflecting: '生成报告',
  done: '已完成',
  error: '出错',
  awaiting_approval: '待批准',
};

function statusIcon(status: string) {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="size-4 text-status-success" />;
    case 'running':
      return <Loader2 className="size-4 animate-spin text-status-warning" />;
    case 'failed':
    case 'error':
      return <XCircle className="size-4 text-status-error" />;
    case 'awaiting_approval':
      return <ShieldAlert className="size-4 text-amber-500" />;
    case 'retry':
      return <Clock className="size-4 text-status-warning" />;
    case 'skipped':
      return <Circle className="size-4 text-shell-muted" />;
    default:
      return <Circle className="size-4 text-shell-muted/60" />;
  }
}

function TimelineStep({ item, isLast }: { item: TimelineItem; isLast: boolean }) {
  const summaryText = formatStepSummary(item.action, item.summary);
  const label = actionLabel(item.action);

  return (
    <div className="relative flex gap-3 pb-4">
      {!isLast && (
        <span className="absolute left-[7px] top-6 bottom-0 w-px bg-shell-border" aria-hidden />
      )}
      <div className="relative z-10 mt-0.5 shrink-0">{statusIcon(item.status)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-[13px] font-medium text-shell-text">{item.name}</p>
          <span className="text-[11px] text-shell-muted">{label}</span>
          {item.reflection?.score != null && (
            <span className="text-[11px] font-medium text-brand-primary">{item.reflection.score} 分</span>
          )}
        </div>
        {summaryText && (
          <p className="mt-0.5 text-[12px] text-shell-muted">{summaryText}</p>
        )}
        {item.reflection?.reason && (
          <p className="mt-1 text-[11px] leading-relaxed text-shell-subtext">{item.reflection.reason}</p>
        )}
        {item.reflection?.problems && item.reflection.problems.length > 0 && (
          <ul className="mt-1 list-inside list-disc text-[11px] text-amber-600/90 dark:text-amber-400/90">
            {item.reflection.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {item.error && item.status === 'awaiting_approval' && (
          <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">{item.error}</p>
        )}
        {item.gate && item.gate !== 'auto' && (
          <p className="mt-1 text-[10px] text-shell-muted">
            门控：{GATE_LABELS[item.gate] ?? item.gate}
          </p>
        )}
      </div>
    </div>
  );
}

const DEFAULT_COMMITTEE_ROLES = [
  { id: 'domain', label: '领域顾问', description: '拆解步骤与成功标准', order: 1 },
  { id: 'risk', label: '风险审查', description: '标注 gate 与风险等级', order: 2 },
  { id: 'chair', label: '主持人', description: '合成可执行任务队列', order: 3 },
];

type RoleStatus = 'pending' | 'running' | 'done';

function committeeRoleStatus(
  role: string,
  minutes: { role: string }[],
  activeRole: string | null | undefined,
  isPlanning: boolean,
): RoleStatus {
  if (minutes.some((m) => m.role === role)) return 'done';
  if (isPlanning && activeRole === role) return 'running';
  return 'pending';
}

function RoleStatusIcon({ status }: { status: RoleStatus }) {
  if (status === 'done') return <CheckCircle2 className="size-4 text-status-success" />;
  if (status === 'running') return <Loader2 className="size-4 animate-spin text-brand-primary" />;
  return <Circle className="size-4 text-shell-muted/50" />;
}

export function TaskPlanningCommittee({ task }: { task: AgentTask }) {
  const isPlanning = task.phase === 'planning';
  const minutes = task.plan?.planning_minutes ?? [];
  const activeRole = task.plan?.planning_active_role;
  const roleList = (task.plan?.committee_roles?.length
    ? [...task.plan.committee_roles].sort((a, b) => a.order - b.order)
    : DEFAULT_COMMITTEE_ROLES);
  const awaitingCommittee =
    (task.constraints?.source === 'task_center' || task.constraints?.source === 'chat_upgrade')
    && task.phase === 'pending';
  const isCommittee =
    task.plan?.planning_mode === 'committee'
    || isPlanning
    || awaitingCommittee
    || minutes.length > 0;

  if (!isCommittee) return null;

  const sourceLabel =
    task.constraints?.source === 'chat_upgrade'
      ? '来自 Chat 升级'
      : task.constraints?.source === 'task_center'
        ? '任务中心创建'
        : null;

  return (
    <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/[0.03] p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-brand-primary" />
        <p className="text-[12px] font-semibold text-shell-text">规划委员会 · 任务讨论</p>
        {isPlanning && (
          <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium text-brand-primary">
            讨论中
          </span>
        )}
        {sourceLabel && (
          <span className="text-[11px] text-shell-muted">{sourceLabel}</span>
        )}
      </div>

      <ul className="mt-4 space-y-0">
        {roleList.map((r, i) => {
          const status = committeeRoleStatus(r.id, minutes, activeRole, isPlanning);
          const minute = minutes.find((m) => m.role === r.id);
          const isLast = i === roleList.length - 1;

          return (
            <li key={r.id} className="relative flex gap-3 pb-4">
              {!isLast && (
                <span
                  className="absolute left-[9px] top-6 bottom-0 w-px bg-shell-border"
                  aria-hidden
                />
              )}
              <div className="relative z-10 mt-0.5 shrink-0">
                <RoleStatusIcon status={status} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <p className="text-[13px] font-medium text-shell-text">{r.label}</p>
                  {status === 'running' && (
                    <span className="text-[11px] text-brand-primary">发言中…</span>
                  )}
                  {minute?.fallback && (
                    <span className="text-[10px] text-shell-muted">规则兜底</span>
                  )}
                </div>
                <p className="text-[11px] text-shell-muted">{r.description}</p>
                {minute?.summary && (
                  <p className="mt-1.5 rounded-lg border border-shell-border/80 bg-shell-panel/80 px-3 py-2 text-[12px] leading-relaxed text-shell-subtext">
                    {minute.summary}
                  </p>
                )}
                {status === 'pending' && isPlanning && !minute && (
                  <p className="mt-1 text-[11px] text-shell-muted/70">等待发言</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {(isPlanning || awaitingCommittee) && minutes.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-shell-panel px-3 py-2 text-[12px] text-shell-muted">
          <Loader2 className="size-3.5 animate-spin text-brand-primary" />
          规划委员会正在召集，领域顾问准备发言…
        </div>
      )}
    </div>
  );
}

export function TaskPlanSummary({ task }: { task: AgentTask }) {
  if (!task.plan) return null;
  const hasQueue = (task.queue?.length ?? task.plan.tasks?.length ?? 0) > 0;
  if (task.phase === 'planning' && !hasQueue) return null;
  const timeline = buildTimeline(task);
  const doneCount = timeline.filter((t) => t.status === 'done').length;

  return (
    <div className="rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">
            执行计划 · {task.plan.task_type}
          </p>
          <p className="mt-1 text-[14px] font-medium text-shell-text">{task.plan.goal}</p>
        </div>
        <span className="rounded-full bg-shell-bg px-2.5 py-1 text-[11px] text-shell-muted">
          {PHASE_LABEL[task.phase ?? 'pending'] ?? task.status}
          {timeline.length > 0 && ` · ${doneCount}/${timeline.length}`}
        </span>
      </div>
      {(task.constraints?.source === 'chat_upgrade' || task.constraints?.source === 'task_center') && (
        <p className="mt-2 text-[12px] text-shell-muted">
          {task.constraints?.source === 'chat_upgrade' && (
            <>
              来源：
              <Link
                href={
                  task.constraints.session_id
                    ? `${HIVEMIND_HOME_PATH}?id=${task.constraints.session_id}`
                    : HIVEMIND_HOME_PATH
                }
                className="ml-1 text-brand-primary hover:underline"
              >
                Chat 对话升级
              </Link>
            </>
          )}
          {task.constraints?.source === 'task_center' && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3" />
              任务中心直接创建 · 经规划委员会讨论
            </span>
          )}
          {task.constraints?.source === 'chat_upgrade' && task.constraints.context?.wiki_paths
            && task.constraints.context.wiki_paths.length > 0 && (
            <span> · 带入 {task.constraints.context.wiki_paths.length} 个 Wiki 引用</span>
          )}
          {task.constraints?.source === 'chat_upgrade' && task.constraints.context?.memory_ids
            && task.constraints.context.memory_ids.length > 0 && (
            <span> · {task.constraints.context.memory_ids.length} 条智慧记忆</span>
          )}
        </p>
      )}
      {task.plan.success_criteria?.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-shell-border pt-3 text-[12px] text-shell-muted">
          {task.plan.success_criteria.map((c) => (
            <li key={c} className="flex gap-2">
              <span className="text-brand-primary">✓</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TaskExecutionTimeline({
  task,
  isRunning,
}: {
  task: AgentTask;
  isRunning: boolean;
}) {
  const timeline = buildTimeline(task);
  if (timeline.length === 0 && !isRunning) return null;

  return (
    <div className="rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
      <p className="mb-4 text-[12px] font-semibold uppercase tracking-wide text-shell-muted">
        执行时间线
      </p>
      {timeline.length > 0 ? (
        <div>
          {timeline.map((item, i) => (
            <TimelineStep key={item.id} item={item} isLast={i === timeline.length - 1 && !isRunning} />
          ))}
        </div>
      ) : null}
      {isRunning && (
        <div className="flex items-center gap-2 text-[12px] text-shell-muted">
          <Loader2 className="size-3.5 animate-spin" />
          {PHASE_LABEL[task.phase ?? 'executing'] ?? '执行中…'}
        </div>
      )}
    </div>
  );
}

export function TaskApprovalPanel({
  task,
  approving,
  onApprove,
}: {
  task: AgentTask;
  approving: boolean;
  onApprove: () => void;
}) {
  const ctx = getApprovalContext(task);
  if (!ctx) return null;

  const riskBadge =
    ctx.riskLevel === 'high'
      ? '高风险写操作'
      : ctx.riskLevel === 'medium'
        ? '需人工确认'
        : '常规确认';

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
          <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-shell-text">待人工批准</p>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
              {riskBadge}
            </span>
          </div>
          <p className="mt-2 text-[13px] text-shell-text">
            <span className="text-shell-muted">步骤：</span>
            {ctx.stepName}
            <span className="mx-1.5 text-shell-border">·</span>
            <span className="text-shell-muted">{actionLabel(ctx.action)}</span>
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-shell-text">{ctx.reason}</p>
          {ctx.gate && (
            <p className="mt-1 text-[11px] text-shell-muted">
              策略：{GATE_LABELS[ctx.gate] ?? ctx.gate}
              {ctx.action === 'compile_candidates' && ' — 批准后将变更写入 Wiki'}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onApprove}
          disabled={approving}
          className="shrink-0 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-brand-on-primary disabled:opacity-50"
        >
          {approving ? <Loader2 className="size-4 animate-spin" /> : '批准继续'}
        </button>
      </div>
    </div>
  );
}

export function TaskFinalReport({ task }: { task: AgentTask }) {
  if (task.status !== 'done' || !task.result) return null;

  const dimensions = avgDimensionScores(task);

  return (
    <article className="rounded-2xl border border-shell-border bg-shell-panel shadow-sm">
      <div className="border-b border-shell-border px-5 py-4 md:px-6">
        <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">最终报告</p>
        {task.score != null && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums text-brand-primary">{task.score}</span>
            <span className="text-[13px] text-shell-muted">综合评分</span>
            {task.experience_id && (
              <span className="rounded-full bg-status-success/10 px-2.5 py-0.5 text-[11px] text-status-success">
                已沉淀经验
              </span>
            )}
          </div>
        )}
        {dimensions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {dimensions.map((d) => (
              <span
                key={d.name}
                className="rounded-lg border border-shell-border bg-shell-bg px-2.5 py-1 text-[11px] text-shell-muted"
              >
                {d.name} <span className="font-medium text-shell-text">{d.score}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="p-5 md:p-8">
        <WikiMarkdown md={task.result} />
      </div>
    </article>
  );
}

export function TaskErrorPanel({ task }: { task: AgentTask }) {
  if (task.status !== 'error' || task.phase === 'awaiting_approval') return null;
  return (
    <div className="rounded-2xl border border-status-error/30 bg-status-error/5 p-4 text-[13px] text-status-error">
      执行出错：{task.error ?? '未知错误'}
    </div>
  );
}
