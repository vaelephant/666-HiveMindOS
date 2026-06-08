'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  FolderKanban,
  Gavel,
  Heart,
  Loader2,
  MessageSquare,
  Search,
  Sparkles,
} from 'lucide-react';
import { MemoryEvolutionBrainLoader } from '@/components/knowledge-base/memory-evolution-brain-loader';
import { getMemoryStats, listMemories, listMemoryEvents, syncMemoryVectors } from '@/lib/kb-api';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';
import type { MemoryEventRecord, MemoryRecord, MemoryStats, MemoryType } from '@/lib/kb-types';
const POLL_MS = 10_000;
const SYNC_RING_R = 36;

const TYPE_META: Record<
  MemoryType,
  {
    label: string;
    icon: typeof FolderKanban;
    accent: string;
    bg: string;
    border: string;
  }
> = {
  project: {
    label: '项目',
    icon: FolderKanban,
    accent: 'text-sky-600',
    bg: 'bg-sky-500/10',
    border: 'border-l-sky-500',
  },
  preference: {
    label: '偏好',
    icon: Heart,
    accent: 'text-violet-600',
    bg: 'bg-violet-500/10',
    border: 'border-l-violet-500',
  },
  decision: {
    label: '决策',
    icon: Gavel,
    accent: 'text-amber-600',
    bg: 'bg-amber-500/10',
    border: 'border-l-amber-500',
  },
};

const EVENT_LABEL: Record<string, string> = {
  created: '新增',
  updated: '更新',
  merged: '合并',
  conflict: '冲突',
  archived: '归档',
  deleted: '删除',
  decayed: '衰减',
  accessed: '访问',
};

type TypeFilter = 'all' | MemoryType;

function SyncRing({ pct }: { pct: number }) {
  const c = 2 * Math.PI * SYNC_RING_R;
  const offset = c * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[5.5rem] shrink-0">
        <svg className="size-full -rotate-90" viewBox="0 0 80 80" aria-hidden>
          <circle
            cx="40"
            cy="40"
            r={SYNC_RING_R}
            fill="none"
            className="stroke-shell-border"
            strokeWidth="5"
          />
          <circle
            cx="40"
            cy="40"
            r={SYNC_RING_R}
            fill="none"
            className="stroke-brand-primary"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[17px] font-semibold tabular-nums text-shell-text">
          {Math.round(pct)}%
        </span>
      </div>
      <div className="text-right">
        <p className="text-[11px] font-medium tracking-wide text-shell-muted">语义同步率</p>
        <p className="mt-0.5 text-[12px] text-shell-subtext">向量索引覆盖</p>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ImportanceBar({ value, compact }: { value: number; compact?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className={`flex items-center gap-2 ${compact ? '' : 'mt-1'}`}>
      <div
        className={`flex-1 overflow-hidden rounded-full bg-shell-border ${compact ? 'h-0.5' : 'h-1'}`}
      >
        <div
          className="h-full rounded-full bg-brand-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {!compact && (
        <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">{pct}%</span>
      )}
    </div>
  );
}

function StatCards({ stats, loading }: { stats: MemoryStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载统计…
      </div>
    );
  }
  if (!stats) return null;

  const total = Math.max(stats.total, 1);
  const items = [
    { label: '智慧总量', value: stats.total, pct: 100 },
    { label: '项目认知', value: stats.project, pct: (stats.project / total) * 100 },
    { label: '偏好认知', value: stats.preference, pct: (stats.preference / total) * 100 },
    { label: '决策认知', value: stats.decision, pct: (stats.decision / total) * 100 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-shell-border bg-shell-panel px-4 py-3.5"
        >
          <p className="text-[12px] text-shell-muted">{s.label}</p>
          <p className="mt-1.5 text-[26px] font-semibold tabular-nums leading-none text-shell-text">
            {s.value}
          </p>
          <div className="mt-3">
            <ImportanceBar value={s.pct / 100} compact />
          </div>
        </div>
      ))}
    </div>
  );
}

