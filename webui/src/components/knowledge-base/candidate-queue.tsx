'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import {
  approveCandidate,
  compileCandidates,
  listCandidates,
  rejectCandidate,
  resolveCandidates,
} from '@/lib/kb-api';
import type { KnowledgeCandidate } from '@/lib/kb-types';
import { CATEGORY_LABEL, CANDIDATE_STATUS_LABEL, SOURCE_LABEL } from '@/lib/kb-labels';
import { cn } from '@/lib/utils';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function CandidateQueue() {
  const [items, setItems] = useState<KnowledgeCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pending = await listCandidates('pending');
      const approved = await listCandidates('approved');
      setItems([...pending, ...approved].slice(0, 30));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runBatch(action: 'resolve' | 'compile') {
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'resolve') {
        const res = await resolveCandidates(30);
        setMessage(`已解析 ${res.count} 条候选`);
      } else {
        const res = await compileCandidates(20);
        setMessage(`已编译 ${res.count} 条进 Wiki`);
      }
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(null);
    }
  }

  async function review(id: number, kind: 'approve' | 'reject') {
    setBusy(`${kind}-${id}`);
    try {
      if (kind === 'approve') await approveCandidate(id);
      else await rejectCandidate(id);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载候选队列…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-shell-muted">
          待审核与已批准候选，可解析后编译进 Wiki
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => runBatch('resolve')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-3 py-1.5 text-[12px] font-medium text-shell-text transition-colors hover:border-brand-primary/30 hover:text-brand-primary disabled:opacity-50"
          >
            {busy === 'resolve' ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
            批量解析
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => runBatch('compile')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === 'compile' ? <Loader2 className="size-3 animate-spin" /> : null}
            编译进 Wiki
          </button>
        </div>
      </div>

      {message && (
        <p className="rounded-lg bg-brand-primary/8 px-3 py-2 text-[12px] text-brand-primary">{message}</p>
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-shell-muted">
          暂无待处理候选。发起对话并提炼智慧后，符合门槛的内容会自动进入此队列。
        </p>
      ) : (
        <ul className="divide-y divide-shell-border rounded-xl border border-shell-border">
          {items.map((c) => (
            <li key={c.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-shell-text">{c.title}</span>
                  <span className="rounded-full bg-shell-bg px-2 py-0.5 text-[10px] text-shell-muted">
                    {CATEGORY_LABEL[c.category] ?? c.category}
                  </span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px]',
                      c.status === 'approved'
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'bg-shell-bg text-shell-muted',
                    )}
                  >
                    {CANDIDATE_STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-shell-muted">{c.content}</p>
                <p className="mt-1.5 text-[11px] text-shell-muted">
                  {SOURCE_LABEL[c.source_type] ?? c.source_type}
                  {' · '}
                  置信 {Math.round(c.confidence * 100)}%
                  {' · '}
                  {timeAgo(c.created_at)}
                  {c.target_wiki_path && (
                    <>
                      {' · '}
                      <Link
                        href={`/knowledge-base/wiki?page=${encodeURIComponent(c.target_wiki_path)}`}
                        className="text-brand-primary hover:underline"
                      >
                        {c.target_wiki_path}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {c.status === 'pending' && (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    title="批准"
                    disabled={!!busy}
                    onClick={() => review(c.id, 'approve')}
                    className="flex size-8 items-center justify-center rounded-lg border border-shell-border text-brand-primary transition-colors hover:bg-brand-primary/8 disabled:opacity-50"
                  >
                    {busy === `approve-${c.id}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    title="驳回"
                    disabled={!!busy}
                    onClick={() => review(c.id, 'reject')}
                    className="flex size-8 items-center justify-center rounded-lg border border-shell-border text-shell-muted transition-colors hover:bg-red-500/8 hover:text-red-600 disabled:opacity-50"
                  >
                    {busy === `reject-${c.id}` ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
