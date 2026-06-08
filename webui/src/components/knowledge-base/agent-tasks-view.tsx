'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Loader2, Send, Trash2, Wrench } from 'lucide-react';
import { WikiMarkdown } from '@/components/knowledge-base/wiki-markdown';
import { createTask, deleteTask, getTask, listTasks } from '@/lib/kb-api';
import type { AgentTask, TaskStep } from '@/lib/kb-types';

const TOOL_LABELS: Record<string, string> = {
  search_wiki: '搜索 Wiki',
  read_page: '读取页面',
  list_entities: '查询实体',
};

const STATUS_DOT: Record<AgentTask['status'], string> = {
  pending: 'bg-shell-muted',
  running: 'bg-status-warning animate-pulse',
  done: 'bg-status-success',
  error: 'bg-status-error',
};

const STATUS_LABEL: Record<AgentTask['status'], string> = {
  pending: '等待中',
  running: '执行中',
  done: '已完成',
  error: '出错',
};

function StepRow({ step }: { step: TaskStep }) {
  const [open, setOpen] = useState(false);
  const label = TOOL_LABELS[step.tool] ?? step.tool;
  const argSummary = Object.values(step.args)[0] as string | undefined;

  return (
    <div className="rounded-lg border border-shell-border bg-shell-bg text-[12px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Wrench className="size-3 shrink-0 text-brand-primary" />
        <span className="font-medium text-shell-text">{label}</span>
        {argSummary && (
          <span className="min-w-0 truncate text-shell-muted">— {argSummary}</span>
        )}
        {open ? (
          <ChevronDown className="ml-auto size-3 shrink-0 text-shell-muted" />
        ) : (
          <ChevronRight className="ml-auto size-3 shrink-0 text-shell-muted" />
        )}
      </button>
      {open && (
        <pre className="custom-scrollbar max-h-48 overflow-y-auto border-t border-shell-border px-3 py-2 font-mono text-[11px] text-shell-subtext whitespace-pre-wrap">
          {step.result}
        </pre>
      )}
    </div>
  );
}

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
        <span className={`size-2 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} />
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
        {STATUS_LABEL[task.status]}
        {task.steps.length > 0 && ` · ${task.steps.length} 步`}
      </p>
    </div>
  );
}

export function AgentTasksView() {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentTask | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listTasks().then(setTasks).catch(() => {});
  }, []);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedId) return;

    const poll = async () => {
      try {
        const t = await getTask(selectedId);
        setDetail(t);
        setTasks((prev) => prev.map((p) => (p.id === t.id ? t : p)));
        if (t.status === 'done' || t.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };

    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedId]);

  async function handleSubmit() {
    const q = input.trim();
    if (!q || submitting) return;
    setSubmitting(true);
    try {
      const task = await createTask(q);
      setTasks((prev) => [task, ...prev]);
      setInput('');
      setSelectedId(task.id);
      setDetail(task);
    } finally {
      setSubmitting(false);
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

  return (
    <div className="flex min-h-[calc(100dvh-3.25rem)] gap-4 pb-6">
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-shell-border bg-shell-panel shadow-sm lg:w-72">
        <div className="border-b border-shell-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-primary/10">
              <Bot className="size-4 text-brand-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-shell-text">分析任务</p>
              <p className="text-[11px] text-shell-muted">多步骤分析 · 分钟级报告</p>
            </div>
          </div>
        </div>

        <ul className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {tasks.length === 0 ? (
            <li className="rounded-xl bg-shell-bg px-3 py-8 text-center text-[13px] text-shell-muted">
              暂无任务
            </li>
          ) : (
            tasks.map((t) => (
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
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入任务，例如：帮我整理中康尚德所有应收款相关信息，并判断风险等级"
            rows={3}
            className="w-full resize-none bg-transparent text-[14px] text-shell-text outline-none placeholder:text-shell-muted"
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[12px] text-shell-muted">⌘ Enter 提交 · 将自动检索知识库并逐步推理</p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim() || submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-brand-on-primary shadow-sm transition-opacity disabled:opacity-50 hover:opacity-90"
            >
              {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
              执行任务
            </button>
          </div>
        </div>

        {detail ? (
          <div className="space-y-3">
            {detail.steps.length > 0 && (
              <div className="rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-shell-muted">
                  执行步骤 · {detail.steps.length} 步
                </p>
                <div className="space-y-2">
                  {detail.steps.map((step, i) => (
                    <StepRow key={i} step={step} />
                  ))}
                  {detail.status === 'running' && (
                    <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-shell-muted">
                      <Loader2 className="size-3.5 animate-spin" />
                      正在思考…
                    </div>
                  )}
                </div>
              </div>
            )}

            {detail.status === 'running' && detail.steps.length === 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-shell-border bg-shell-panel p-6 text-[14px] text-shell-muted shadow-sm">
                <Loader2 className="size-4 animate-spin" />
                正在启动…
              </div>
            )}

            {detail.status === 'done' && detail.result && (
              <article className="rounded-2xl border border-shell-border bg-shell-panel p-6 shadow-sm md:p-8">
                <WikiMarkdown md={detail.result} />
              </article>
            )}

            {detail.status === 'error' && (
              <div className="rounded-2xl border border-status-error/30 bg-status-error/5 p-4 text-[13px] text-status-error">
                执行出错：{detail.error}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-shell-border bg-shell-panel/50 p-10 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-primary/10">
              <Bot className="size-7 text-brand-primary" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-[15px] font-medium text-shell-text">提交一个分析任务</p>
            <p className="mt-1 max-w-xs text-[13px] text-shell-muted">
              系统会主动搜索知识库、逐步推理，最终给出结构化答案
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
