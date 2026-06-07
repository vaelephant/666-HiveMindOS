'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BookOpen, FileText, Loader2, Search } from 'lucide-react';
import { WikiMarkdown, extractHeadings } from '@/components/knowledge-base/wiki-markdown';
import { listWikiPages, getWikiPage } from '@/lib/kb-api';
import type { WikiPage } from '@/lib/kb-types';

type Category = 'entities' | 'workflows' | 'glossary' | 'decisions';

const CATEGORIES: { key: Category; label: string; desc: string }[] = [
  { key: 'entities', label: '实体档案', desc: '客户、产品、合同、人员' },
  { key: 'workflows', label: '业务流程', desc: '端到端业务链路' },
  { key: 'glossary', label: '术语规则', desc: '政策、阈值、定义' },
  { key: 'decisions', label: '历史决策', desc: '定价与策略记录' },
];

function isCategory(v: string | null): v is Category {
  return v === 'entities' || v === 'workflows' || v === 'glossary' || v === 'decisions';
}

function WikiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const pageParam = searchParams.get('page');

  const [category, setCategory] = useState<Category>(
    isCategory(categoryParam) ? categoryParam : 'glossary',
  );
  const [selectedPath, setSelectedPath] = useState<string | null>(pageParam);
  const [query, setQuery] = useState('');

  const [pages, setPages] = useState<WikiPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const syncUrl = useCallback(
    (cat: Category, path: string | null) => {
      const params = new URLSearchParams();
      params.set('category', cat);
      if (path) params.set('page', path);
      router.replace(`/knowledge-base/wiki?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  // Load pages when category changes
  useEffect(() => {
    setPagesLoading(true);
    setPagesError(null);
    setPages([]);
    listWikiPages(undefined, category)
      .then(setPages)
      .catch((e: Error) => setPagesError(e.message))
      .finally(() => setPagesLoading(false));
  }, [category]);

  // Auto-select first page when pages load and nothing is selected
  useEffect(() => {
    if (pages.length > 0 && !selectedPath) {
      const first = pages[0];
      setSelectedPath(first.path);
      syncUrl(category, first.path);
    }
  }, [pages, selectedPath, category, syncUrl]);

  // Load content when selected page changes
  useEffect(() => {
    if (!selectedPath) { setContent(null); return; }
    setContentLoading(true);
    setContent(null);
    getWikiPage(selectedPath)
      .then((data) => setContent(data.content))
      .catch(() => setContent(null))
      .finally(() => setContentLoading(false));
  }, [selectedPath]);

  // Sync state when user navigates with browser back/forward
  useEffect(() => {
    if (isCategory(categoryParam) && categoryParam !== category) {
      setCategory(categoryParam);
    }
  }, [categoryParam, category]);

  useEffect(() => {
    if (pageParam && pageParam !== selectedPath) {
      setSelectedPath(pageParam);
    }
  }, [pageParam, selectedPath]);

  const filteredPages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
    );
  }, [pages, query]);

  const selectedPage = pages.find((p) => p.path === selectedPath) ?? null;
  const headings = content ? extractHeadings(content) : [];
  const categoryLabel = CATEGORIES.find((c) => c.key === category)?.label ?? '';

  function selectCategory(cat: Category) {
    setCategory(cat);
    setQuery('');
    setSelectedPath(null);
    setContent(null);
    syncUrl(cat, null);
  }

  function selectPage(path: string) {
    setSelectedPath(path);
    syncUrl(category, path);
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.25rem)] gap-4 pb-6">
      {/* 导航面板 */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-shell-border bg-shell-panel shadow-sm lg:w-72">
        <div className="border-b border-shell-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-primary/10">
              <BookOpen className="size-4 text-brand-primary" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-shell-text">Wiki 浏览</p>
              <p className="text-[11px] text-shell-muted">结构化企业知识</p>
            </div>
          </div>
        </div>

        <div className="border-b border-shell-border p-3">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => selectCategory(c.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                  category === c.key
                    ? 'bg-brand-primary text-brand-on-primary shadow-sm'
                    : 'bg-shell-bg text-shell-muted hover:text-shell-text'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-shell-muted">{CATEGORIES.find((c) => c.key === category)?.desc}</p>
        </div>

        <div className="border-b border-shell-border p-3">
          <div className="flex items-center gap-2 rounded-lg border border-shell-border bg-shell-bg px-3 py-2">
            <Search className="size-3.5 shrink-0 text-shell-muted" strokeWidth={1.5} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索页面…"
              className="w-full bg-transparent text-[13px] text-shell-text outline-none placeholder:text-shell-muted"
            />
          </div>
          <p className="mt-2 text-[11px] text-shell-muted">{filteredPages.length} 篇 · {categoryLabel}</p>
        </div>

        <ul className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {pagesLoading ? (
            <li className="flex items-center justify-center py-10">
              <Loader2 className="size-4 animate-spin text-shell-muted" />
            </li>
          ) : pagesError ? (
            <li className="px-3 py-6 text-[12px] text-status-error">{pagesError}</li>
          ) : filteredPages.length === 0 ? (
            <li className="rounded-xl bg-shell-bg px-3 py-8 text-center text-[13px] text-shell-muted">
              {pages.length === 0 ? '暂无页面，请先上传资料' : '无匹配页面'}
            </li>
          ) : (
            filteredPages.map((p) => (
              <li key={p.path}>
                <button
                  type="button"
                  onClick={() => selectPage(p.path)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left transition-all ${
                    selectedPath === p.path
                      ? 'border border-brand-primary/25 bg-brand-primary/8 shadow-sm'
                      : 'border border-transparent hover:border-shell-border hover:bg-shell-bg'
                  }`}
                >
                  <p className="truncate text-[13px] font-medium text-shell-text">{p.name}</p>
                  <p className="mt-0.5 truncate text-[11px] text-shell-muted">{p.path}</p>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* 正文区 */}
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
          {contentLoading ? (
            <div className="flex items-center gap-2 py-16 text-shell-muted">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-[14px]">加载内容…</span>
            </div>
          ) : selectedPage && content ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-shell-border bg-shell-panel px-4 py-3 shadow-sm">
                <nav className="flex flex-wrap items-center gap-1 text-[12px] text-shell-muted">
                  <Link href="/knowledge-base/overview" className="hover:text-brand-primary">
                    知识库
                  </Link>
                  <span>/</span>
                  <span>{categoryLabel}</span>
                  <span>/</span>
                  <span className="font-medium text-shell-text">{selectedPage.name}</span>
                </nav>
                <Link
                  href={`/knowledge-base/query?q=${encodeURIComponent(`关于「${selectedPage.name}」`)}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 text-[12px] font-medium text-brand-on-primary shadow-sm transition-opacity hover:opacity-90"
                >
                  就此页提问
                  <ArrowUpRight className="size-3" />
                </Link>
              </div>

              <article className="rounded-2xl border border-shell-border bg-shell-panel p-6 shadow-sm md:p-8">
                <WikiMarkdown md={content} />
              </article>

              <footer className="flex items-center gap-2 rounded-xl border border-shell-border bg-shell-bg px-4 py-3 text-[12px] text-shell-muted">
                <FileText className="size-3.5 shrink-0" />
                <span>源文件</span>
                <code className="rounded-md bg-shell-panel px-2 py-0.5 font-mono text-[11px] text-shell-subtext">
                  {selectedPage.path}
                </code>
              </footer>
            </div>
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-shell-border bg-shell-panel/50 p-10 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-primary/10">
                <BookOpen className="size-7 text-brand-primary" strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-[15px] font-medium text-shell-text">选择一篇 Wiki</p>
              <p className="mt-1 max-w-xs text-[13px] text-shell-muted">从左侧目录浏览分类与页面，开始阅读结构化知识</p>
            </div>
          )}
        </div>

        {headings.length > 0 && (
          <aside className="hidden w-52 shrink-0 xl:block">
            <div className="sticky top-0 rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-shell-muted">本页目录</p>
              <ul className="mt-3 space-y-1">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      className={`block rounded-lg px-2 py-1.5 text-[12px] text-shell-muted transition-colors hover:bg-shell-bg hover:text-brand-primary ${
                        h.type === 'h3' ? 'pl-4' : ''
                      }`}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export default function WikiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-shell-border bg-shell-panel text-[14px] text-shell-muted">
          加载 Wiki…
        </div>
      }
    >
      <WikiPageContent />
    </Suspense>
  );
}
