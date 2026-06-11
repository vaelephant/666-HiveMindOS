'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { HIVEMIND_MEMORIES_PATH } from '@/config/navigation';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Pencil,
  Play,
  RotateCcw,
  Timer,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import {
  deleteAutomation,
  deleteAutomationRun,
  listAutomations,
  listAutomationRuns,
  listWeChatWorkBindings,
  reseedAutomations,
  restoreAutomation,
  runAutomation,
  updateAutomation,
} from '@/lib/kb-api';
import type { AutomationJob, AutomationJobUpdate, AutomationRun, WeChatWorkBinding } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const CRON_OPTIONS = [
  { value: '0 * * * *', label: '每小时' },
  { value: '0 9 * * *', label: '每天 09:00' },
  { value: '30 2 * * *', label: '每天 02:30' },
  { value: '0 2 * * *', label: '每天 02:00' },
  { value: '0 3 * * *', label: '每天 03:00' },
  { value: '0 4 * * *', label: '每天 04:00' },
];

type ParamField = {
  label: string;
  type: 'number' | 'boolean' | 'string';
};

const JOB_PARAM_FIELDS: Record<string, Record<string, ParamField>> = {
  recap_sessions: {
    idle_hours: { label: '空闲小时数', type: 'number' },
    limit: { label: '批量上限', type: 'number' },
  },
  sync_vectors: {
    limit: { label: '批量上限', type: 'number' },
  },
  resolve_candidates: {
    limit: { label: '批量上限', type: 'number' },
  },
  compile_candidates: {
    limit: { label: '批量上限', type: 'number' },
  },
  daily_digest: {
    days: { label: '统计天数', type: 'number' },
    deliver_wechat: { label: '推送到企微', type: 'boolean' },
    wechat_userid: { label: '企微 userid', type: 'string' },
  },
};

