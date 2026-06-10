'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Brain, Loader2 } from 'lucide-react';
import { HIVEMIND_MEMORIES_PATH } from '@/config/navigation';
import { getSessionPipeline } from '@/lib/kb-api';
import type { SessionPipeline } from '@/lib/kb-types';
import { KnowledgePipelineSteps } from '@/components/knowledge-base/knowledge-pipeline-steps';
import { CATEGORY_LABEL } from '@/lib/kb-labels';
import { cn } from '@/lib/utils';

const POLL_MS = 2500;

type Props = {
  sessionId: string | null;
  extracting?: boolean;
};

export function ChatEvolutionPanel({ sessionId, extracting = false }: Props) {
  const [pipeline, setPipeline] = useState<SessionPipeline | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setPipeline(null);
      return;
    }

    let cancelled = false;
    async function load(silent = false) {
      if (!silent) setLoading(true);
      try {
        const data = await getSessionPipeline(sessionId);
        if (!cancelled) setPipeline(data);
      } catch {
        if (!cancelled) setPipeline(null);
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(() => load(true), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="border-t border-shell-border px-3 py-4">
        <p className="text-[11px] text-shell-muted">开始对话后，可在此看到知识提炼过程</p>
      </div>
    );
  }

  return (
    <div className="border-t border-shell-border">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <Brain className="size-3.5 text-brand-primary" strokeWidth={1.75} />
        <span className="text-[11px] font-medium tracking-wide text-shell-muted">知识管线</span>
        {(loading || extracting) && (
          <Loader2 className="ml-auto size-3 animate-spin text-brand-primary" />
        )}
      </div>

      <div className="space-y-3 px-3 pb-3">
        {pipeline ? (
          <>
            {extracting ? (
              <p className="rounded-lg bg-brand-primary/8 px-2.5 py-2 text-[11px] text-brand-primary">
                正在从本轮对话提炼智慧…
              </p>
            ) : (
              <KnowledgePipelineSteps stages={pipeline.stages} compact />
            )}

            {pipeline.recent.length > 0 ? (
              <ul className="max-h-36 space-y-1 overflow-y-auto custom-scrollbar">
                {pipeline.recent.slice(0, 6).map((item, index) => (
                  <li
                    key={`${item.kind}-${item.id}-${item.created_at}-${index}`}
                    className="rounded-lg bg-shell-bg px-2 py-1.5 text-[11px]"
                  >
                    <span className="text-shell-text">{item.title}</span>
                    <span className="text-shell-muted"> · {item.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[10px] leading-relaxed text-shell-muted">
                回答返回后，后台自动 L1 提炼；重要内容会进入 Wiki 候选池
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-0.5">
              <Link
                href={HIVEMIND_MEMORIES_PATH}
                className="text-[10px] font-medium text-brand-primary hover:underline"
              >
                智慧进化
              </Link>
              <span className="text-shell-muted">·</span>
              <Link
                href="/knowledge-base/overview"
                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-brand-primary hover:underline"
              >
                候选池
                {pipeline.stats.candidate_pending > 0 && (
                  <span className="rounded-full bg-brand-primary/15 px-1.5 text-[9px]">
                    {pipeline.stats.candidate_pending}
                  </span>
                )}
                <ArrowRight className="size-2.5" />
              </Link>
            </div>
          </>
        ) : (
          <p className="py-2 text-[11px] text-shell-muted">加载管线状态…</p>
        )}
      </div>
    </div>
  );
}

export function TurnEvolutionHint({
  extracting,
  pipeline,
}: {
  extracting: boolean;
  pipeline: SessionPipeline | null;
}) {
  if (!extracting && !pipeline) return null;

  const latest = pipeline?.recent[0];
  const showDone = !extracting && latest && pipeline;

  if (extracting) {
    return (
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-brand-primary/20 bg-brand-primary/5 px-3.5 py-2.5">
        <Loader2 className="size-3.5 shrink-0 animate-spin text-brand-primary" />
        <p className="text-[12px] text-brand-primary">
          后台正在提炼本轮智慧（L1）· 通常数秒内完成
        </p>
      </div>
    );
  }

  if (!showDone || !latest) return null;

  const isMemory = latest.kind === 'memory';
  const isCandidate = latest.kind === 'candidate';

  if (!isMemory && !isCandidate) return null;

  return (
    <div
      className={cn(
        'mt-4 rounded-xl border px-3.5 py-2.5',
        isMemory
          ? 'border-brand-primary/20 bg-brand-primary/5'
          : 'border-shell-border bg-shell-bg',
      )}
    >
      <p className="text-[12px] text-shell-text">
        {isMemory && (
          <>
            <span className="font-medium text-brand-primary">智慧已沉淀</span>
            <span className="text-shell-muted"> · {latest.title}（{latest.detail}）</span>
          </>
        )}
        {isCandidate && (
          <>
            <span className="font-medium text-brand-primary">进入 Wiki 候选</span>
            <span className="text-shell-muted">
              {' '}
              · {latest.title}
              {latest.category ? `（${CATEGORY_LABEL[latest.category] ?? latest.category}）` : ''}
            </span>
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] text-shell-muted">
        <Link href={HIVEMIND_MEMORIES_PATH} className="text-brand-primary hover:underline">
          查看智慧进化
        </Link>
        {' · '}
        <Link href="/knowledge-base/overview" className="text-brand-primary hover:underline">
          管理候选池
        </Link>
      </p>
    </div>
  );
}
