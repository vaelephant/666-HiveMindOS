'use client';

import { History, Plus, Trash2 } from 'lucide-react';
import { ChatEvolutionPanel } from '@/components/knowledge-base/chat-evolution-panel';
import type { ChatSessionSummary } from '@/lib/kb-types';

type Props = {
  sessions: ChatSessionSummary[];
  activeId: string | null;
  loading?: boolean;
  onNew: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  extracting?: boolean;
};

function HistorySkeleton() {
  return (
    <ul className="space-y-1 px-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="h-9 animate-pulse rounded-lg bg-shell-border/40"
          style={{ animationDelay: `${i * 80}ms` }}
        />
      ))}
    </ul>
  );
}

export function ChatHistorySidebar({
  sessions,
  activeId,
  loading = false,
  onNew,
  onSelect,
  onDelete,
  extracting = false,
}: Props) {
  return (
    <aside className="flex h-full w-56 shrink-0 flex-col overflow-hidden border-r border-shell-border bg-shell-panel/50 lg:w-60">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-shell-border bg-shell-panel px-3 py-2.5 text-[13px] font-medium text-shell-text shadow-sm transition-colors hover:border-brand-primary/30 hover:text-brand-primary"
        >
          <Plus className="size-4" strokeWidth={1.75} />
          新建
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
        <div className="flex items-center gap-1.5 px-2 py-2">
          <History className="size-3.5 text-shell-muted" strokeWidth={1.75} />
          <span className="text-[11px] font-medium tracking-wide text-shell-muted">历史</span>
          {loading && sessions.length > 0 ? (
            <span className="ml-auto size-1.5 animate-pulse rounded-full bg-brand-primary" />
          ) : null}
        </div>

        <ul className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto">
          {loading && sessions.length === 0 ? (
            <li className="px-1">
              <HistorySkeleton />
            </li>
          ) : sessions.length === 0 ? (
            <li className="px-2 py-6 text-center text-[12px] text-shell-muted">暂无对话</li>
          ) : (
            sessions.map((s) => {
              const active = s.id === activeId;
              return (
                <li key={s.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className={`w-full truncate rounded-lg px-2.5 py-2 pr-8 text-left text-[13px] transition-colors ${
                      active
                        ? 'bg-brand-primary/10 font-medium text-brand-primary'
                        : 'text-shell-subtext hover:bg-shell-bg hover:text-shell-text'
                    }`}
                    title={s.title}
                  >
                    {s.title}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(s.id);
                    }}
                    className="absolute right-1 top-1/2 hidden -translate-y-1/2 rounded p-1 text-shell-muted hover:text-status-error group-hover:block"
                    aria-label="删除对话"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <ChatEvolutionPanel sessionId={activeId} extracting={extracting} />
    </aside>
  );
}