function EvolutionTimeline({
  events,
  loading,
  highlightId,
  onSelectMemory,
}: {
  events: MemoryEventRecord[];
  loading: boolean;
  highlightId: number | null;
  onSelectMemory: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载进化时间线…
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-shell-border px-6 py-14 text-center">
        <Sparkles className="mx-auto size-8 text-shell-muted/60" />
        <p className="mt-4 text-[14px] font-medium text-shell-text">尚无进化记录</p>
        <p className="mt-2 text-[13px] text-shell-muted">
          在 Chat 中对话，系统会自动沉淀智慧
        </p>
        <Link
          href={HIVEMIND_HOME_PATH}
          className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-primary hover:underline"
        >
          去 Chat 开始对话
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <ul className="relative space-y-3 pl-1">
      <div
        className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-brand-primary/40 via-shell-border to-transparent"
        aria-hidden
      />
      {events.map((ev) => {
        const meta = TYPE_META[ev.memory_type];
        const Icon = meta.icon;
        const isNew = highlightId === ev.id;
        const snippet = ev.new_content ?? ev.old_content ?? '';

        return (
          <li key={ev.id} className="relative pl-9">
            <span
              className={`absolute left-1 top-5 z-10 flex size-[18px] items-center justify-center rounded-full border-2 border-shell-panel ${meta.bg} ${isNew ? 'ring-2 ring-brand-primary/40' : ''}`}
            >
              <Icon className={`size-2.5 ${meta.accent}`} />
            </span>
            <button
              type="button"
              onClick={() => onSelectMemory(ev.memory_id)}
              className={`group w-full rounded-xl border border-l-4 bg-shell-panel px-4 py-3.5 text-left transition-all hover:shadow-sm ${meta.border} ${
                isNew ? 'border-brand-primary/30 ring-1 ring-brand-primary/15' : 'border-shell-border'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-wider text-shell-muted">
                  {EVENT_LABEL[ev.event_type] ?? ev.event_type} · {meta.label}
                </p>
                <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">
                  {timeAgo(ev.created_at)}
                </span>
              </div>
              <p className="mt-1.5 text-[14px] font-semibold text-shell-text group-hover:text-brand-primary">
                {ev.memory_title}
              </p>
              {snippet && (
                <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-shell-muted">
                  {snippet}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function FeaturedMemory({ memory }: { memory: MemoryRecord }) {
  const meta = TYPE_META[memory.memory_type];
  const pct = Math.round(memory.importance * 100);

  return (
    <div className="rounded-xl border border-shell-border bg-shell-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.accent}`}>
            {meta.label}
          </span>
          <h3 className="mt-2 text-[17px] font-semibold tracking-tight text-shell-text">
            {memory.title}
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-shell-muted">重要度</p>
          <p className="text-[15px] font-semibold tabular-nums text-brand-primary">{pct}%</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-shell-border bg-shell-bg/80 px-4 py-3">
        <p className="text-[11px] font-medium text-shell-muted">智慧详情</p>
        <p className="mt-2 text-[14px] leading-relaxed text-shell-text">{memory.content}</p>
      </div>

      <div className="mt-4">
        <ImportanceBar value={memory.importance} />
      </div>

      <dl className="mt-4 flex gap-6 text-[11px] text-shell-muted">
        <div>
          <dt>创建</dt>
          <dd className="mt-0.5 text-shell-subtext">{formatTime(memory.created_at)}</dd>
        </div>
        <div>
          <dt>更新</dt>
          <dd className="mt-0.5 text-shell-subtext">{formatTime(memory.updated_at)}</dd>
        </div>
      </dl>

      {memory.source_id && (
        <Link
          href={`${HIVEMIND_HOME_PATH}?id=${memory.source_id}`}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-[13px] font-medium text-brand-on-primary transition-opacity hover:opacity-90"
        >
          查看来源对话
          <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

function VaultListItem({
  memory,
  selected,
  onSelect,
}: {
  memory: MemoryRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = TYPE_META[memory.memory_type];
  const Icon = meta.icon;
  const pct = Math.round(memory.importance * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all ${
        selected
          ? 'border-brand-primary/35 bg-brand-primary/5'
          : 'border-transparent bg-shell-bg/60 hover:border-shell-border hover:bg-shell-bg'
      }`}
    >
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${meta.bg}`}>
        <Icon className={`size-3.5 ${meta.accent}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-shell-text">{memory.title}</p>
        <ImportanceBar value={memory.importance} compact />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">{pct}%</span>
    </button>
  );
}

export function MemoryEvolutionView() {
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [events, setEvents] = useState<MemoryEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightEventId, setHighlightEventId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const lastEventIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, m, e] = await Promise.all([
        getMemoryStats(),
        listMemories(),
        listMemoryEvents(),
      ]);
      setStats(s);
      setMemories(m);
      setEvents(e);

      const latestId = e[0]?.id ?? null;
      if (
        silent &&
        latestId != null &&
        lastEventIdRef.current != null &&
        latestId > lastEventIdRef.current
      ) {
        setHighlightEventId(latestId);
        window.setTimeout(() => setHighlightEventId(null), 4000);
      }
      if (latestId != null) lastEventIdRef.current = latestId;

      if (!selectedIdRef.current && m.length > 0) setSelectedId(m[0].id);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => refresh(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const filteredMemories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return memories.filter((m) => {
      if (typeFilter !== 'all' && m.memory_type !== typeFilter) return false;
      if (!q) return true;
      return (
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q)
      );
    });
  }, [memories, typeFilter, search]);

  const selectedMemory = memories.find((m) => m.id === selectedId) ?? null;
  const listMemoriesFiltered = filteredMemories.filter((m) => m.id !== selectedId);

  const syncPct =
    stats && stats.total > 0
      ? ((stats.vector_indexed ?? 0) / stats.total) * 100
      : 0;

  async function handleSyncVectors() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncMemoryVectors();
      setSyncMsg(`语义索引已同步 ${res.synced}/${res.total} 条`);
      await refresh(true);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  }

  const filters: { key: TypeFilter; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'project', label: '项目' },
    { key: 'preference', label: '偏好' },
    { key: 'decision', label: '决策' },
  ];

  return (
    <div className="w-full py-6 md:py-8">
      {/* 顶栏：脑图 + 标题 + 同步环 */}
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-5">
            <MemoryEvolutionBrainLoader />
            <div className="min-w-0">
              <h1 className="text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                智慧进化
              </h1>
              <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-shell-muted">
                进化引擎持续从对话流中提炼项目、偏好与决策，构建可召回的长期智慧。
              </p>
              {stats && stats.events_this_week > 0 && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-primary/8 px-3 py-1 text-[12px] text-brand-primary">
                  <Sparkles className="size-3.5" />
                  本周 {stats.events_this_week} 次进化
                </p>
              )}
            </div>
          </div>
          {stats && stats.total > 0 && <SyncRing pct={syncPct} />}
        </div>
      </header>

      {/* 指标卡 */}
      <section className="mt-4">
        <StatCards stats={stats} loading={loading && !stats} />
      </section>

      {/* 主区：时间线 | 智慧库 */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* 左：进化时间线 */}
        <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-semibold text-shell-text">进化时间线</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">每次提炼与更新的记录</p>
            </div>
            <span className="text-[11px] text-shell-subtext">每 10 秒刷新</span>
          </div>
          <EvolutionTimeline
            events={events}
            loading={loading && events.length === 0}
            highlightId={highlightEventId}
            onSelectMemory={setSelectedId}
          />
        </div>

        {/* 右：智慧库 */}
        <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold text-shell-text">智慧库</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">当前选中智慧的完整视图</p>
            </div>
            <div className="flex items-center gap-2">
              {(stats?.vector_indexed ?? 0) < (stats?.total ?? 0) && (
                <button
                  type="button"
                  onClick={handleSyncVectors}
                  disabled={syncing}
                  className="rounded-lg border border-shell-border px-3 py-1.5 text-[12px] text-shell-text transition-colors hover:border-brand-primary/40 disabled:opacity-50"
                >
                  {syncing ? '同步中…' : '建立语义索引'}
                </button>
              )}
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-shell-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索智慧…"
              className="w-full rounded-lg border border-shell-border bg-shell-bg py-2 pl-9 pr-3 text-[13px] text-shell-text placeholder:text-shell-muted focus:border-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-primary/20"
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTypeFilter(f.key)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                  typeFilter === f.key
                    ? 'bg-brand-primary text-white'
                    : 'bg-shell-bg text-shell-muted hover:text-shell-text'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {syncMsg && (
            <p className="mb-3 text-[12px] text-shell-muted">{syncMsg}</p>
          )}

          {loading && memories.length === 0 ? (
            <div className="flex items-center gap-2 py-16 text-[13px] text-shell-muted">
              <Loader2 className="size-4 animate-spin" />
              加载智慧…
            </div>
          ) : !selectedMemory && filteredMemories.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-shell-muted">暂无智慧</p>
          ) : (
            <>
              {selectedMemory ? (
                <FeaturedMemory memory={selectedMemory} />
              ) : (
                <p className="py-8 text-center text-[13px] text-shell-muted">
                  选择一条智慧查看详情
                </p>
              )}

              {listMemoriesFiltered.length > 0 && (
                <div className="mt-4 space-y-1.5 border-t border-shell-border pt-4">
                  <p className="mb-2 text-[11px] font-medium text-shell-muted">更多智慧</p>
                  {listMemoriesFiltered.map((m) => (
                    <VaultListItem
                      key={m.id}
                      memory={m}
                      selected={false}
                      onSelect={() => setSelectedId(m.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
