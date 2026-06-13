'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  Shield,
  User,
} from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { WorkflowRunDetailModal } from '@/components/workflows/workflow-run-detail-modal';
import { formatAuditEvent } from '@/lib/audit-labels';
import { auditExportUrl, getAuditEvents } from '@/lib/kb-api';
import type { AuditEvent, AuditStats } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { days: 1, label: '今日' },
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
] as const;

const CATEGORY_FILTERS = [
  { key: '', label: '全部' },
  { key: 'task', label: '任务' },
  { key: 'wiki', label: 'Wiki' },
  { key: 'candidate', label: '候选池' },
  { key: 'communicate', label: '对外通信' },
  { key: 'deliverable', label: '交付物' },
  { key: 'lint', label: '质量巡检' },
  { key: 'automation', label: '自动化' },
] as const;

const STATUS_FILTERS = [
  { key: '', label: '全部状态' },
  { key: 'success', label: '成功' },
  { key: 'error', label: '失败' },
] as const;

const PAGE_SIZE = 80;

const CATEGORY_LABEL: Record<string, string> = {
  task: '任务',
  wiki: 'Wiki',
  candidate: '候选池',
  communicate: '对外通信',
  deliverable: '交付物',
  lint: '质量巡检',
  automation: '自动化',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function statusIcon(status: string) {
  if (status === 'error') {
    return <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden={true} />;
  }
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden={true} />;
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-shell-border bg-shell-panel px-4 py-3.5">
      <p className="text-[12px] text-shell-muted">{label}</p>
      <p
        className={cn(
          'mt-1.5 text-[26px] font-semibold tabular-nums leading-none',
          accent ? 'text-brand-primary' : 'text-shell-text',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-[11px] text-shell-subtext">{hint}</p> : null}
    </div>
  );
}

function AuditEventRow({
  ev,
  onOpenRun,
}: {
  ev: AuditEvent;
  onOpenRun: (runId: string) => void;
}) {
  const display = formatAuditEvent(ev);
  const autoExpand =
    (ev.action === 'wiki.lint' || ev.action === 'workflow.run') && display.bullets.length > 0;
  const [open, setOpen] = useState(autoExpand);
  const hasDetails = display.bullets.length > 0;

  return (
    <li className="px-4 py-3 hover:bg-shell-bg/60">
      <div className="flex items-start gap-3">
        {statusIcon(ev.status)}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-shell-bg px-2 py-0.5 text-[11px] font-medium text-shell-muted">
              {CATEGORY_LABEL[ev.category] ?? ev.category}
            </span>
            <span className="text-[11px] text-shell-muted">{formatTime(ev.created_at)}</span>
            {display.actorLabel && (
              <span className="inline-flex items-center gap-1 text-[11px] text-shell-muted">
                <User className="h-3 w-3 opacity-60" aria-hidden />
                操作人 · {display.actorLabel}
              </span>
            )}
            {ev.status === 'error' && (
              <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600">
                失败
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[14px] font-medium leading-snug text-shell-text">{display.title}</p>
          {display.description && (
            <p className="mt-0.5 text-[13px] text-shell-muted">{display.description}</p>
          )}
          {(display.links.length > 0 || display.workflowRunId) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {display.links.map((link) => (
                <Link
                  key={`${link.label}-${link.href}`}
                  href={link.href}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-primary/25 bg-brand-primary/5 px-2.5 py-1 text-[12px] font-medium text-brand-primary hover:bg-brand-primary/10"
                >
                  {link.label}
                  <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
                </Link>
              ))}
              {display.workflowRunId && (
                <button
                  type="button"
                  onClick={() => onOpenRun(display.workflowRunId!)}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-primary/25 bg-brand-primary/5 px-2.5 py-1 text-[12px] font-medium text-brand-primary hover:bg-brand-primary/10"
                >
                  查看运行详情
                </button>
              )}
            </div>
          )}
          {hasDetails && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
              >
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
                  aria-hidden
                />
                {open ? '收起详情' : `查看 ${display.bullets.length} 项详情`}
              </button>
              {open && (
                <ul className="mt-2 space-y-1.5 rounded-lg border border-shell-border bg-shell-bg/80 px-3 py-2">
                  {display.bullets.map((line, i) => (
                    <li key={i} className="text-[12px] leading-relaxed text-shell-text">
                      {line.href ? (
                        <Link href={line.href} className="text-brand-primary hover:underline">
                          {line.text}
                        </Link>
                      ) : (
                        line.text
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

export function AuditLogView() {
  const { orgId, ready } = useOrgReady();
  const [days, setDays] = useState<number>(7);
  const [category, setCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runModalId, setRunModalId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const queryOptions = useMemo(
    () => ({
      orgId,
      days,
      category: category || undefined,
      status: statusFilter || undefined,
      q: searchQuery || undefined,
      limit: PAGE_SIZE,
    }),
    [orgId, days, category, statusFilter, searchQuery],
  );

  const load = useCallback(async () => {
    if (!ready || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditEvents({ ...queryOptions, offset: 0 });
      setEvents(data.events);
      setStats(data.stats);
      setHasMore(data.events.length >= PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [ready, queryOptions]);

  const loadMore = useCallback(async () => {
    if (!ready || !orgId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await getAuditEvents({ ...queryOptions, offset: events.length });
      setEvents((prev) => [...prev, ...data.events]);
      setHasMore(data.events.length >= PAGE_SIZE);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载更多失败');
    } finally {
      setLoadingMore(false);
    }
  }, [ready, orgId, loadingMore, hasMore, queryOptions, events.length]);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of stats?.by_category ?? []) {
      map.set(row.category, row.count);
    }
    return map;
  }, [stats]);

  const errorCount = useMemo(() => {
    return (stats?.by_status ?? []).find((r) => r.status === 'error')?.count ?? 0;
  }, [stats]);

  const periodLabel = PERIOD_OPTIONS.find((o) => o.days === days)?.label ?? `${days} 天`;

  function handleExport(format: 'csv' | 'json') {
    if (!orgId) return;
    const url = auditExportUrl({
      orgId,
      days,
      category: category || undefined,
      status: statusFilter || undefined,
      q: searchQuery || undefined,
      format,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="w-full space-y-4 py-6 md:space-y-5 md:py-8">
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <Shield className="size-6 text-brand-primary" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">HiveMind 治理</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                审计日志
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-shell-muted">
                记录工作流、Wiki、候选审核与企微发送。支持搜索、导出，并可从候选/任务事件跳回来源对话。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-3.5 py-2 text-[13px] font-medium text-shell-text transition-colors hover:border-brand-primary/30 hover:text-brand-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            刷新
          </button>
        </div>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-shell-muted" aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索摘要、操作、资源 ID…"
            className="w-full rounded-lg border border-shell-border bg-shell-panel py-2 pl-9 pr-3 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-panel px-3 py-2 text-[12px] font-medium text-shell-text hover:bg-shell-bg"
          >
            <Download className="size-3.5" aria-hidden />
            导出 CSV
          </button>
          <button
            type="button"
            onClick={() => handleExport('json')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-panel px-3 py-2 text-[12px] font-medium text-shell-text hover:bg-shell-bg"
          >
            <Download className="size-3.5" aria-hidden />
            导出 JSON
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            type="button"
            onClick={() => setDays(opt.days)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
              days === opt.days
                ? 'bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/20'
                : 'border border-shell-border bg-shell-panel text-shell-muted hover:text-shell-text',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="事件总数"
            value={stats.total}
            hint={`近 ${periodLabel}`}
            accent
          />
          <StatCard
            label="失败事件"
            value={errorCount}
            hint={stats.total > 0 ? `占 ${Math.round((errorCount / stats.total) * 100)}%` : undefined}
            accent={errorCount > 0}
          />
          {stats.by_category.slice(0, 2).map((row) => (
            <StatCard
              key={row.category}
              label={CATEGORY_LABEL[row.category] ?? row.category}
              value={row.count}
              hint={
                stats.total > 0
                  ? `占 ${Math.round((row.count / stats.total) * 100)}%`
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key || 'all-status'}
            type="button"
            onClick={() => setStatusFilter(f.key)}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              statusFilter === f.key
                ? f.key === 'error'
                  ? 'bg-red-500/12 text-red-600 ring-1 ring-red-500/25'
                  : 'bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary/30'
                : 'border border-shell-border bg-shell-panel text-shell-muted hover:text-shell-text',
            )}
          >
            {f.label}
            {f.key === 'error' && errorCount > 0 ? ` (${errorCount})` : ''}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            type="button"
            onClick={() => setCategory(f.key)}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
              category === f.key
                ? 'bg-brand-primary/15 text-brand-primary ring-1 ring-brand-primary/30'
                : 'border border-shell-border bg-shell-panel text-shell-muted hover:text-shell-text',
            )}
          >
            {f.label}
            {f.key && categoryCounts.has(f.key) ? ` (${categoryCounts.get(f.key)})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-shell-border bg-shell-panel">
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-shell-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
            加载审计记录…
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-shell-muted">
            <ScrollText className="h-8 w-8 opacity-40" aria-hidden />
            <p className="text-[13px]">
              {searchQuery ? `未找到与「${searchQuery}」匹配的审计记录` : '该时段暂无审计记录'}
            </p>
            <p className="text-[12px]">运行工作流、写入 Wiki 或发送企微消息后将自动记录</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-shell-border">
              {events.map((ev) => (
                <AuditEventRow key={ev.id} ev={ev} onOpenRun={setRunModalId} />
              ))}
            </ul>
            {hasMore && (
              <div className="border-t border-shell-border px-4 py-3 text-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-4 py-2 text-[13px] font-medium text-shell-text hover:border-brand-primary/30 hover:text-brand-primary disabled:opacity-50"
                >
                  {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  加载更多
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {events.length > 0 && (
        <p className="text-center text-[12px] text-shell-muted">
          已显示 {events.length} 条{hasMore ? '，还有更多记录' : ''}
        </p>
      )}
      <WorkflowRunDetailModal runId={runModalId} onClose={() => setRunModalId(null)} />
    </div>
  );
}
