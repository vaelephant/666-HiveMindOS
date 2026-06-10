'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { HIVEMIND_MEMORIES_PATH } from '@/config/navigation';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Loader2,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  approveCandidate,
  compileCandidates,
  getCandidateStats,
  listCandidates,
  rejectCandidate,
  resolveCandidates,
} from '@/lib/kb-api';
import type { CandidateStats, KnowledgeCandidate } from '@/lib/kb-types';
import {
  CATEGORY_LABEL,
  CANDIDATE_STATUS_LABEL,
  PROPOSED_ACTION_LABEL,
  SOURCE_LABEL,
} from '@/lib/kb-labels';
import { wikiHref } from '@/lib/wiki-links';
import { cn } from '@/lib/utils';

type StatusFilter = 'pending' | 'approved' | 'conflict' | 'merged' | 'rejected' | 'all';

const FILTERS: { key: StatusFilter; label: string; statKey?: keyof CandidateStats }[] = [
  { key: 'pending', label: '待审核', statKey: 'pending' },
  { key: 'approved', label: '已批准', statKey: 'approved' },
  { key: 'conflict', label: '冲突', statKey: 'conflict' },
  { key: 'merged', label: '已进 Wiki', statKey: 'merged' },
  { key: 'rejected', label: '已驳回', statKey: 'rejected' },
  { key: 'all', label: '全部' },
];

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-500/10 text-amber-700';
    case 'approved':
      return 'bg-brand-primary/10 text-brand-primary';
    case 'merged':
      return 'bg-emerald-500/10 text-emerald-700';
    case 'rejected':
      return 'bg-shell-bg text-shell-muted';
    case 'conflict':
      return 'bg-red-500/10 text-red-600';
    default:
      return 'bg-shell-bg text-shell-muted';
  }
}

const WORKFLOW_STEPS = [
  { step: '1', label: '产生候选', desc: '对话 L1/L2 或文档编译写入候选池' },
  { step: '2', label: '批量解析', desc: 'Resolver 匹配 Wiki、标记冲突' },
  { step: '3', label: '人工批准', desc: '审核内容后批准或驳回' },
  { step: '4', label: '编译进 Wiki', desc: '将已批准候选写入企业 Wiki' },
] as const;

