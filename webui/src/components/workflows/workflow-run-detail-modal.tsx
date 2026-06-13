'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, X, XCircle } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import {
  formatWorkflowStepBullets,
  type WorkflowStep,
} from '@/lib/audit-labels';
import { getWorkflowRun } from '@/lib/kb-api';
import type { WorkflowRun } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const WORKFLOW_LABELS: Record<string, string> = {
  nightly_knowledge_pipeline: '夜间知识管线',
  morning_digest: '晨间智慧摘要',
  wiki_sync_pipeline: 'Wiki 同步管线',
};

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

type Props = {
  runId: string | null;
  onClose: () => void;
};

export function WorkflowRunDetailModal({ runId, onClose }: Props) {
  const { orgId, ready } = useOrgReady();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !ready || !orgId) {
      setRun(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getWorkflowRun(runId, orgId)
      .then((data) => {
        if (!cancelled) setRun(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runId, ready, orgId]);

  if (!runId) return null;

  const summary = run?.summary ?? {};
  const steps = (summary.steps as WorkflowStep[] | undefined) ?? [];
  const bullets = formatWorkflowStepBullets(steps);
  const wfLabel = WORKFLOW_LABELS[run?.workflow_id ?? ''] ?? run?.workflow_id ?? '工作流';
  const triggerLabel = run?.trigger === 'cron' ? '定时' : '手动';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-2xl border border-shell-border bg-shell-panel shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflow-run-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-shell-border px-5 py-4">
          <div>
            <p className="text-[11px] font-medium text-shell-muted">工作流运行详情</p>
            <h2 id="workflow-run-title" className="mt-0.5 text-[16px] font-semibold text-shell-text">
              {wfLabel}
            </h2>
            {run && (
              <p className="mt-1 text-[12px] text-shell-muted">
                {triggerLabel} · {formatTime(run.started_at)}
                {run.finished_at ? ` → ${formatTime(run.finished_at)}` : ''}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-shell-muted hover:bg-shell-bg hover:text-shell-text"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-shell-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              加载运行记录…
            </div>
          )}
          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[13px] text-red-600">
              {error}
            </p>
          )}
          {run && !loading && (
            <>
              <div className="mb-4 flex items-center gap-2">
                {run.status === 'error' ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span
                  className={cn(
                    'text-[13px] font-medium',
                    run.status === 'error' ? 'text-red-600' : 'text-emerald-700',
                  )}
                >
                  {run.status === 'error' ? '执行失败' : '执行成功'}
                </span>
              </div>
              {run.error && (
                <p className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[12px] text-red-700">
                  {run.error}
                </p>
              )}
              {bullets.length > 0 ? (
                <ul className="space-y-1.5 rounded-lg border border-shell-border bg-shell-bg/80 px-3 py-2">
                  {bullets.map((line, i) => (
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
              ) : (
                <p className="text-[13px] text-shell-muted">暂无步骤明细</p>
              )}
              <p className="mt-3 font-mono text-[10px] text-shell-muted">run_id: {run.id}</p>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-shell-border px-5 py-3">
          <Link
            href="/workflows"
            className="rounded-lg border border-shell-border px-3 py-1.5 text-[12px] font-medium text-shell-text hover:bg-shell-bg"
            onClick={onClose}
          >
            打开工作流
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-white hover:opacity-90"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
