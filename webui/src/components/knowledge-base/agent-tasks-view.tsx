'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Brain, Loader2, Send, Trash2, XCircle } from 'lucide-react';
import {
  TaskApprovalPanel,
  TaskErrorPanel,
  TaskExecutionTimeline,
  TaskFinalReport,
  TaskPlanningCommittee,
  TaskPlanSummary,
} from '@/components/knowledge-base/agent-task-detail';
import {
  approveTask,
  cancelTask,
  createTask,
  deleteTask,
  getTask,
  listExperiences,
  listTasks,
} from '@/lib/kb-api';
import type { AgentExperience, AgentTask, TaskPhase } from '@/lib/kb-types';
import { type TaskFilter, taskMatchesFilter } from '@/lib/task-display';

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

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-shell-muted',
  running: 'bg-status-warning animate-pulse',
  done: 'bg-status-success',
  error: 'bg-status-error',
  awaiting_approval: 'bg-amber-500 animate-pulse',
};

const FILTER_TABS: { key: TaskFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'approval', label: '待批准' },
  { key: 'done', label: '已完成' },
];

function TaskCard({
  task,
  active,
  onSelect,
  onDelete,
}: {
  task: AgentTask;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const phase = task.phase ?? (task.status as TaskPhase);
  const dot = STATUS_DOT[phase === 'awaiting_approval' ? 'awaiting_approval' : task.status] ?? STATUS_DOT.pending;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={`group w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition-all ${
        active
          ? 'border border-brand-primary/25 bg-brand-primary/8 shadow-sm'
          : 'border border-transparent hover:border-shell-border hover:bg-shell-bg'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`size-2 shrink-0 rounded-full ${dot}`} />
        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-shell-text">
          {task.input}
        </p>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="hidden shrink-0 rounded p-0.5 text-shell-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100 group-hover:flex"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <p className="mt-0.5 pl-4 text-[11px] text-shell-muted">
        {PHASE_LABEL[phase] ?? task.status}
        {task.task_type && ` · ${task.task_type}`}
        {task.score != null && ` · ${task.score}分`}
      </p>
    </div>
  );
}

function ExperiencePanel({ items }: { items: AgentExperience[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Brain className="size-4 text-brand-primary" />
        <p className="text-[12px] font-semibold text-shell-text">历史成功经验</p>
      </div>
      <p className="mt-1 text-[11px] text-shell-muted">Planner 会参考高分路径拆解类似目标</p>
      <ul className="mt-3 space-y-2">
        {items.map((exp) => (
          <li
            key={exp.id}
            className="rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[12px]"
          >
            <p className="line-clamp-2 font-medium text-shell-text">{exp.goal}</p>
            <p className="mt-0.5 text-[11px] text-shell-muted">
              {exp.task_type}
              {exp.score != null && ` · ${exp.score}分`}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgentTasksView({ initialTaskId }: { initialTaskId?: string | null }) {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [experiences, setExperiences] = useState<AgentExperience[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentTask | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    listTasks()
      .then((list) => {
        setTasks(list);
        if (initialTaskId) {
          const found = list.find((t) => t.id === initialTaskId);
          if (found) {
            setSelectedId(found.id);
            setDetail(found);
          } else {
            getTask(initialTaskId)
              .then((t) => {
                setSelectedId(t.id);
                setDetail(t);
                setTasks((prev) => (prev.some((p) => p.id === t.id) ? prev : [t, ...prev]));
              })
              .catch(() => {});
          }
        }
      })
      .catch(() => {});
    listExperiences(undefined, undefined, 4).then(setExperiences).catch(() => {});
  }, [initialTaskId]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedId) return;

    const poll = async () => {
      try {
        const t = await getTask(selectedId);
        setDetail(t);
        setTasks((prev) => prev.map((p) => (p.id === t.id ? t : p)));
        const terminal = t.status === 'done' || t.status === 'error';
        const waiting = t.phase === 'awaiting_approval';
        if (terminal && !waiting) {
          if (pollRef.current) clearInterval(pollRef.current);
          listExperiences(undefined, undefined, 4).then(setExperiences).catch(() => {});
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 700);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId]);

  const filteredTasks = useMemo(
    () => tasks.filter((t) => taskMatchesFilter(t, filter)),
    [tasks, filter],
  );

  const filterCounts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter((t) => taskMatchesFilter(t, 'active')).length,
    approval: tasks.filter((t) => taskMatchesFilter(t, 'approval')).length,
    done: tasks.filter((t) => taskMatchesFilter(t, 'done')).length,
  }), [tasks]);

  async function handleSubmit() {
    const q = input.trim();
    if (!q || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask(q, {
        constraints: { source: 'task_center' },
      });
      setTasks((prev) => [task, ...prev]);
      setInput('');
      setSelectedId(task.id);
      setDetail(task);
      setFilter('all');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!detail || approving) return;
    setApproving(true);
    try {
      const t = await approveTask(detail.id, detail.pending_step_id ?? undefined);
      setDetail(t);
      setTasks((prev) => prev.map((p) => (p.id === t.id ? t : p)));
    } finally {
      setApproving(false);
    }
  }

  async function handleCancel() {
    if (!detail || cancelling) return;
    setCancelling(true);
    try {
      await cancelTask(detail.id);
      const t = await getTask(detail.id);
      setDetail(t);
      setTasks((prev) => prev.map((p) => (p.id === t.id ? t : p)));
    } finally {
      setCancelling(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  }

  async function handleDelete(taskId: string) {
    await deleteTask(taskId).catch(() => {});
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (selectedId === taskId) {
      setSelectedId(null);
      setDetail(null);
    }
  }

  const isRunning = detail && (
    detail.status === 'running'
    || detail.phase === 'planning'
    || detail.phase === 'executing'
    || detail.phase === 'reflecting'
  );

  const canCancel = detail && isRunning && detail.phase !== 'awaiting_approval';

  return (
    <div className="flex min-h-[calc(100dvh-3.25rem)] gap-4 pb-6">
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-shell-border bg-shell-panel shadow-sm lg:w-72">
        <div className="border-b border-shell-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-primary/10">
              <Bot className="size-4 text-brand-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-shell-text">自主任务</p>
              <p className="text-[11px] text-shell-muted">规划 · 执行 · 反思 · 沉淀</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={[
                  'rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                  filter === tab.key
                    ? 'bg-brand-primary/10 text-brand-primary'
                    : 'text-shell-muted hover:bg-shell-bg hover:text-shell-text',
                ].join(' ')}
              >
                {tab.label}
                {filterCounts[tab.key] > 0 && (
                  <span className="ml-1 opacity-70">{filterCounts[tab.key]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <ul className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {filteredTasks.length === 0 ? (
            <li className="rounded-xl bg-shell-bg px-3 py-8 text-center text-[13px] text-shell-muted">
              {tasks.length === 0 ? '暂无任务' : '该筛选下暂无任务'}
            </li>
          ) : (
            filteredTasks.map((t) => (
              <li key={t.id}>
                <TaskCard
                  task={t}
                  active={selectedId === t.id}
                  onSelect={() => { setSelectedId(t.id); setDetail(t); }}
                  onDelete={() => handleDelete(t.id)}
                />
              </li>
            ))
          )}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述业务目标，例如：帮我整理本周项目决策进 Wiki；或：分析某某客户并生成销售方案"
            rows={3}
            className="w-full resize-none bg-transparent text-[14px] text-shell-text outline-none placeholder:text-shell-muted"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[12px] text-shell-muted">
              ⌘ Enter 提交 · 规划委员会讨论后自动执行
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-brand-on-primary shadow-sm transition-opacity disabled:opacity-50 hover:opacity-90"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              启动任务
            </button>
          </div>
        </div>

        {!detail && <ExperiencePanel items={experiences} />}

        {detail ? (
          <div className="space-y-3">
            {canCancel && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-3 py-1.5 text-[12px] text-shell-muted transition-colors hover:border-status-error/40 hover:text-status-error disabled:opacity-50"
                >
                  {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                  取消任务
                </button>
              </div>
            )}

            <TaskPlanningCommittee task={detail} />
            <TaskPlanSummary task={detail} />
            <TaskApprovalPanel task={detail} approving={approving} onApprove={handleApprove} />
            <TaskExecutionTimeline task={detail} isRunning={!!isRunning} />

            {isRunning && detail.steps.length === 0 && !detail.plan && (
              <div className="flex items-center gap-2 rounded-2xl border border-shell-border bg-shell-panel p-6 text-[14px] text-shell-muted shadow-sm">
                <Loader2 className="size-4 animate-spin" />
                {PHASE_LABEL[detail.phase ?? 'planning'] ?? '正在启动…'}
              </div>
            )}

            <TaskFinalReport task={detail} />
            <TaskErrorPanel task={detail} />

            {detail.experience_id && (
              <p className="text-center text-[11px] text-shell-muted">
                本次执行已写入经验库，可供后续类似目标参考
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-shell-border bg-shell-panel/50 p-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-primary/10">
              <Bot className="size-7 text-brand-primary" strokeWidth={1.75} />
            </div>
            <p className="mt-4 text-[15px] font-medium text-shell-text">提交一个业务目标</p>
            <p className="mt-1 max-w-sm text-[13px] text-shell-muted">
              系统会自动拆解任务、逐步执行、反思检查，并将成功经验沉淀复用
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