export function HumanReviewView() {
  const [stats, setStats] = useState<CandidateStats | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [items, setItems] = useState<KnowledgeCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const selected = useMemo(
    () => items.find((c) => c.id === selectedId) ?? null,
    [items, selectedId],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        getCandidateStats(),
        listCandidates(filter === 'all' ? undefined : filter, undefined, 200),
      ]);
      setStats(s);
      setItems(list);
      setSelectedId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runBatch(action: 'resolve' | 'compile') {
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'resolve') {
        const res = await resolveCandidates(50);
        setMessage({ tone: 'ok', text: `已解析 ${res.count} 条候选` });
      } else {
        const res = await compileCandidates(30);
        setMessage({ tone: 'ok', text: `已编译 ${res.count} 条进 Wiki` });
      }
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '操作失败' });
    } finally {
      setBusy(null);
    }
  }

  async function review(kind: 'approve' | 'reject') {
    if (!selected) return;
    setBusy(`${kind}-${selected.id}`);
    setMessage(null);
    try {
      if (kind === 'approve') await approveCandidate(selected.id, reason);
      else await rejectCandidate(selected.id, reason);
      setReason('');
      setMessage({
        tone: 'ok',
        text: kind === 'approve' ? '已批准，可批量编译进 Wiki' : '已驳回',
      });
      await refresh();
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '操作失败' });
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = stats?.pending ?? 0;
  const approvedCount = stats?.approved ?? 0;

  return (
    <div className="w-full py-6 md:py-8">
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <UserCheck className="size-6 text-brand-primary" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">HiveMind 运营</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                人工审核
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-shell-muted">
                审核从对话与智慧进化产生的 Wiki 候选，批准后经编译写入企业知识库。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => runBatch('resolve')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-3.5 py-2 text-[13px] font-medium text-shell-text transition-colors hover:border-brand-primary/30 hover:text-brand-primary disabled:opacity-50"
            >
              {busy === 'resolve' ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              批量解析
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-700">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              type="button"
              disabled={!!busy || approvedCount === 0}
              onClick={() => runBatch('compile')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3.5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === 'compile' ? <Loader2 className="size-3.5 animate-spin" /> : <BookOpen className="size-3.5" />}
              编译进 Wiki
              {approvedCount > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{approvedCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-4 md:p-5">
        <p className="mb-3 text-[12px] font-medium text-shell-muted">审核流程</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {WORKFLOW_STEPS.map((s, i) => (
            <div key={s.step} className="flex items-start gap-3 rounded-xl border border-shell-border bg-shell-bg px-3.5 py-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-[11px] font-semibold text-brand-primary">
                {s.step}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-shell-text">{s.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-shell-muted">{s.desc}</p>
              </div>
              {i < WORKFLOW_STEPS.length - 1 && (
                <ChevronRight className="ml-auto hidden size-4 shrink-0 text-shell-muted lg:block" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </section>

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

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
        <div className="flex min-h-[420px] flex-col rounded-2xl border border-shell-border bg-shell-panel">
          <div className="border-b border-shell-border px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const count = f.statKey && stats ? stats[f.statKey] : undefined;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors',
                      filter === f.key
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'text-shell-muted hover:bg-shell-bg hover:text-shell-text',
                    )}
                  >
                    {f.label}
                    {count !== undefined && count > 0 && (
                      <span className="ml-1 tabular-nums opacity-80">({count})</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-shell-muted">
                <Loader2 className="size-4 animate-spin" />
                加载候选…
              </div>
            ) : items.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <p className="text-[14px] font-medium text-shell-text">暂无{FILTERS.find((f) => f.key === filter)?.label}候选</p>
                <p className="mt-2 text-[12px] leading-relaxed text-shell-muted">
                  发起对话并提炼智慧后，符合门槛的内容会自动进入候选池。
                </p>
                <Link
                  href="/hivemind-chat"
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand-primary hover:underline"
                >
                  去 Chat 产生候选
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-shell-border">
                {items.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors hover:bg-shell-bg',
                        selectedId === c.id && 'bg-brand-primary/5',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="line-clamp-1 text-[13px] font-medium text-shell-text">{c.title}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px]',
                            statusBadgeClass(c.status),
                          )}
                        >
                          {CANDIDATE_STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-shell-muted">{c.content}</p>
                      <p className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-shell-muted">
                        <span>{CATEGORY_LABEL[c.category] ?? c.category}</span>
                        <span>·</span>
                        <span>{SOURCE_LABEL[c.source_type] ?? c.source_type}</span>
                        <span>·</span>
                        <span>{timeAgo(c.created_at)}</span>
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex min-h-[420px] flex-col rounded-2xl border border-shell-border bg-shell-panel">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              <UserCheck className="size-10 text-shell-muted/40" strokeWidth={1.25} />
              <p className="mt-4 text-[14px] font-medium text-shell-text">选择一条候选查看详情</p>
              <p className="mt-1 text-[12px] text-shell-muted">左侧列表支持按状态筛选</p>
            </div>
          ) : (
            <>
              <div className="border-b border-shell-border px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-semibold text-shell-text">{selected.title}</h2>
                  <span className="rounded-full bg-shell-bg px-2 py-0.5 text-[10px] text-shell-muted">
                    {CATEGORY_LABEL[selected.category] ?? selected.category}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px]',
                      statusBadgeClass(selected.status),
                    )}
                  >
                    {CANDIDATE_STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <p className="mt-2 text-[12px] text-shell-muted">
                  {SOURCE_LABEL[selected.source_type] ?? selected.source_type}
                  {' · '}
                  置信 {Math.round(selected.confidence * 100)}%
                  {' · '}
                  {PROPOSED_ACTION_LABEL[selected.proposed_action] ?? selected.proposed_action}
                  {' · '}
                  {formatDate(selected.created_at)}
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">内容</p>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-shell-text">
                    {selected.content}
                  </p>
                </div>

                {(selected.resolver_action || selected.resolver_note) && (
                  <div className="rounded-xl border border-shell-border bg-shell-bg px-4 py-3">
                    <p className="text-[11px] font-medium text-shell-muted">Resolver 结果</p>
                    {selected.resolver_action && (
                      <p className="mt-1.5 text-[13px] text-shell-text">
                        建议动作：{PROPOSED_ACTION_LABEL[selected.resolver_action] ?? selected.resolver_action}
                      </p>
                    )}
                    {selected.resolver_note && (
                      <p className="mt-1 text-[12px] leading-relaxed text-shell-muted">{selected.resolver_note}</p>
                    )}
                  </div>
                )}

                {selected.status === 'conflict' && (
                  <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
                    <p className="text-[12px] leading-relaxed text-red-700">
                      检测到与现有 Wiki 内容可能冲突，请仔细核对后再批准或驳回。
                    </p>
                  </div>
                )}

                {selected.target_wiki_path && (
                  <div>
                    <p className="text-[11px] font-medium text-shell-muted">目标 Wiki 路径</p>
                    <Link
                      href={wikiHref(selected.target_wiki_path)}
                      className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-brand-primary hover:underline"
                    >
                      {selected.target_wiki_path}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                )}

                {selected.memory_id != null && (
                  <div>
                    <p className="text-[11px] font-medium text-shell-muted">关联智慧</p>
                    <Link
                      href={HIVEMIND_MEMORIES_PATH}
                      className="mt-1 inline-flex items-center gap-1 text-[13px] text-brand-primary hover:underline"
                    >
                      查看智慧进化 #{selected.memory_id}
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {(selected.status === 'pending' || selected.status === 'conflict') && (
                <div className="border-t border-shell-border px-5 py-4">
                  <label className="block text-[11px] font-medium text-shell-muted">
                    审核备注（可选）
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="批准或驳回原因…"
                    className="mt-1.5 w-full resize-none rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text placeholder:text-shell-muted focus:border-brand-primary/40 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => review('approve')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {busy === `approve-${selected.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      批准
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => review('reject')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-4 py-2 text-[13px] font-medium text-shell-muted transition-colors hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-600 disabled:opacity-50"
                    >
                      {busy === `reject-${selected.id}` ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <X className="size-3.5" />
                      )}
                      驳回
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'approved' && (
                <div className="border-t border-shell-border px-5 py-4">
                  <p className="text-[12px] text-shell-muted">
                    已批准，点击页头「编译进 Wiki」批量写入企业知识库。
                  </p>
                </div>
              )}

              {selected.status === 'merged' && selected.target_wiki_path && (
                <div className="border-t border-shell-border px-5 py-4">
                  <Link
                    href={wikiHref(selected.target_wiki_path)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/8 px-4 py-2 text-[13px] font-medium text-brand-primary transition-colors hover:bg-brand-primary/12"
                  >
                    <BookOpen className="size-3.5" />
                    在 Wiki 中查看
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
