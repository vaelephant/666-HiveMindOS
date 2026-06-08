'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Archive,
  Brain,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { deleteChatSession } from '@/lib/kb-api';
import type { SessionRecapResult } from '@/lib/kb-types';
import { CATEGORY_LABEL } from '@/lib/kb-labels';
import { cn } from '@/lib/utils';

type Phase = 'confirm' | 'loading' | 'result' | 'error';

type Props = {
  sessionId: string | null;
  sessionTitle: string;
  onClose: () => void;
  onDeleted: (sessionId: string) => void;
};

export function ChatDeleteSessionDialog({
  sessionId,
  sessionTitle,
  onClose,
  onDeleted,
}: Props) {
  const [phase, setPhase] = useState<Phase>('confirm');
  const [withRecap, setWithRecap] = useState(true);
  const [recap, setRecap] = useState<SessionRecapResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      setPhase('confirm');
      setWithRecap(true);
      setRecap(null);
      setErrorMsg(null);
    }
  }, [sessionId]);

  if (!sessionId) return null;

  async function handleDelete() {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const res = await deleteChatSession(sessionId!, { recap: withRecap });
      if (withRecap && res.recap) {
        setRecap(res.recap);
        setPhase('result');
      } else {
        onDeleted(sessionId!);
        onClose();
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '删除失败');
      setPhase('error');
    }
  }

  function handleDone() {
    onDeleted(sessionId!);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-session-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-shell-border bg-shell-panel shadow-xl">
        <button
          type="button"
          onClick={onClose}
          disabled={phase === 'loading'}
          className="absolute right-3 top-3 rounded-lg p-1 text-shell-muted transition-colors hover:bg-shell-bg hover:text-shell-text disabled:opacity-40"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>

        {phase === 'confirm' && (
          <ConfirmView
            sessionTitle={sessionTitle}
            withRecap={withRecap}
            onRecapChange={setWithRecap}
            onCancel={onClose}
            onDelete={handleDelete}
          />
        )}

        {phase === 'loading' && (
          <LoadingView withRecap={withRecap} sessionTitle={sessionTitle} />
        )}

        {phase === 'result' && recap && (
          <RecapResultView recap={recap} onDone={handleDone} />
        )}

        {phase === 'error' && (
          <ErrorView
            message={errorMsg ?? '未知错误'}
            onClose={onClose}
            onRetry={() => setPhase('confirm')}
          />
        )}
      </div>
    </div>
  );
}

function ConfirmView({
  sessionTitle,
  withRecap,
  onRecapChange,
  onCancel,
  onDelete,
}: {
  sessionTitle: string;
  withRecap: boolean;
  onRecapChange: (v: boolean) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="p-5 pt-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-error/10">
          <Trash2 className="size-4 text-status-error" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 pr-6">
          <h2 id="delete-session-title" className="text-[15px] font-semibold text-shell-text">
            删除对话
          </h2>
          <p className="mt-1 truncate text-[13px] text-shell-muted" title={sessionTitle}>
            「{sessionTitle}」
          </p>
        </div>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-shell-border bg-shell-bg px-3.5 py-3 transition-colors has-[:checked]:border-brand-primary/30 has-[:checked]:bg-brand-primary/5">
        <input
          type="checkbox"
          checked={withRecap}
          onChange={(e) => onRecapChange(e.target.checked)}
          className="mt-0.5 size-4 rounded border-shell-border text-brand-primary focus:ring-brand-primary/30"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-shell-text">
            <Brain className="size-3.5 text-brand-primary" />
            删除前进行 L2 会话复盘
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-shell-muted">
            整段对话合并提炼、去重归档，并生成 Wiki 候选建议（约 10–30 秒）
          </span>
        </span>
      </label>

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-shell-border px-4 py-2 text-[13px] font-medium text-shell-subtext transition-colors hover:bg-shell-bg"
        >
          取消
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg bg-status-error px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          {withRecap ? '复盘并删除' : '直接删除'}
        </button>
      </div>
    </div>
  );
}

