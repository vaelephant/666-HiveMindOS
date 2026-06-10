'use client';

import { useState } from 'react';
import { Folder, FolderOpen, Inbox, Plus } from 'lucide-react';
import type { SourceCollection } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

export type CollectionFilter = 'all' | 'uncategorized' | string;

type Props = {
  collections: SourceCollection[];
  uncategorized: number;
  total: number;
  active: CollectionFilter;
  uploadTarget: string | null;
  onFilterChange: (filter: CollectionFilter) => void;
  onUploadTargetChange: (name: string | null) => void;
  onCreateCollection: (name: string) => void;
  className?: string;
};

function countForFilter(
  filter: CollectionFilter,
  total: number,
  uncategorized: number,
  collections: SourceCollection[],
): number {
  if (filter === 'all') return total;
  if (filter === 'uncategorized') return uncategorized;
  return collections.find((c) => c.name === filter)?.count ?? 0;
}

export function SourceCollectionsPanel({
  collections,
  uncategorized,
  total,
  active,
  uploadTarget,
  onFilterChange,
  onUploadTargetChange,
  onCreateCollection,
  className,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  function submitNew() {
    const name = newName.trim();
    if (!name) return;
    onCreateCollection(name);
    setNewName('');
    setCreating(false);
  }

  const items: { key: CollectionFilter; label: string; count: number; icon: typeof Folder }[] = [
    { key: 'all', label: '全部资料', count: total, icon: Inbox },
    { key: 'uncategorized', label: '未分类', count: uncategorized, icon: Folder },
    ...collections.map((c) => ({
      key: c.name as CollectionFilter,
      label: c.name,
      count: c.count,
      icon: FolderOpen,
    })),
  ];

  return (
    <nav className={cn('flex flex-col gap-1', className)} aria-label="资料集合">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-medium tracking-wide text-shell-muted">集合</p>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-shell-muted transition-colors hover:bg-foreground/5 hover:text-shell-subtext"
          title="新建集合"
        >
          <Plus className="size-3" />
          新建
        </button>
      </div>

      {creating && (
        <div className="mb-2 flex gap-1 px-1">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') {
                setCreating(false);
                setNewName('');
              }
            }}
            placeholder="集合名称"
            maxLength={64}
            className="input-field h-8 min-w-0 flex-1 text-[12px]"
            autoFocus
          />
          <button
            type="button"
            onClick={submitNew}
            disabled={!newName.trim()}
            className="rounded-lg bg-brand-primary/10 px-2 text-[11px] font-medium text-brand-primary disabled:opacity-40"
          >
            添加
          </button>
        </div>
      )}

      <ul className="space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const selected = active === item.key;
          const isUploadTarget =
            item.key !== 'all' && item.key !== 'uncategorized' && uploadTarget === item.key;
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => onFilterChange(item.key)}
                onDoubleClick={() => {
                  if (item.key !== 'all' && item.key !== 'uncategorized') {
                    onUploadTargetChange(item.key);
                  }
                }}
                title={
                  item.key !== 'all' && item.key !== 'uncategorized'
                    ? '双击设为上传目标'
                    : undefined
                }
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                  selected
                    ? 'bg-brand-primary/10 text-brand-primary'
                    : 'text-shell-subtext hover:bg-foreground/5 hover:text-shell-text',
                )}
              >
                <Icon className="size-3.5 shrink-0 opacity-70" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 tabular-nums text-[11px] opacity-60">{item.count}</span>
                {isUploadTarget && item.key !== 'all' && (
                  <span className="shrink-0 rounded bg-brand-primary/15 px-1 py-0.5 text-[9px] font-medium text-brand-primary">
                    上传
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {uploadTarget && (
        <p className="mt-3 px-1 text-[10px] leading-relaxed text-shell-muted">
          新上传将归入「{uploadTarget}」
          <button
            type="button"
            onClick={() => onUploadTargetChange(null)}
            className="ml-1 text-brand-primary/80 hover:text-brand-primary"
          >
            取消
          </button>
        </p>
      )}
    </nav>
  );
}

export function collectionMatchesFilter(
  source: { collection?: string | null },
  filter: CollectionFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'uncategorized') return !source.collection?.trim();
  return source.collection === filter;
}

export { countForFilter };
