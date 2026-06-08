'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  FileSpreadsheet,
  FileText,
  FileType2,
  FolderOpen,
  Loader2,
  Network,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadSource, listSources, compileSource, deleteSource } from '@/lib/kb-api';
import type { SourceRecord } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.txt';

type FilterTab = 'all' | 'uploaded' | 'compiling' | 'done';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'uploaded', label: '待编译' },
  { key: 'compiling', label: '编译中' },
  { key: 'done', label: '已完成' },
];

function fileExt(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xls' || ext === 'xlsx') return 'sheet';
  if (ext === 'doc' || ext === 'docx') return 'doc';
  return 'text';
}

function FileIcon({ filename }: { filename: string }) {
  const kind = fileExt(filename);
  const Icon = kind === 'sheet' ? FileSpreadsheet : kind === 'pdf' ? FileType2 : FileText;
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/8 text-brand-primary/80">
      <Icon className="size-3.5" strokeWidth={1.75} />
    </div>
  );
}

function StatusDot({ status }: { status: SourceRecord['status'] }) {
  const config = {
    uploaded: { dot: 'bg-shell-muted', label: '已上传', pulse: false },
    compiling: { dot: 'bg-brand-primary', label: '编译中', pulse: true },
    done: { dot: 'bg-status-success', label: '已完成', pulse: false },
    error: { dot: 'bg-status-error', label: '失败', pulse: false },
  }[status];

  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-shell-subtext">
      <span className="relative flex size-2">
        {config.pulse && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-primary/40" />
        )}
        <span className={cn('relative inline-flex size-2 rounded-full', config.dot)} />
      </span>
      {config.label}
    </span>
  );
}

