'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronRight, Loader2, Search } from 'lucide-react';
import {
  WIKI_DETAIL_SECTIONS,
  WikiCompilationView,
} from '@/components/knowledge-base/wiki-compilation-view';
import { getWikiPage, listWikiCategories, listWikiPages, migrateWiki } from '@/lib/kb-api';
import type { WikiCategory, WikiPage, WikiPageDetail } from '@/lib/kb-types';
import { KIND_BADGE } from '@/lib/kb-labels';
import { cn } from '@/lib/utils';

function PageListItem({
  page,
  selected,
  onSelect,
}: {
  page: WikiPage;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border border-brand-primary/30 bg-brand-primary/8'
          : 'border border-transparent hover:border-shell-border hover:bg-shell-bg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'truncate text-[13px] font-medium',
            selected ? 'text-brand-primary' : 'text-shell-text',
          )}
        >
          {page.name}
        </p>
        {page.has_conflicts ? (
          <span className="shrink-0 rounded-full bg-status-warning/15 px-1.5 py-0.5 text-[10px] text-status-warning">
            冲突
          </span>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-shell-muted">
        <span>{KIND_BADGE[page.kind ?? ''] ?? page.category}</span>
        {(page.source_count ?? 0) > 0 ? <span>{page.source_count} 来源</span> : null}
      </div>
    </button>
  );
}

function WikiPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const pageParam = searchParams.get('page');

  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(categoryParam);
  const [selectedPath, setSelectedPath] = useState<string | null>(pageParam);
  const [query, setQuery] = useState('');

  const [pages, setPages] = useState<WikiPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [pageDetail, setPageDetail] = useState<WikiPageDetail | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  const activeCategory = categories.find((c) => c.key === category) ?? null;

  const syncUrl = useCallback(
    (cat: string, path: string | null) => {
      const params = new URLSearchParams();
      params.set('category', cat);
      if (path) params.set('page', path);
      router.replace(`/knowledge-base/wiki?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    migrateWiki().catch(() => undefined);
  }, []);

  useEffect(() => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    listWikiCategories()
      .then((data) => {
        setCategories(data);
        setCategory((current) => {
          if (current && data.some((c) => c.key === current)) return current;
          if (categoryParam && data.some((c) => c.key === categoryParam)) return categoryParam;
          return data[0]?.key ?? null;
        });
      })
      .catch((e: Error) => setCategoriesError(e.message))
      .finally(() => setCategoriesLoading(false));
  }, [categoryParam]);

  useEffect(() => {
    if (!category) {
      setPages([]);
      return;
    }
    setPagesLoading(true);
    setPagesError(null);
    setPages([]);
    listWikiPages(undefined, category)
      .then(setPages)
      .catch((e: Error) => setPagesError(e.message))
      .finally(() => setPagesLoading(false));
  }, [category]);

  useEffect(() => {
    if (pages.length > 0 && !selectedPath) {
      const first = pages[0];
      setSelectedPath(first.path);
      if (category) syncUrl(category, first.path);
    }
  }, [pages, selectedPath, category, syncUrl]);

  useEffect(() => {
    if (!selectedPath) {
      setPageDetail(null);
      return;
    }
    setContentLoading(true);
    setPageDetail(null);
    getWikiPage(selectedPath, undefined, true)
      .then((data) => setPageDetail(data.detail ?? null))
      .catch(() => setPageDetail(null))
      .finally(() => setContentLoading(false));
  }, [selectedPath]);

  useEffect(() => {
    if (categoryParam && categoryParam !== category && categories.some((c) => c.key === categoryParam)) {
      setCategory(categoryParam);
    }
  }, [categoryParam, category, categories]);

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

  function selectCategory(cat: string) {
    setCategory(cat);
    setQuery('');
    setSelectedPath(null);
    setPageDetail(null);
    syncUrl(cat, null);
  }

  function selectPage(path: string) {
    setSelectedPath(path);
    if (category) syncUrl(category, path);
  }

  return (
    <div className="flex w-full gap-4 py-6 md:py-8">
      {/* 左侧导航 */}
      <aside className="flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-shell-border bg-shell-panel lg:w-72">
        <div className="border-b border-shell-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <BookOpen className="size-5 text-brand-primary" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">知识管理</p>
              <p className="text-[14px] font-semibold text-shell-text">Wiki 浏览</p>
            </div>
          </div>
        </div>

        <div className="border-b border-shell-border p-3">
          {categoriesLoading ? (
            <div className="flex items-center gap-2 py-2 text-[12px] text-shell-muted">
              <Loader2 className="size-3.5 animate-spin" />
              加载分类…
            </div>
          ) : categoriesError ? (
            <p className="text-[12px] text-status-error">{categoriesError}</p>
          ) : categories.length === 0 ? (
            <p className="text-[12px] text-shell-muted">暂无分类，请先上传并编译资料</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => selectCategory(c.key)}
                    className={cn(
                      'rounded-full px-3 py-1 text-[12px] font-medium transition-colors',
                      category === c.key
                        ? 'bg-brand-primary text-brand-on-primary'
                        : 'bg-shell-bg text-shell-muted hover:text-shell-text',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-2.5 text-[11px] leading-relaxed text-shell-muted">
                {activeCategory?.description || `${activeCategory?.page_count ?? 0} 篇`}
              </p>
            </>
          )}
        </div>

        <div className="border-b border-shell-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-shell-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索页面…"
              className="w-full rounded-lg border border-shell-border bg-shell-bg py-2 pl-9 pr-3 text-[13px] text-shell-text placeholder:text-shell-muted focus:border-brand-primary/40 focus:outline-none focus:ring-1 focus:ring-brand-primary/20"
            />
          </div>
          <p className="mt-2 text-[11px] text-shell-subtext">
            {filteredPages.length} 篇 · {activeCategory?.label ?? '未选择分类'}
          </p>
        </div>

        <ul className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2">
          {pagesLoading ? (
            <li className="flex items-center justify-center py-10">
              <Loader2 className="size-4 animate-spin text-shell-muted" />
            </li>
          ) : pagesError ? (
            <li className="px-3 py-6 text-[12px] text-status-error">{pagesError}</li>
          ) : filteredPages.length === 0 ? (
            <li className="rounded-xl border border-dashed border-shell-border bg-shell-bg px-3 py-8 text-center text-[13px] text-shell-muted">
              {pages.length === 0 ? '该分类暂无页面' : '无匹配页面'}
            </li>
          ) : (
            filteredPages.map((p) => (
              <li key={p.path}>
                <PageListItem
                  page={p}
                  selected={selectedPath === p.path}
                  onSelect={() => selectPage(p.path)}
                />
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* 主内容 */}
      <div className="flex min-w-0 flex-1 gap-4">
        <div className="custom-scrollbar min-w-0 flex-1 overflow-y-auto">
          {contentLoading ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-shell-border bg-shell-panel py-20 text-shell-muted">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-[14px]">加载内容…</span>
            </div>
          ) : selectedPage && pageDetail ? (
            <div className="space-y-4">
              <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-shell-border bg-shell-panel px-4 py-2.5 text-[12px] text-shell-muted">
                <Link href="/knowledge-base/overview" className="hover:text-brand-primary">
                  知识管理
                </Link>
                <ChevronRight className="size-3 shrink-0" />
                <span>{pageDetail.category_label}</span>
                <ChevronRight className="size-3 shrink-0" />
                <span className="font-medium text-shell-text">{selectedPage.name}</span>
              </nav>
              <WikiCompilationView detail={pageDetail} />
            </div>
          ) : selectedPage && !contentLoading ? (
            <div className="rounded-2xl border border-shell-border bg-shell-panel px-6 py-16 text-center text-[14px] text-shell-muted">
              无法加载编译详情，请确认后端服务已启动。
            </div>
          ) : (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed border-shell-border bg-shell-panel p-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-brand-primary/8">
                <BookOpen className="size-6 text-brand-primary" strokeWidth={1.5} />
              </div>
              <p className="mt-4 text-[15px] font-medium text-shell-text">选择一篇 Wiki</p>
              <p className="mt-1 max-w-xs text-[13px] text-shell-muted">
                {categories.length === 0
                  ? '上传资料并完成编译后，分类会自动出现在左侧'
                  : '从左侧选择页面，查看 AI 编译后的知识结果'}
              </p>
              <Link
                href="/knowledge-base/overview"
                className="mt-4 text-[12px] font-medium text-brand-primary hover:underline"
              >
                返回知识管理概览
              </Link>
            </div>
          )}
        </div>

        {pageDetail ? (
          <aside className="hidden w-48 shrink-0 xl:block">
            <div className="sticky top-6 rounded-2xl border border-shell-border bg-shell-panel p-4">
              <p className="text-[12px] font-semibold text-shell-text">页面目录</p>
              <p className="mt-0.5 text-[11px] text-shell-muted">编译结构导航</p>
              <ul className="mt-3 space-y-0.5">
                {WIKI_DETAIL_SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="block rounded-lg px-2 py-1.5 text-[12px] text-shell-muted transition-colors hover:bg-shell-bg hover:text-brand-primary"
                    >
                      {section.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export default function WikiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-48 items-center justify-center rounded-2xl border border-shell-border bg-shell-panel py-16 text-[14px] text-shell-muted">
          <Loader2 className="mr-2 size-4 animate-spin" />
          加载 Wiki…
        </div>
      }
    >
      <WikiPageContent />
    </Suspense>
  );
}
