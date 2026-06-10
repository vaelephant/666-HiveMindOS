'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  FileText,
  FolderKanban,
  Gavel,
  Heart,
  Loader2,
  MessageSquare,
  Scale,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { MemoryEvolutionBrainLoader } from '@/components/knowledge-base/memory-evolution-brain-loader';
import { getMemoryStats, listMemories, listMemoryEvents, syncMemoryVectors } from '@/lib/kb-api';
import { SOURCE_LABEL } from '@/lib/kb-labels';
import { KB_BASE_PATH, HIVEMIND_HOME_PATH } from '@/config/navigation';
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
  fact: {
    label: '事实',
    icon: BookOpen,
    accent: 'text-emerald-600',
    bg: 'bg-emerald-500/10',
    border: 'border-l-emerald-500',
  },
  rule: {
    label: '规则',
    icon: Scale,
    accent: 'text-rose-600',
    bg: 'bg-rose-500/10',
    border: 'border-l-rose-500',
  },
};

const SOURCE_BADGE_STYLE: Record<string, string> = {
  chat: 'bg-sky-500/10 text-sky-700',
  ingest: 'bg-amber-500/10 text-amber-800',
  recap: 'bg-violet-500/10 text-violet-700',
};

type SourceFilter = 'all' | 'chat' | 'ingest';

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'chat', label: '对话' },
  { key: 'ingest', label: '文档' },
];

const INGEST_PATH = `${KB_BASE_PATH}/ingest`;
const WIKI_PATH = `${KB_BASE_PATH}/wiki`;

function getTypeMeta(type: string) {
  return (
    TYPE_META[type as MemoryType] ?? {
      label: type,
      icon: Sparkles,
      accent: 'text-shell-muted',
      bg: 'bg-shell-bg',
      border: 'border-l-shell-border',
    }
  );
}

function sourceCount(stats: MemoryStats | null, filter: SourceFilter): number | null {
  if (!stats) return null;
  if (filter === 'chat') return stats.by_source_chat ?? null;
  if (filter === 'ingest') return stats.by_source_ingest ?? null;
  return stats.total;
}

function typeFiltersForSource(
  source: SourceFilter,
  stats: MemoryStats | null,
): { key: TypeFilter; label: string }[] {
  const all: { key: TypeFilter; label: string } = { key: 'all', label: '全部' };
  if (source === 'ingest') {
    return [
      all,
      { key: 'project', label: '项目' },
      { key: 'decision', label: '决策' },
      { key: 'fact', label: '事实' },
      { key: 'rule', label: '规则' },
    ];
  }
  if (source === 'chat') {
    return [
      all,
      { key: 'project', label: '项目' },
      { key: 'preference', label: '偏好' },
      { key: 'decision', label: '决策' },
    ];
  }
  const items: { key: TypeFilter; label: string }[] = [
    all,
    { key: 'project', label: '项目' },
    { key: 'preference', label: '偏好' },
    { key: 'decision', label: '决策' },
  ];
  if ((stats?.by_source_ingest ?? 0) > 0) {
    items.push({ key: 'fact', label: '事实' }, { key: 'rule', label: '规则' });
  }
  return items;
}