function LoadingView({
  withRecap,
  sessionTitle,
}: {
  withRecap: boolean;
  sessionTitle: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Loader2 className="size-8 animate-spin text-brand-primary" />
      <p className="mt-4 text-[14px] font-medium text-shell-text">
        {withRecap ? '正在进行 L2 会话复盘…' : '正在删除…'}
      </p>
      <p className="mt-2 max-w-xs text-[12px] leading-relaxed text-shell-muted">
        {withRecap
          ? `正在分析「${sessionTitle}」中的碎片智慧，合并升级并写入候选池`
          : '请稍候'}
      </p>
    </div>
  );
}

function RecapResultView({
  recap,
  onDone,
}: {
  recap: SessionRecapResult;
  onDone: () => void;
}) {
  const updated = recap.memory_ids.length;
  const archived = recap.archived_ids.length;
  const wikiHints = recap.wiki_suggestions.length;
  const conflicts = recap.conflicts.length;

  return (
    <div className="max-h-[min(80vh,520px)] overflow-y-auto p-5 pt-6 custom-scrollbar">
      <div className="flex items-start gap-3 pr-6">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
          <Sparkles className="size-4 text-brand-primary" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold text-shell-text">L2 复盘完成</h2>
          <p className="mt-0.5 text-[12px] text-shell-muted">对话已删除，智慧已整理入库</p>
        </div>
      </div>

      {recap.summary && recap.summary !== '会话过短，跳过复盘' && (
        <div className="mt-4 rounded-xl border border-shell-border bg-shell-bg px-3.5 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">会话摘要</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-shell-text">{recap.summary}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <StatPill icon={Brain} label="智慧更新" value={updated} accent={updated > 0} />
        <StatPill icon={Archive} label="去重归档" value={archived} />
        <StatPill icon={Sparkles} label="Wiki 建议" value={wikiHints} accent={wikiHints > 0} />
      </div>

      {wikiHints > 0 && (
        <ul className="mt-4 space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">
            已进入候选池
          </p>
          {recap.wiki_suggestions.map((w, i) => (
            <li
              key={`${w.title}-${i}`}
              className="rounded-lg border border-shell-border bg-shell-bg px-3 py-2"
            >
              <p className="text-[13px] font-medium text-shell-text">{w.title}</p>
              <p className="mt-0.5 text-[11px] text-shell-muted">
                {CATEGORY_LABEL[w.category] ?? w.category} · {w.reason}
              </p>
            </li>
          ))}
        </ul>
      )}

      {conflicts > 0 && (
        <div className="mt-4 rounded-xl border border-status-warning/30 bg-status-warning/5 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-status-warning">
            <AlertTriangle className="size-3.5" />
            发现 {conflicts} 处冲突
          </p>
          <ul className="mt-2 space-y-1.5">
            {recap.conflicts.map((c, i) => (
              <li key={i} className="text-[12px] text-shell-subtext">
                <span className="font-medium">{c.field}</span>：{c.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-[11px] text-shell-muted">
        <Link href="/memories" className="text-brand-primary hover:underline">
          智慧进化
        </Link>
        {' · '}
        <Link href="/knowledge-base/overview" className="text-brand-primary hover:underline">
          待晋升 Wiki
        </Link>
      </p>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-brand-primary px-5 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          完成
        </button>
      </div>
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-2.5 py-2 text-center',
        accent ? 'border-brand-primary/25 bg-brand-primary/5' : 'border-shell-border bg-shell-bg',
      )}
    >
      <Icon
        className={cn('mx-auto size-3.5', accent ? 'text-brand-primary' : 'text-shell-muted')}
        strokeWidth={1.75}
      />
      <p className="mt-1 text-[16px] font-semibold tabular-nums text-shell-text">{value}</p>
      <p className="text-[10px] text-shell-muted">{label}</p>
    </div>
  );
}

function ErrorView({
  message,
  onClose,
  onRetry,
}: {
  message: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="p-5 pt-6">
      <p className="text-[14px] font-medium text-status-error">操作失败</p>
      <p className="mt-2 text-[13px] text-shell-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-shell-border px-4 py-2 text-[13px] text-shell-subtext"
        >
          关闭
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white"
        >
          重试
        </button>
      </div>
    </div>
  );
}
