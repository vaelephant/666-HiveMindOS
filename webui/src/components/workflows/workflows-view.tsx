'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  GitBranch,
  Loader2,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import {
  createWorkflowFromTemplate,
  createWorkflowFromYaml,
  deleteWorkflow,
  deleteWorkflowRun,
  getWorkflow,
  listWorkflowRuns,
  listWorkflowTemplates,
  listWorkflows,
  restoreWorkflow,
  runWorkflow,
  setWorkflowSchedule,
  updateWorkflowYaml,
} from '@/lib/kb-api';
import type { WorkflowDefinition, WorkflowRun, WorkflowTemplate } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function summarizeRun(run: WorkflowRun): string {
  const s = run.summary;
  if (!s) return run.status === 'error' ? (run.error ?? '执行失败') : '已完成';
  const steps = s.steps as { status: string; action?: string }[] | undefined;
  if (Array.isArray(steps)) {
    const done = steps.filter((x) => x.status === 'done').length;
    const skipped = steps.filter((x) => x.status === 'skipped').length;
    return `${done} 步完成${skipped ? `，${skipped} 步跳过` : ''}`;
  }
  return '已完成';
}

const STATUS_ICON = {
  running: Loader2,
  done: CheckCircle2,
  error: XCircle,
} as const;

function cronLabel(cron: string): string {
  const map: Record<string, string> = {
    '0 2 * * *': '每天 02:00',
    '0 3 * * *': '每天 03:00',
    '0 4 * * *': '每天 04:00',
    '0 9 * * *': '每天 09:00',
    '30 2 * * *': '每天 02:30',
    '0 * * * *': '每小时',
  };
  return map[cron] ?? cron;
}

function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const DEFAULT_NEW_YAML = `id: my_workflow
label: 自定义工作流
description: 描述此工作流的用途
category: mixed
cron_hint: "0 3 * * *"
enabled: true
schedule_enabled: false
steps:
  - id: step1
    action: automation.sync_vectors
    params:
      limit: 100
`;

