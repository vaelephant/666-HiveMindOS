'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { listWikiCategories } from '@/lib/kb-api';
import type { WikiCategory } from '@/lib/kb-types';

export function WikiCategoryCatalog() {
  const [categories, setCategories] = useState<WikiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listWikiCategories()
      .then(setCategories)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载知识目录…
      </div>
    );
  }

  if (error) {
    return <p className="text-[13px] text-status-error">{error}</p>;
  }

  if (categories.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-shell-border bg-shell-bg px-4 py-8 text-center text-[13px] text-shell-muted">
        暂无 Wiki 分类。
        <Link href="/knowledge-base/ingest" className="ml-1 text-brand-primary hover:underline">
          去上传资料
        </Link>
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={`/knowledge-base/wiki?category=${cat.key}`}
          className="group flex items-center justify-between rounded-xl border border-shell-border bg-shell-bg px-4 py-3.5 transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-shell-text transition-colors group-hover:text-brand-primary">
              {cat.label}
            </p>
            <p className="mt-1 text-[11px] text-shell-muted">{cat.page_count} 页</p>
          </div>
          <ArrowRight className="size-3.5 shrink-0 text-shell-muted opacity-0 transition-opacity group-hover:text-brand-primary group-hover:opacity-100" />
        </Link>
      ))}
    </div>
  );
}
