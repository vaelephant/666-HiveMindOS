'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Brain, Loader2, MessageSquare, Sparkles, X } from 'lucide-react';
import type { ChatTurn } from '@/lib/kb-types';
import {
  buildUpgradeConstraints,
  collectMemoryIds,
  collectWikiPaths,
  type UpgradeContextOptions,
  type UpgradeSuggestion,
} from '@/lib/chat-task-upgrade';

type Props = {
  open: boolean;
  suggestion: UpgradeSuggestion | null;
  turns: ChatTurn[];
  sessionId: string | null;
  submitting?: boolean;
  onClose: () => void;
  onConfirm: (goal: string, constraints: Record<string, unknown>) => void;
};

export function ChatUpgradeDialog({
  open,
  suggestion,
  turns,
  sessionId,
  submitting = false,
  onClose,
  onConfirm,
}: Props) {
  const [goal, setGoal] = useState('');
  const [options, setOptions] = useState<UpgradeContextOptions>({
    includeTurns: true,
    includeSessionId: true,
    turnLimit: 5,
  });

  const slice = turns.slice(-(options.turnLimit ?? 5));
  const wikiCount = collectWikiPaths(slice).length;
  const memoryCount = collectMemoryIds(slice).length;

  useEffect(() => {
    if (open && suggestion) {
      setGoal(suggestion.suggestedGoal);
    }
  }, [open, suggestion]);

  const constraints = useMemo(
    () => (open ? buildUpgradeConstraints(sessionId, turns, options) : {}),
    [open, sessionId, turns, options],
  );

  if (!open || !suggestion) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="chat-upgrade-title"
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-shell-border bg-shell-panel shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-shell-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10">
              <Sparkles className="size-5 text-brand-primary" />
            </div>
            <div>
              <h2 id="chat-upgrade-title" className="text-[16px] font-semibold text-shell-text">
                升级为自主任务
              </h2>
              <p className="mt-0.5 text-[12px] text-shell-muted">{suggestion.reason}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-shell-muted hover:bg-shell-bg hover:text-shell-text"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <label className="text-[12px] font-medium text-shell-muted">任务目标</label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-xl border border-shell-border bg-shell-bg px-3 py-2.5 text-[14px] text-shell-text outline-none focus:border-brand-primary/40 focus:ring-1 focus:ring-brand-primary/20"
            />
          </div>

          <div className="rounded-xl border border-shell-border bg-shell-bg p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-shell-muted">预估类型</p>
            <p className="mt-1 text-[14px] font-medium text-shell-text">{suggestion.taskTypeLabel}</p>
            <p className="mt-2 text-[12px] text-shell-muted">
              {suggestion.estimatedSteps.join(' → ')}
            </p>
          </div>

          <div>
            <p className="text-[12px] font-medium text-shell-muted">将带入的上下文</p>
            <ul className="mt-2 space-y-2">
              <li>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-shell-border px-3 py-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={options.includeTurns}
                    onChange={(e) => setOptions((o) => ({ ...o, includeTurns: e.target.checked }))}
                    className="accent-brand-primary"
                  />
                  <MessageSquare className="size-4 shrink-0 text-shell-muted" />
                  <span className="text-shell-text">
                    最近 {Math.min(turns.length, options.turnLimit ?? 5)} 轮对话
                  </span>
                </label>
              </li>
              <li>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-shell-border px-3 py-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={options.includeSessionId}
                    onChange={(e) => setOptions((o) => ({ ...o, includeSessionId: e.target.checked }))}
                    className="accent-brand-primary"
                  />
                  <MessageSquare className="size-4 shrink-0 text-shell-muted" />
                  <span className="text-shell-text">关联会话 ID（供提炼步骤使用）</span>
                </label>
              </li>
              {wikiCount > 0 && (
                <li className="flex items-center gap-2.5 rounded-lg border border-dashed border-shell-border px-3 py-2 text-[12px] text-shell-muted">
                  <BookOpen className="size-4 shrink-0 text-brand-primary" />
                  已引用 Wiki 页面 {wikiCount} 个
                </li>
              )}
              {memoryCount > 0 && (
                <li className="flex items-center gap-2.5 rounded-lg border border-dashed border-shell-border px-3 py-2 text-[12px] text-shell-muted">
                  <Brain className="size-4 shrink-0 text-brand-primary" />
                  已召回智慧记忆 {memoryCount} 条
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-shell-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-shell-border px-4 py-2 text-[13px] text-shell-muted hover:bg-shell-bg"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!goal.trim() || submitting}
            onClick={() => onConfirm(goal.trim(), constraints)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-brand-on-primary disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            启动自主任务
          </button>
        </div>
      </div>
    </div>
  );
}
