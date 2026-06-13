'use client';

import { useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { ChatTurn } from '@/lib/kb-types';
import { formatTurnForCopy } from '@/lib/chat-turn-export';
import { cn } from '@/lib/utils';

type Props = {
  turn: ChatTurn;
  turnIndex: number;
  sessionId: string | null;
  onCreateTask?: () => void;
  onEnqueue?: (turnIndex: number) => Promise<void>;
  onShowSources?: () => void;
  hasSources: boolean;
};

export function ChatTurnActions({
  turn,
  turnIndex,
  sessionId,
  onCreateTask,
  onEnqueue,
  onShowSources,
  hasSources,
}: Props) {
  const [copyOk, setCopyOk] = useState(false);
  const [enqueueBusy, setEnqueueBusy] = useState(false);
  const [enqueueOk, setEnqueueOk] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formatTurnForCopy(turn));
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 2000);
    } catch {
      /* clipboard denied */
    }
  }

  async function handleEnqueue() {
    if (!onEnqueue || enqueueBusy) return;
    setEnqueueBusy(true);
    setEnqueueOk(false);
    try {
      await onEnqueue(turnIndex);
      setEnqueueOk(true);
      window.setTimeout(() => setEnqueueOk(false), 3000);
    } finally {
      setEnqueueBusy(false);
    }
  }

  const btnClass =
    'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-shell-muted transition-colors hover:bg-shell-bg hover:text-shell-text disabled:opacity-40';

  return (
    <div className="mt-2 flex flex-wrap items-center gap-0.5 border-t border-shell-border/50 pt-2">
      {onCreateTask && (
        <button type="button" onClick={onCreateTask} className={btnClass}>
          <Bot className="size-3.5 shrink-0" aria-hidden />
          发起自主任务
        </button>
      )}
      {sessionId && onEnqueue && (
        <button
          type="button"
          onClick={() => void handleEnqueue()}
          disabled={enqueueBusy}
          className={cn(btnClass, enqueueOk && 'text-brand-primary')}
        >
          {enqueueBusy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : enqueueOk ? (
            <Check className="size-3.5" aria-hidden />
          ) : (
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
          )}
          {enqueueOk ? '已写入候选池' : '写入候选池'}
        </button>
      )}
      {hasSources && onShowSources && (
        <button type="button" onClick={onShowSources} className={btnClass}>
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          查看来源
        </button>
      )}
      <button type="button" onClick={() => void handleCopy()} className={cn(btnClass, copyOk && 'text-brand-primary')}>
        {copyOk ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5 shrink-0" aria-hidden />}
        {copyOk ? '已复制' : '复制带出处'}
      </button>
    </div>
  );
}
