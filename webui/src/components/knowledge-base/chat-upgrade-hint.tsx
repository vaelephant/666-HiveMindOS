'use client';

import { ArrowRight, Sparkles } from 'lucide-react';
import type { UpgradeSuggestion } from '@/lib/chat-task-upgrade';
import { cn } from '@/lib/utils';

export function ChatUpgradeTurnHint({
  suggestion,
  onUpgrade,
}: {
  suggestion: UpgradeSuggestion;
  onUpgrade: () => void;
}) {
  if (!suggestion.recommended || suggestion.strength !== 'strong') return null;

  return (
    <div className="mt-4 rounded-xl border border-brand-primary/25 bg-brand-primary/5 px-3.5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[12px] font-medium text-brand-primary">
            <Sparkles className="size-3.5 shrink-0" />
            推荐升级为自主任务
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-shell-text">
            {suggestion.reason}
            <span className="text-shell-muted"> · 预估 {suggestion.taskTypeLabel}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-on-primary hover:opacity-90"
        >
          升级
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ChatUpgradeSessionBanner({
  suggestion,
  turnCount,
  onUpgrade,
}: {
  suggestion: UpgradeSuggestion;
  turnCount: number;
  onUpgrade: () => void;
}) {
  if (!suggestion.recommended || suggestion.strength !== 'weak' || turnCount < 2) return null;

  return (
    <div
      className={cn(
        'mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2',
        'border-shell-border bg-shell-panel/80',
      )}
    >
      <p className="text-[12px] text-shell-muted">
        本对话含 {turnCount} 轮上下文
        <span className="text-shell-text"> · {suggestion.reason}</span>
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
      >
        <Sparkles className="size-3.5" />
        从此对话创建任务
      </button>
    </div>
  );
}