function SourceBadge({ sourceType }: { sourceType: string | null }) {
  if (!sourceType) return null;
  const label = SOURCE_LABEL[sourceType] ?? sourceType;
  const style = SOURCE_BADGE_STYLE[sourceType] ?? 'bg-shell-bg text-shell-muted';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${style}`}>
      {label}
    </span>
  );
}

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

function DualEmptyState({
  variant,
  stats,
  sourceFilter = 'all',
}: {
  variant: 'timeline' | 'vault';
  stats: MemoryStats | null;
  sourceFilter?: SourceFilter;
}) {
  const chatCount = stats?.by_source_chat ?? 0;
  const ingestCount = stats?.by_source_ingest ?? 0;
  const compact = variant === 'vault';
  const showChatCta = sourceFilter !== 'ingest';
  const showIngestCta = sourceFilter !== 'chat';
  const otherHasData =
    (sourceFilter === 'chat' && ingestCount > 0) ||
    (sourceFilter === 'ingest' && chatCount > 0);

  const title =
    sourceFilter === 'chat'
      ? variant === 'timeline'
        ? '尚无对话进化记录'
        : '暂无对话智慧'
      : sourceFilter === 'ingest'
        ? variant === 'timeline'
          ? '尚无文档进化记录'
          : '暂无文档智慧'
        : variant === 'timeline'
          ? '尚无进化记录'
          : '暂无智慧';

  const subtitle = otherHasData
    ? '切换上方「来源」筛选可查看另一条路径的智慧'
    : '智慧可从 Chat 对话或资料库文档两条路径沉淀';

  return (
    <div
      className={`rounded-xl border border-dashed border-shell-border text-center ${
        compact ? 'px-4 py-10' : 'px-6 py-14'
      }`}
    >
      <Sparkles className="mx-auto size-8 text-shell-muted/60" />
      <p className="mt-4 text-[14px] font-medium text-shell-text">{title}</p>
      <p className="mt-2 text-[13px] text-shell-muted">{subtitle}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {showChatCta && chatCount === 0 && (
          <Link
            href={HIVEMIND_HOME_PATH}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-panel px-4 py-2 text-[13px] font-medium text-shell-text transition-colors hover:border-brand-primary/40"
          >
            <MessageSquare className="size-3.5 text-sky-600" />
            去 Chat 对话
            <ArrowRight className="size-3.5" />
          </Link>
        )}
        {showIngestCta && ingestCount === 0 && (
          <Link
            href={INGEST_PATH}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border bg-shell-panel px-4 py-2 text-[13px] font-medium text-shell-text transition-colors hover:border-brand-primary/40"
          >
            <Upload className="size-3.5 text-amber-600" />
            上传并编译文档
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      <Link
        href={WIKI_PATH}
        className="mt-4 inline-flex items-center gap-1 text-[12px] text-shell-muted hover:text-brand-primary"
      >
        <BookOpen className="size-3.5" />
        浏览 Wiki 知识页
      </Link>
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

  const chatN = stats.by_source_chat ?? 0;
  const ingestN = stats.by_source_ingest ?? 0;

  return (
    <div className="space-y-3">
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
      {(chatN > 0 || ingestN > 0) && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-shell-border bg-shell-panel/60 px-4 py-2.5 text-[12px] text-shell-muted">
          <span className="font-medium text-shell-subtext">来源分布</span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-sky-600" />
            对话 <span className="tabular-nums font-medium text-shell-text">{chatN}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileText className="size-3.5 text-amber-600" />
            文档 <span className="tabular-nums font-medium text-shell-text">{ingestN}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function EvolutionTimeline({
  events,
  loading,
  highlightId,
  stats,
  sourceFilter,
  onSelectMemory,
}: {
  events: MemoryEventRecord[];
  loading: boolean;
  highlightId: number | null;
  stats: MemoryStats | null;
  sourceFilter: SourceFilter;
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
    return <DualEmptyState variant="timeline" stats={stats} sourceFilter={sourceFilter} />;
  }

  return (
    <ul className="relative space-y-3 pl-1">
      <div
        className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-brand-primary/40 via-shell-border to-transparent"
        aria-hidden
      />
      {events.map((ev) => {
        const meta = getTypeMeta(ev.memory_type);
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

function MemorySourceLink({ memory }: { memory: MemoryRecord }) {
  if (memory.source_type === 'ingest') {
    return (
      <Link
        href={INGEST_PATH}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-[13px] font-medium text-brand-on-primary transition-opacity hover:opacity-90"
      >
        <FileText className="size-4" />
        查看来源文档
        <ArrowRight className="size-4" />
      </Link>
    );
  }
  if (memory.source_type === 'chat' && memory.source_id) {
    return (
      <Link
        href={`${HIVEMIND_HOME_PATH}?id=${memory.source_id}`}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-[13px] font-medium text-brand-on-primary transition-opacity hover:opacity-90"
      >
        <MessageSquare className="size-4" />
        查看来源对话
        <ArrowRight className="size-4" />
      </Link>
    );
  }
  return (
    <Link
      href={WIKI_PATH}
      className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-shell-border px-4 py-2.5 text-[13px] font-medium text-shell-text transition-colors hover:border-brand-primary/40"
    >
      <BookOpen className="size-4" />
      浏览 Wiki
      <ArrowRight className="size-4" />
    </Link>
  );
}

function FeaturedMemory({ memory }: { memory: MemoryRecord }) {
  const meta = getTypeMeta(memory.memory_type);
  const pct = Math.round(memory.importance * 100);

  return (
    <div className="rounded-xl border border-shell-border bg-shell-panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${meta.bg} ${meta.accent}`}>
              {meta.label}
            </span>
            <SourceBadge sourceType={memory.source_type} />
          </div>
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

      <MemorySourceLink memory={memory} />
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
  const meta = getTypeMeta(memory.memory_type);
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
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-medium text-shell-text">{memory.title}</p>
          <SourceBadge sourceType={memory.source_type} />
        </div>
        <ImportanceBar value={memory.importance} compact />
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">{pct}%</span>
    </button>
  );
}