const PARAM_LABELS: Record<string, string> = {
  idle_hours: '空闲小时数',
  limit: '批量上限',
  days: '统计天数',
  deliver_wechat: '企微推送',
  wechat_userid: '企微 userid',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function cronLabel(cron: string): string {
  return CRON_OPTIONS.find((o) => o.value === cron)?.label ?? cron;
}

function summarizeRun(run: { summary: Record<string, unknown> | null; status: string; error?: string | null }): string {
  const s = run.summary;
  if (!s) return run.status === 'error' ? (run.error ?? '执行失败') : '已完成';
  if (typeof s.sessions_recapped === 'number') {
    return `复盘 ${s.sessions_recapped} 个会话`;
  }
  if (typeof s.synced === 'number') {
    return `同步 ${s.synced} 条向量`;
  }
  if (typeof s.resolved === 'number') {
    return `解析 ${s.resolved} 条（批准 ${s.approved ?? 0}）`;
  }
  if (typeof s.merged === 'number') {
    return `编译 ${s.merged} 条进 Wiki`;
  }
  if (typeof s.digest === 'string') {
    const preview = (s.digest as string).slice(0, 40);
    const wx = s.wechat_delivered ? ' · 已推送企微' : '';
    return `摘要：${preview}…${wx}`;
  }
  return '已完成';
}

const STATUS_ICON = {
  running: Loader2,
  done: CheckCircle2,
  error: XCircle,
} as const;

type EditForm = {
  label: string;
  description: string;
  cron_hint: string;
  defaults: Record<string, number | boolean | string>;
};

function toEditForm(job: AutomationJob): EditForm {
  return {
    label: job.label,
    description: job.description,
    cron_hint: job.cron_hint,
    defaults: { ...job.defaults },
  };
}

function formatDefaultDisplay(key: string, val: number | boolean | string): string {
  if (typeof val === 'boolean') return val ? '是' : '否';
  return String(val);
}

function DigestPreviewDialog({ run, onClose }: { run: AutomationRun; onClose: () => void }) {
  const s = run.summary ?? {};
  const digest = typeof s.digest === 'string' ? s.digest : '';
  const stats = (s.stats ?? {}) as Record<string, unknown>;
  const wechatDelivered = Boolean(s.wechat_delivered);
  const wechatError = typeof s.wechat_error === 'string' ? s.wechat_error : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-shell-border bg-shell-panel shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-shell-border px-5 py-4">
          <div>
            <h3 className="text-[15px] font-semibold text-shell-text">每日摘要</h3>
            <p className="mt-0.5 text-[11px] text-shell-muted">{formatTime(run.finished_at ?? run.started_at)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-shell-muted hover:bg-shell-bg">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          {digest ? (
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-shell-text">{digest}</p>
          ) : (
            <p className="text-[13px] text-shell-muted">{run.error ?? '无摘要内容'}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-shell-muted">
            {typeof s.memories_count === 'number' && <span>智慧 {s.memories_count} 条</span>}
            {typeof stats.session_count === 'number' && <span>会话 {stats.session_count}</span>}
            {typeof stats.message_count === 'number' && <span>消息 {stats.message_count}</span>}
            {wechatDelivered && <span className="text-emerald-600">已推送企微</span>}
            {wechatError && <span className="text-red-600">企微：{wechatError}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditJobDialog({
  job,
  orgId,
  saving,
  onClose,
  onSave,
  onRestore,
}: {
  job: AutomationJob;
  orgId: string;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: AutomationJobUpdate) => void;
  onRestore: () => void;
}) {
  const [form, setForm] = useState<EditForm>(() => toEditForm(job));
  const [bindings, setBindings] = useState<WeChatWorkBinding[]>([]);

  useEffect(() => {
    if (job.id !== 'daily_digest') return;
    void listWeChatWorkBindings(orgId)
      .then((res) => setBindings(res.bindings))
      .catch(() => setBindings([]));
  }, [job.id, orgId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="w-full max-w-md rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-shell-text">修改任务</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-shell-muted hover:bg-shell-bg">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">名称</span>
            <input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">说明</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full resize-none rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">建议调度（cron）</span>
            <select
              value={form.cron_hint}
              onChange={(e) => setForm((f) => ({ ...f, cron_hint: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
            >
              {CRON_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {Object.entries(form.defaults).map(([key, val]) => {
            const field = JOB_PARAM_FIELDS[job.id]?.[key];
            const label = field?.label ?? PARAM_LABELS[key] ?? key;
            if (field?.type === 'boolean') {
              return (
                <label key={key} className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        defaults: { ...f.defaults, [key]: e.target.checked },
                      }))
                    }
                    className="size-4 rounded border-shell-border"
                  />
                  <span className="text-[13px] text-shell-text">{label}</span>
                </label>
              );
            }
            if (field?.type === 'string' && key === 'wechat_userid' && bindings.length > 0) {
              return (
                <label key={key} className="block">
                  <span className="text-[11px] font-medium text-shell-muted">{label}</span>
                  <select
                    value={String(val ?? '')}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        defaults: { ...f.defaults, [key]: e.target.value },
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
                  >
                    <option value="">选择已绑定成员</option>
                    {bindings.map((b) => (
                      <option key={b.id} value={b.wechat_userid}>
                        {b.wechat_name ? `${b.wechat_name} (${b.wechat_userid})` : b.wechat_userid}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }
            if (field?.type === 'string') {
              return (
                <label key={key} className="block">
                  <span className="text-[11px] font-medium text-shell-muted">{label}</span>
                  <input
                    type="text"
                    value={String(val ?? '')}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        defaults: { ...f.defaults, [key]: e.target.value },
                      }))
                    }
                    placeholder={key === 'wechat_userid' ? '企微成员 userid' : ''}
                    className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
                  />
                </label>
              );
            }
            return (
              <label key={key} className="block">
                <span className="text-[11px] font-medium text-shell-muted">{label}</span>
                <input
                  type="number"
                  min={1}
                  value={typeof val === 'number' ? val : Number(val) || 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      defaults: { ...f.defaults, [key]: Number(e.target.value) || 0 },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
                />
              </label>
            );
          })}
          {job.id === 'daily_digest' && Boolean(form.defaults.deliver_wechat) && (
            <p className="text-[11px] text-shell-muted">
              需先在
              <Link href="/integrations/wechat-work" className="mx-1 text-brand-primary hover:underline">
                企业微信集成
              </Link>
              完成配置与用户绑定。
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {job.builtin && (
            <button
              type="button"
              disabled={saving}
              onClick={onRestore}
              className="inline-flex items-center gap-1 text-[12px] text-shell-muted hover:text-brand-primary disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              恢复默认
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-shell-border px-4 py-2 text-[13px] text-shell-muted hover:bg-shell-bg"
            >
              取消
            </button>
            <button
              type="button"
              disabled={saving || !form.label.trim()}
              onClick={() => onSave(form)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AutomationsView() {
  const { orgId } = useOrgReady();
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof listAutomationRuns>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutomationJob | null>(null);
  const [digestPreview, setDigestPreview] = useState<AutomationRun | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [j, r] = await Promise.all([listAutomations(), listAutomationRuns(undefined, undefined, 30)]);
      setJobs(j);
      setRuns(r);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleRun(job: AutomationJob) {
    setBusy(`run-${job.id}`);
    setMessage(null);
    try {
      const res = await runAutomation(job.id, job.defaults);
      setMessage({
        tone: res.ok ? 'ok' : 'err',
        text: res.ok ? `「${job.label}」执行成功` : (res.run?.error ?? '执行失败'),
      });
      if (res.ok && job.id === 'daily_digest' && res.run) {
        setDigestPreview(res.run);
      }
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '执行失败' });
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteJob(job: AutomationJob) {
    if (!window.confirm(`确定删除「${job.label}」？删除后可通过页头「恢复内置任务」重新添加。`)) return;
    setBusy(`del-${job.id}`);
    try {
      await deleteAutomation(job.id);
      setMessage({ tone: 'ok', text: `已删除「${job.label}」` });
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '删除失败' });
    } finally {
      setBusy(null);
    }
  }

  async function handleSaveEdit(patch: AutomationJobUpdate) {
    if (!editing) return;
    setBusy(`edit-${editing.id}`);
    try {
      await updateAutomation(editing.id, patch);
      setEditing(null);
      setMessage({ tone: 'ok', text: '任务已更新' });
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (!editing) return;
    setBusy(`restore-${editing.id}`);
    try {
      await restoreAutomation(editing.id);
      setEditing(null);
      setMessage({ tone: 'ok', text: '已恢复默认配置' });
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '恢复失败' });
    } finally {
      setBusy(null);
    }
  }

  async function handleDeleteRun(runId: string) {
    setBusy(`run-del-${runId}`);
    try {
      await deleteAutomationRun(runId);
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '删除记录失败' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="w-full py-6 md:py-8">
      {digestPreview && (
        <DigestPreviewDialog run={digestPreview} onClose={() => setDigestPreview(null)} />
      )}
      {editing && (
        <EditJobDialog
          job={editing}
          orgId={orgId}
          saving={busy === `edit-${editing.id}` || busy === `restore-${editing.id}`}
          onClose={() => setEditing(null)}
          onSave={handleSaveEdit}
          onRestore={handleRestore}
        />
      )}

      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
            <Timer className="size-6 text-brand-primary" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-shell-muted">任务中心</p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
              定时运维
            </h2>
            <p className="mt-1 text-[13px] text-shell-muted">
              按周期自动运行的内置任务，与
              <Link href="/tasks/agent" className="mx-1 text-brand-primary hover:underline">
                自主任务
              </Link>
              互补。
            </p>
            
          </div>
        </div>
        {jobs.length < 5 && !loading && (
          <button
            type="button"
            disabled={!!busy}
            onClick={async () => {
              setBusy('reseed');
              try {
                const n = await reseedAutomations();
                setMessage({ tone: 'ok', text: n.length ? `已恢复 ${n.length} 个内置任务` : '没有可恢复的任务' });
                await refresh();
              } catch (e) {
                setMessage({ tone: 'err', text: e instanceof Error ? e.message : '恢复失败' });
              } finally {
                setBusy(null);
              }
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-shell-border px-3 py-2 text-[12px] font-medium text-shell-muted transition-colors hover:border-brand-primary/30 hover:text-brand-primary disabled:opacity-50"
          >
            {busy === 'reseed' ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            恢复内置任务
          </button>
        )}
        </div>
      </header>

      {message && (
        <p
          className={cn(
            'mt-4 rounded-xl px-4 py-2.5 text-[13px]',
            message.tone === 'ok'
              ? 'bg-brand-primary/8 text-brand-primary'
              : 'bg-red-500/8 text-red-600',
          )}
        >
          {message.text}
        </p>
      )}

      <section className="mt-4 grid gap-4 md:grid-cols-2">
        {loading ? (
          <div className="col-span-full flex items-center justify-center gap-2 py-16 text-[13px] text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
            加载任务…
          </div>
        ) : jobs.length === 0 ? (
          <p className="col-span-full py-12 text-center text-[13px] text-shell-muted">暂无任务</p>
        ) : (
          jobs.map((job) => {
            const last = job.last_run;
            const LastIcon = last ? STATUS_ICON[last.status] : Clock;
            return (
              <div
                key={job.id}
                className="flex flex-col rounded-2xl border border-shell-border bg-shell-panel p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[15px] font-semibold text-shell-text">{job.label}</h2>
                      <span className="rounded-full bg-shell-bg px-2 py-0.5 text-[10px] text-shell-muted">
                        {job.category_label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-shell-muted">{job.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      title="修改"
                      disabled={!!busy}
                      onClick={() => setEditing(job)}
                      className="flex size-8 items-center justify-center rounded-lg border border-shell-border text-shell-muted transition-colors hover:bg-shell-bg hover:text-shell-text disabled:opacity-50"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      title="删除"
                      disabled={!!busy}
                      onClick={() => handleDeleteJob(job)}
                      className="flex size-8 items-center justify-center rounded-lg border border-shell-border text-shell-muted transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-600 disabled:opacity-50"
                    >
                      {busy === `del-${job.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => handleRun(job)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === `run-${job.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      运行
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-shell-muted">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    建议 {cronLabel(job.cron_hint)}
                  </span>
                  {Object.entries(job.defaults).map(([k, v]) => (
                    <span key={k}>
                      {PARAM_LABELS[k] ?? k} {formatDefaultDisplay(k, v)}
                    </span>
                  ))}
                  {last && (
                    <span className="inline-flex items-center gap-1">
                      <LastIcon
                        className={cn(
                          'size-3',
                          last.status === 'running' && 'animate-spin',
                          last.status === 'done' && 'text-emerald-600',
                          last.status === 'error' && 'text-red-600',
                        )}
                      />
                      上次 {formatTime(last.finished_at ?? last.started_at)} · {summarizeRun(last)}
                    </span>
                  )}
                </div>

                {(job.id === 'resolve_candidates' || job.id === 'compile_candidates') && (
                  <Link
                    href="/human-review"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
                  >
                    前往人工审核
                    <ArrowRight className="size-3" />
                  </Link>
                )}
                {job.id === 'daily_digest' && (
                  <Link
                    href="/integrations/wechat-work"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
                  >
                    配置企微推送
                    <ArrowRight className="size-3" />
                  </Link>
                )}
                {job.id === 'recap_sessions' && (
                  <Link
                    href={HIVEMIND_MEMORIES_PATH}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
                  >
                    查看智慧进化
                    <Brain className="size-3" />
                  </Link>
                )}
              </div>
            );
          })
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        <p className="text-[14px] font-semibold text-shell-text">最近运行</p>
        <p className="mt-0.5 text-[12px] text-shell-muted">最近 30 次触发记录，可删除单条</p>

        {runs.length === 0 ? (
          <p className="py-8 text-center text-[13px] text-shell-muted">暂无运行记录</p>
        ) : (
          <ul className="mt-4 divide-y divide-shell-border">
            {runs.map((run) => {
              const job = jobs.find((j) => j.id === run.job_id);
              const Icon = STATUS_ICON[run.status];
              const hasDigest = run.job_id === 'daily_digest' && typeof run.summary?.digest === 'string';
              return (
                <li key={run.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0',
                      run.status === 'running' && 'animate-spin text-shell-muted',
                      run.status === 'done' && 'text-emerald-600',
                      run.status === 'error' && 'text-red-600',
                    )}
                  />
                  <button
                    type="button"
                    disabled={!hasDigest}
                    onClick={() => hasDigest && setDigestPreview(run)}
                    className={cn(
                      'min-w-0 flex-1 text-left',
                      hasDigest && 'cursor-pointer rounded-lg hover:bg-shell-bg/80',
                    )}
                  >
                    <p className="text-[13px] font-medium text-shell-text">
                      {job?.label ?? run.job_id}
                      <span className="ml-2 font-normal text-shell-muted">{summarizeRun(run)}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-shell-muted">
                      {formatTime(run.started_at)}
                      {run.trigger === 'manual' && ' · 手动触发'}
                      {run.error && <span className="text-red-600"> · {run.error}</span>}
                      {hasDigest && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-brand-primary">
                          · <Eye className="size-3" /> 查看摘要
                        </span>
                      )}
                    </p>
                  </button>
                  <button
                    type="button"
                    title="删除记录"
                    disabled={!!busy}
                    onClick={() => handleDeleteRun(run.id)}
                    className="shrink-0 rounded p-1.5 text-shell-muted transition-colors hover:bg-red-500/5 hover:text-red-600 disabled:opacity-50"
                  >
                    {busy === `run-del-${run.id}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