function wikiLinkFromSource(source: SourceRecord): string {
  const first = source.wiki_pages?.[0];
  if (!first) return '/knowledge-base/wiki';
  const category = first.split('/')[0];
  return `/knowledge-base/wiki?category=${encodeURIComponent(category)}&page=${encodeURIComponent(first)}`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatType(path: string) {
  return path.split('.').pop()?.toUpperCase() ?? 'FILE';
}

function truncateError(msg: string, max = 72) {
  return msg.length > max ? `${msg.slice(0, max)}…` : msg;
}

function SourceRow({
  source,
  onCompile,
  onDelete,
}: {
  source: SourceRecord;
  onCompile: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLongError = source.status === 'error' && source.error && source.error.length > 72;

  return (
    <li className="group">
      <div className="grid items-center gap-x-4 gap-y-2 px-1 py-4 transition-colors hover:bg-foreground/[0.02] md:grid-cols-[minmax(0,1fr)_108px_128px_96px] lg:grid-cols-[minmax(0,1fr)_108px_128px_112px]">
        <div className="flex min-w-0 items-center gap-3">
          <FileIcon filename={source.filename} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-shell-text" title={source.filename}>
              {source.filename}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-shell-muted">
              <span>{formatDate(source.created_at)}</span>
              <span className="text-shell-border">·</span>
              <span className="font-mono text-[11px]">{formatType(source.file_path)}</span>
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <StatusDot status={source.status} />
        </div>

        <div className="hidden text-[12px] text-shell-muted md:block">
          {source.status === 'done' ? (
            <div className="flex items-center gap-3 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Network className="size-3 text-shell-muted" />
                {source.entities_extracted ?? 0}
              </span>
              <span className="inline-flex items-center gap-1">
                <BookOpen className="size-3 text-shell-muted" />
                {source.wiki_pages_created ?? 0}
              </span>
            </div>
          ) : source.status === 'compiling' ? (
            <div className="flex items-center gap-2">
              <div className="h-1 w-16 overflow-hidden rounded-full bg-shell-border">
                <div className="h-full w-2/3 animate-pulse rounded-full bg-brand-primary/50" />
              </div>
            </div>
          ) : (
            <span className="text-shell-muted/60">—</span>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5">
          {source.status === 'uploaded' && (
            <Button variant="outline" size="sm" onClick={() => onCompile(source.id)}>
              <Play data-icon="inline-start" />
              编译
            </Button>
          )}
          {source.status === 'error' && (
            <Button variant="outline" size="sm" onClick={() => onCompile(source.id)}>
              重试
            </Button>
          )}
          {source.status === 'done' && (
            <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={wikiLinkFromSource(source)} />}>
              Wiki
              <ArrowUpRight data-icon="inline-end" />
            </Button>
          )}
          {source.status === 'compiling' && (
            <span className="px-2 text-[12px] text-shell-muted">处理中</span>
          )}
          {source.status !== 'compiling' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(source.id)}
              className="text-shell-muted opacity-0 transition-opacity hover:text-status-error group-hover:opacity-100"
              aria-label="删除"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="col-span-full flex items-center gap-2 md:hidden">
          <StatusDot status={source.status} />
          {source.status === 'done' && (
            <span className="text-[12px] tabular-nums text-shell-muted">
              {source.entities_extracted ?? 0} 实体 · {source.wiki_pages_created ?? 0} 页
            </span>
          )}
        </div>
      </div>

      {source.status === 'error' && source.error && (
        <div className="mx-1 mb-3 rounded-lg border border-status-error/15 bg-status-error/5 px-3 py-2">
          <p className="text-[12px] leading-relaxed text-status-error/90">
            {expanded || !hasLongError ? source.error : truncateError(source.error)}
          </p>
          {hasLongError && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-[11px] text-status-error/70 hover:text-status-error"
            >
              {expanded ? '收起' : '查看完整错误'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function IngestPage() {
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    listSources()
      .then(setSources)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const done = sources.filter((s) => s.status === 'done');
    return {
      total: sources.length,
      pending: sources.filter((s) => s.status === 'uploaded').length,
      compiling: sources.filter((s) => s.status === 'compiling').length,
      entities: done.reduce((n, s) => n + (s.entities_extracted ?? 0), 0),
      pages: done.reduce((n, s) => n + (s.wiki_pages_created ?? 0), 0),
    };
  }, [sources]);

  const filtered = useMemo(() => {
    let list = sources;
    if (filter === 'uploaded') list = list.filter((s) => s.status === 'uploaded');
    else if (filter === 'compiling') list = list.filter((s) => s.status === 'compiling');
    else if (filter === 'done') list = list.filter((s) => s.status === 'done');

    const q = search.trim().toLowerCase();
    if (q) list = list.filter((s) => s.filename.toLowerCase().includes(q));
    return list;
  }, [sources, filter, search]);

  async function handleFiles(files: FileList | null) {
    if (!files || uploading) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const record = await uploadSource(file);
        setSources((prev) => [record, ...prev]);
      } catch {
        // individual file errors don't block the batch
      }
    }
    setUploading(false);
  }

  async function handleDelete(sourceId: string) {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;
    if (!window.confirm(`确认删除「${source.filename}」？\n关联的 Wiki 页面也会一并移除。`)) return;
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
    try {
      await deleteSource(sourceId);
    } catch {
      // 若失败则刷新恢复
      refresh();
    }
  }

  async function handleCompile(sourceId: string) {
    setSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, status: 'compiling' } : s)),
    );
    try {
      const updated = await compileSource(sourceId);
      setSources((prev) => prev.map((s) => (s.id === sourceId ? updated : s)));
    } catch (err) {
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId
            ? { ...s, status: 'error', error: err instanceof Error ? err.message : '编译失败' }
            : s,
        ),
      );
    }
  }

  return (
    <div
      className="relative w-full divide-y divide-shell-border pb-12"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-brand-primary/30 bg-shell-panel px-12 py-10 shadow-xl">
            <div className="flex size-12 items-center justify-center rounded-xl bg-brand-primary/10">
              <Upload className="size-5 text-brand-primary" strokeWidth={1.5} />
            </div>
            <p className="text-[15px] font-medium text-shell-text">松开以添加资料</p>
            <p className="text-[12px] text-shell-muted">PDF · Word · Excel · TXT</p>
          </div>
        </div>
      )}

      <header className="flex flex-wrap items-end justify-between gap-6 py-8">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-shell-muted">知识管理 / 原始资料</p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight text-shell-text">资料库</h1>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-shell-muted">
            企业文档存放于 <code className="rounded bg-shell-bg px-1.5 py-0.5 font-mono text-[11px] text-shell-subtext">storage/raw</code>，编译后写入 Wiki 与知识图谱
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn(loading && 'animate-spin')} />
            刷新
          </Button>
          <Button size="sm" onClick={() => !uploading && inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Plus />}
            {uploading ? '上传中' : '添加资料'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-8 gap-y-6 py-8 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: '资料总数', value: stats.total },
          { label: '待编译', value: stats.pending, accent: stats.pending > 0 },
          { label: '编译中', value: stats.compiling, accent: stats.compiling > 0 },
          { label: '已提取实体', value: stats.entities },
          { label: 'Wiki 页面', value: stats.pages },
        ].map((s) => (
          <div key={s.label} className="min-w-0">
            <p className="text-[12px] text-shell-muted">{s.label}</p>
            <p
              className={cn(
                'mt-1.5 text-[28px] font-semibold tabular-nums tracking-tight',
                s.accent ? 'text-brand-primary' : 'text-shell-text',
              )}
            >
              {s.value}
            </p>
          </div>
        ))}
      </section>

      <section className="py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-shell-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索文件名…"
              className="input-field h-9 w-full pl-9 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                  filter === tab.key
                    ? 'bg-brand-primary/10 text-brand-primary'
                    : 'text-shell-muted hover:bg-foreground/5 hover:text-shell-subtext',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading && sources.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-shell-muted">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-[13px]">加载资料列表…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-shell-bg">
              <FolderOpen className="size-5 text-shell-muted" strokeWidth={1.5} />
            </div>
            <p className="mt-5 text-[15px] font-medium text-shell-text">
              {search ? '没有匹配的文件' : filter === 'all' ? '资料库为空' : '该筛选下暂无记录'}
            </p>
            <p className="mt-1.5 text-[13px] text-shell-muted">
              {search ? '换个关键词试试' : '拖拽文件到页面，或点击「添加资料」'}
            </p>
            {!search && filter === 'all' && (
              <Button variant="outline" size="sm" className="mt-6" onClick={() => inputRef.current?.click()}>
                <Plus />
                添加资料
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-2">
            <div className="hidden border-b border-shell-border px-1 pb-2.5 text-[11px] font-medium tracking-wide text-shell-muted md:grid md:grid-cols-[minmax(0,1fr)_108px_128px_96px] md:gap-x-4 lg:grid-cols-[minmax(0,1fr)_108px_128px_112px]">
              <span>文件名</span>
              <span>状态</span>
              <span>编译结果</span>
              <span className="text-right">操作</span>
            </div>
            <ul className="divide-y divide-shell-border">
              {filtered.map((s) => (
                <SourceRow key={s.id} source={s} onCompile={handleCompile} onDelete={handleDelete} />
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-[11px] text-shell-muted">
          PDF · Word · Excel · TXT · 单文件 ≤ 20MB · 上传仅保存原始文件，编译需手动触发
        </p>
      </section>
    </div>
  );
}