function YamlEditorDialog({
  title,
  initialYaml,
  saving,
  onClose,
  onSave,
}: {
  title: string;
  initialYaml: string;
  saving: boolean;
  onClose: () => void;
  onSave: (yaml: string) => void;
}) {
  const [yaml, setYaml] = useState(initialYaml);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-shell-border bg-shell-panel shadow-xl">
        <div className="flex items-center justify-between border-b border-shell-border px-5 py-4">
          <h3 className="text-[15px] font-semibold text-shell-text">{title}</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-shell-muted hover:bg-shell-bg">
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-4">
          <p className="mb-2 text-[11px] text-shell-muted">
            action 支持 <code className="text-brand-primary">automation.*</code> 与{' '}
            <code className="text-brand-primary">tool.*</code>；when 示例：{' '}
            <code>$step_id.approved &gt;= 1</code>
          </p>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            spellCheck={false}
            className="custom-scrollbar h-[min(50vh,420px)] w-full resize-none rounded-lg border border-shell-border bg-shell-bg p-3 font-mono text-[12px] leading-relaxed text-shell-text outline-none focus:border-brand-primary/40"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-shell-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-shell-border px-4 py-2 text-[13px] text-shell-muted hover:bg-shell-bg"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(yaml)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowsView() {
  const { orgId, ready } = useOrgReady();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [editTarget, setEditTarget] = useState<{ id: string; yaml: string; isNew: boolean } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready || !orgId) return;
    setLoading(true);
    try {
      const [wf, tpl, r] = await Promise.all([
        listWorkflows(orgId),
        listWorkflowTemplates(orgId),
        listWorkflowRuns(undefined, orgId, 30),
      ]);
      setWorkflows(wf);
      setTemplates(tpl);
      setRuns(r);
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [ready, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRun(wf: WorkflowDefinition) {
    if (!orgId) return;
    setBusy(`run:${wf.id}`);
    setMessage(null);
    try {
      await runWorkflow(wf.id, {}, orgId);
      setMessage({ tone: 'ok', text: `「${wf.label}」已执行完成` });
      await load();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '执行失败' });
    } finally {
      setBusy(null);
    }
  }

  async function handleEditSave(yaml: string) {
    if (!orgId || !editTarget) return;
    setBusy('save');
    try {
      if (editTarget.isNew) {
        await createWorkflowFromYaml(yaml, orgId);
        setMessage({ tone: 'ok', text: '工作流已创建' });
      } else {
        await updateWorkflowYaml(editTarget.id, yaml, orgId);
        setMessage({ tone: 'ok', text: '工作流已更新' });
      }
      setEditTarget(null);
      await load();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setBusy(null);
    }
  }

  async function openEdit(wf: WorkflowDefinition) {
    if (!orgId) return;
    try {
      const { yaml } = await getWorkflow(wf.id, orgId);
      setEditTarget({ id: wf.id, yaml, isNew: false });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '加载 YAML 失败' });
    }
  }

  async function handleToggleSchedule(wf: WorkflowDefinition) {
    if (!orgId) return;
    const next = !wf.schedule_enabled;
    if (next && !wf.cron_hint) {
      setMessage({ tone: 'err', text: '请先在 YAML 中配置 cron_hint' });
      return;
    }
    setBusy(`sched:${wf.id}`);
    try {
      await setWorkflowSchedule(wf.id, next, orgId);
      setMessage({
        tone: 'ok',
        text: next ? `「${wf.label}」定时已开启` : `「${wf.label}」定时已关闭`,
      });
      await load();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '更新调度失败' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-brand-primary" aria-hidden={true} />
            <h1 className="text-xl font-semibold text-shell-text">工作流</h1>
          </div>
          <p className="mt-1 max-w-2xl text-[13px] text-shell-muted">
            YAML 定义多步编排；开启<strong className="font-medium text-shell-text">定时</strong>后按{' '}
            <code>cron_hint</code> 自动运行（需{' '}
            <code>WORKFLOW_SCHEDULER_ENABLED=true</code> 或系统 cron 调用脚本）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEditTarget({ id: '', yaml: DEFAULT_NEW_YAML, isNew: true })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-panel px-3 py-1.5 text-xs font-medium text-shell-text hover:bg-shell-bg"
          >
            <Plus className="size-3.5" />
            新建 YAML
          </button>
          <Link
            href="/tasks/ops"
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-panel px-3 py-1.5 text-xs text-shell-muted hover:text-shell-text"
          >
            单步自动化 →
          </Link>
        </div>
      </header>

      {message && (
        <div
          className={cn(
            'rounded-lg px-4 py-3 text-[13px]',
            message.tone === 'ok'
              ? 'border border-emerald-500/20 bg-emerald-500/5 text-emerald-700'
              : 'border border-red-500/20 bg-red-500/5 text-red-600',
          )}
        >
          {message.text}
        </div>
      )}

      {templates.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-medium text-shell-text">从模板创建</h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={busy === `tpl:${tpl.id}`}
                onClick={async () => {
                  if (!orgId) return;
                  setBusy(`tpl:${tpl.id}`);
                  try {
                    await createWorkflowFromTemplate(tpl.id, orgId);
                    setMessage({ tone: 'ok', text: `已从模板创建（若 id 冲突请改 YAML id）` });
                    await load();
                  } catch (e) {
                    setMessage({
                      tone: 'err',
                      text: e instanceof Error ? e.message : '创建失败',
                    });
                  } finally {
                    setBusy(null);
                  }
                }}
                className="rounded-lg border border-dashed border-shell-border bg-shell-bg px-3 py-2 text-left text-[12px] hover:border-brand-primary/40 disabled:opacity-50"
              >
                <span className="font-medium text-shell-text">{tpl.label}</span>
                <span className="mt-0.5 block text-shell-muted">{tpl.step_count ?? tpl.steps.length} 步</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[13px] font-medium text-shell-text">已安装工作流</h2>
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-shell-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载中…
          </div>
        ) : workflows.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-shell-muted">暂无工作流，请从模板创建或新建 YAML</p>
        ) : (
          workflows.map((wf) => {
            const expanded = expandedId === wf.id;
            const last = wf.last_run;
            const StatusIcon = last ? STATUS_ICON[last.status as keyof typeof STATUS_ICON] ?? CheckCircle2 : null;
            return (
              <article
                key={wf.id}
                className="rounded-xl border border-shell-border bg-shell-panel overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : wf.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-shell-text">{wf.label}</span>
                      <code className="text-[11px] text-shell-muted">{wf.id}</code>
                      {wf.builtin && (
                        <span className="rounded bg-shell-bg px-1.5 py-0.5 text-[10px] text-shell-muted">内置</span>
                      )}
                      {!wf.enabled && (
                        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">已禁用</span>
                      )}
                      {wf.schedule_enabled && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-brand-primary/10 px-1.5 py-0.5 text-[10px] text-brand-primary">
                          <Timer className="size-3" />
                          定时
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-shell-muted">
                      {wf.description || '—'}
                      {wf.cron_hint && (
                        <span className="ml-2 text-shell-muted">
                          · {cronLabel(wf.cron_hint)}
                          {wf.schedule_enabled && wf.next_run_at && (
                            <span> · 下次 {formatNextRun(wf.next_run_at)}</span>
                          )}
                        </span>
                      )}
                    </p>
                  </button>
                  <div className="flex items-center gap-1.5">
                    {last && StatusIcon && (
                      <span className="flex items-center gap-1 text-[11px] text-shell-muted">
                        <StatusIcon
                          className={cn('size-3.5', last.status === 'running' && 'animate-spin')}
                        />
                        {formatTime(last.finished_at ?? last.started_at)}
                      </span>
                    )}
                    <button
                      type="button"
                      title={wf.schedule_enabled ? '关闭定时' : '开启定时'}
                      disabled={!wf.cron_hint || busy === `sched:${wf.id}`}
                      onClick={() => void handleToggleSchedule(wf)}
                      className={cn(
                        'rounded p-1.5',
                        wf.schedule_enabled
                          ? 'bg-brand-primary/15 text-brand-primary'
                          : 'text-shell-muted hover:bg-shell-bg',
                        !wf.cron_hint && 'opacity-40',
                      )}
                    >
                      {busy === `sched:${wf.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Clock className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      title="编辑 YAML"
                      onClick={() => void openEdit(wf)}
                      className="rounded p-1.5 text-shell-muted hover:bg-shell-bg hover:text-shell-text"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {wf.builtin && (
                      <button
                        type="button"
                        title="恢复默认"
                        onClick={async () => {
                          if (!orgId) return;
                          setBusy(`restore:${wf.id}`);
                          try {
                            await restoreWorkflow(wf.id, orgId);
                            setMessage({ tone: 'ok', text: '已恢复默认配置' });
                            await load();
                          } catch (e) {
                            setMessage({ tone: 'err', text: e instanceof Error ? e.message : '恢复失败' });
                          } finally {
                            setBusy(null);
                          }
                        }}
                        className="rounded p-1.5 text-shell-muted hover:bg-shell-bg"
                      >
                        <RotateCcw className="size-3.5" />
                      </button>
                    )}
                    {!wf.builtin && (
                      <button
                        type="button"
                        title="删除"
                        onClick={async () => {
                          if (!orgId || !confirm(`删除工作流「${wf.label}」？`)) return;
                          try {
                            await deleteWorkflow(wf.id, orgId);
                            await load();
                          } catch (e) {
                            setMessage({ tone: 'err', text: e instanceof Error ? e.message : '删除失败' });
                          }
                        }}
                        className="rounded p-1.5 text-shell-muted hover:bg-red-500/10 hover:text-red-600"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!wf.enabled || busy === `run:${wf.id}`}
                      onClick={() => void handleRun(wf)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                    >
                      {busy === `run:${wf.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      运行
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t border-shell-border bg-shell-bg/50 px-4 py-3">
                    <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-shell-muted">
                      <span>{wf.category_label ?? wf.category}</span>
                      {wf.cron_hint && <span>cron: {wf.cron_hint}</span>}
                      <span>{wf.step_count ?? wf.steps.length} 步</span>
                    </div>
                    <ol className="space-y-1.5">
                      {wf.steps.map((step, i) => (
                        <li key={step.id} className="flex flex-wrap items-baseline gap-2 text-[12px]">
                          <span className="font-mono text-shell-muted">{i + 1}.</span>
                          <code className="text-brand-primary">{step.action}</code>
                          <span className="text-shell-muted">id={step.id}</span>
                          {step.when && (
                            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700">
                              when {step.when}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {runs.length > 0 && (
        <section>
          <h2 className="mb-2 text-[13px] font-medium text-shell-text">最近运行</h2>
          <ul className="divide-y divide-shell-border rounded-xl border border-shell-border bg-shell-panel">
            {runs.slice(0, 15).map((run) => {
              const Icon = STATUS_ICON[run.status as keyof typeof STATUS_ICON] ?? CheckCircle2;
              return (
                <li key={run.id} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                  <Icon
                    className={cn(
                      'size-4 shrink-0',
                      run.status === 'error' ? 'text-red-500' : 'text-emerald-500',
                      run.status === 'running' && 'animate-spin text-shell-muted',
                    )}
                  />
                  <span className="font-mono text-shell-muted">{run.workflow_id}</span>
                  <span className="flex-1 text-shell-text">{summarizeRun(run)}</span>
                  <span className="text-shell-muted">{formatTime(run.finished_at ?? run.started_at)}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!orgId) return;
                      await deleteWorkflowRun(run.id, orgId);
                      await load();
                    }}
                    className="rounded p-1 text-shell-muted hover:text-red-600"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {editTarget && (
        <YamlEditorDialog
          title={editTarget.isNew ? '新建工作流' : `编辑 · ${editTarget.id}`}
          initialYaml={editTarget.yaml}
          saving={busy === 'save'}
          onClose={() => setEditTarget(null)}
          onSave={(yaml) => void handleEditSave(yaml)}
        />
      )}
    </div>
  );
}