export function MemoryEvolutionView() {
  const { ready: orgReady, orgId } = useOrgReady();
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [events, setEvents] = useState<MemoryEventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [highlightEventId, setHighlightEventId] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lastEventIdRef = useRef<number | null>(null);
  const selectedIdRef = useRef<number | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const refresh = useCallback(async (silent = false) => {
    if (!orgReady) return;
    if (!silent) setLoading(true);
    if (!silent) setLoadError(null);
    try {
      const sourceType = sourceFilter === 'all' ? undefined : sourceFilter;
      const [s, m, e] = await Promise.all([
        getMemoryStats(orgId),
        listMemories(orgId, sourceType),
        listMemoryEvents(orgId),
      ]);
      setStats(s);
      setMemories(m);
      setEvents(e);

      const memoryIds = new Set(m.map((row) => row.id));
      const visibleEvents = sourceFilter === 'all' ? e : e.filter((ev) => memoryIds.has(ev.memory_id));
      const latestId = visibleEvents[0]?.id ?? null;
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

      if (!selectedIdRef.current && m.length > 0) {
        setSelectedId(m[0].id);
      } else if (selectedIdRef.current && !m.some((row) => row.id === selectedIdRef.current)) {
        setSelectedId(m[0]?.id ?? null);
      }
    } catch (e) {
      if (!silent) {
        setLoadError(e instanceof Error ? e.message : '加载智慧数据失败');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orgId, orgReady, sourceFilter]);

  useEffect(() => {
    if (!orgReady) {
      setLoading(true);
      return;
    }
    refresh();
    const timer = window.setInterval(() => refresh(true), POLL_MS);
    return () => window.clearInterval(timer);
  }, [orgReady, refresh]);

  useEffect(() => {
    const allowed = typeFiltersForSource(sourceFilter, stats).map((f) => f.key);
    if (!allowed.includes(typeFilter)) setTypeFilter('all');
  }, [sourceFilter, stats, typeFilter]);

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
  const memoryIds = useMemo(() => new Set(memories.map((m) => m.id)), [memories]);
  const filteredEvents = useMemo(
    () => (sourceFilter === 'all' ? events : events.filter((ev) => memoryIds.has(ev.memory_id))),
    [events, memoryIds, sourceFilter],
  );
  const typeFilters = useMemo(
    () => typeFiltersForSource(sourceFilter, stats),
    [sourceFilter, stats],
  );

  const syncPct =
    stats && stats.total > 0
      ? ((stats.vector_indexed ?? 0) / stats.total) * 100
      : 0;

  async function handleSyncVectors() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncMemoryVectors(orgId);
      setSyncMsg(`语义索引已同步 ${res.synced}/${res.total} 条`);
      await refresh(true);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : '同步失败');
    } finally {
      setSyncing(false);
    }
  }

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
                进化引擎从 Chat 对话与资料库文档两条路径提炼项目、偏好、决策与事实规则，构建可召回的长期智慧。
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

      {loadError && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
          {loadError}
        </p>
      )}

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
            events={filteredEvents}
            loading={loading && events.length === 0}
            highlightId={highlightEventId}
            stats={stats}
            sourceFilter={sourceFilter}
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

          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-medium text-shell-muted">来源</p>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_FILTERS.map((f) => {
                const count = sourceCount(stats, f.key);
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setSourceFilter(f.key)}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      sourceFilter === f.key
                        ? 'bg-brand-primary text-white'
                        : 'bg-shell-bg text-shell-muted hover:text-shell-text'
                    }`}
                  >
                    {f.label}
                    {count != null && (
                      <span className="ml-1 tabular-nums opacity-80">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-4">
            <p className="mb-1.5 text-[11px] font-medium text-shell-muted">类型</p>
            <div className="flex flex-wrap gap-1.5">
              {typeFilters.map((f) => (
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
          </div>

          {syncMsg && (
            <p className="mb-3 text-[12px] text-shell-muted">{syncMsg}</p>
          )}

          {loading && memories.length === 0 ? (
            <div className="flex items-center gap-2 py-16 text-[13px] text-shell-muted">
              <Loader2 className="size-4 animate-spin" />
              加载智慧…
            </div>
          ) : memories.length === 0 ? (
            <DualEmptyState variant="vault" stats={stats} sourceFilter={sourceFilter} />
          ) : filteredMemories.length === 0 ? (
            <p className="py-16 text-center text-[13px] text-shell-muted">
              无匹配的智慧，试试调整类型筛选或搜索关键词
            </p>
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
