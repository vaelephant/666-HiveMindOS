'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
      <div className="mt-4 flex items-center gap-2 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载知识目录…
      </div>
    );
  }

  if (error) {
    return <p className="mt-4 text-[13px] text-status-error">{error}</p>;
  }

  if (categories.length === 0) {
    return (
      <p className="mt-4 text-[13px] text-shell-muted">
        暂无 Wiki 分类。
        <Link href="/knowledge-base/ingest" className="ml-1 text-brand-primary hover:underline">
          去上传资料
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-x-12 gap-y-6 lg:grid-cols-4">
      {categories.map((cat) => (
        <Link
          key={cat.key}
          href={`/knowledge-base/wiki?category=${cat.key}`}
          className="group block"
        >
          <p className="text-[14px] font-medium text-shell-text transition-colors group-hover:text-brand-primary">
            {cat.label}
          </p>
          <p className="mt-1 text-[12px] text-shell-muted">{cat.page_count} 页</p>
        </Link>
      ))}
    </div>
  );
}
