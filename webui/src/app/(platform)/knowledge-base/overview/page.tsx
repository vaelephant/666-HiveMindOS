import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { WikiCategoryCatalog } from '@/components/knowledge-base/wiki-category-catalog';
import { OverviewStats, RecentActivity } from '@/components/knowledge-base/overview-stats';

const QUICK_ACTIONS = [
  { href: '/knowledge-base/ingest', label: '上传资料', desc: '编译新文档进入知识库' },
  { href: '/knowledge-base/query', label: '知识问答', desc: '基于 Wiki 回答业务问题' },
  { href: '/knowledge-base/wiki', label: '浏览 Wiki', desc: '查看结构化知识页面' },
  { href: '/knowledge-base/graph', label: '实体图谱', desc: '查看实体关联关系' },
] as const;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-medium tracking-wide text-shell-muted">{children}</p>
  );
}

export default function KnowledgeBaseOverviewPage() {
  return (
    <div className="w-full divide-y divide-shell-border">
      <header className="py-8">
        <h1 className="text-[22px] font-semibold tracking-tight text-shell-text">知识库概览</h1>
        <p className="mt-2 text-[15px] text-shell-muted">
          企业原始资料 → 编译 → 持续成长的知识网络
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-12 gap-y-8 py-8 lg:grid-cols-4">
        <OverviewStats />
      </section>

      <section className="grid gap-12 py-8 lg:grid-cols-[240px_1fr]">
        <div>
          <SectionLabel>快速操作</SectionLabel>
          <ul className="mt-4 divide-y divide-shell-border">
            {QUICK_ACTIONS.map((a) => (
              <li key={a.href}>
                <Link
                  href={a.href}
                  className="group flex items-center justify-between py-3.5 transition-colors hover:text-brand-primary"
                >
                  <span>
                    <span className="block text-[14px] font-medium text-shell-text group-hover:text-brand-primary">
                      {a.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-shell-muted">{a.desc}</span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-shell-muted opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <SectionLabel>近期动态</SectionLabel>
          <RecentActivity />
        </div>
      </section>

      <section className="py-8">
        <SectionLabel>知识目录</SectionLabel>
        <WikiCategoryCatalog />
      </section>
    </div>
  );
}
