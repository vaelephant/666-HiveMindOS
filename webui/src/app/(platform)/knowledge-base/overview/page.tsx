import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

const STATS = [
  { label: '已上传文件', value: '24', unit: '份', hint: '本周 +3' },
  { label: '提取实体', value: '186', unit: '个', hint: '客户 / 产品 / 流程' },
  { label: 'Wiki 页面', value: '68', unit: '页', hint: '自动生成' },
  { label: '知识问答', value: '312', unit: '次', hint: '本月' },
] as const;

const RECENT = [
  { time: '5 分钟前', text: '《销售流程 SOP v3.pdf》编译完成', tag: '编译', pages: 12 },
  { time: '1 小时前', text: '《客户报价模板.xlsx》提取 8 个实体', tag: '提取', pages: 8 },
  { time: '3 小时前', text: 'lint_agent 巡检发现 2 个孤立页面', tag: '巡检', pages: 0 },
  { time: '昨天', text: '《产品手册 Q2.docx》编译完成', tag: '编译', pages: 23 },
] as const;

const QUICK_ACTIONS = [
  { href: '/knowledge-base/ingest', label: '上传资料', desc: '编译新文档进入知识库' },
  { href: '/knowledge-base/query', label: '知识问答', desc: '基于 Wiki 回答业务问题' },
  { href: '/knowledge-base/wiki', label: '浏览 Wiki', desc: '查看结构化知识页面' },
  { href: '/knowledge-base/graph', label: '实体图谱', desc: '查看实体关联关系' },
] as const;

const CATALOG = [
  { label: 'entities', name: '实体档案', count: 42 },
  { label: 'workflows', name: '业务流程', count: 15 },
  { label: 'glossary', name: '术语规则', count: 8 },
  { label: 'decisions', name: '历史决策', count: 3 },
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
        {STATS.map((s) => (
          <div key={s.label}>
            <p className="text-[13px] text-shell-muted">{s.label}</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[28px] font-semibold tabular-nums tracking-tight text-shell-text">
                {s.value}
              </span>
              <span className="text-[14px] text-shell-muted">{s.unit}</span>
            </p>
            <p className="mt-1 text-[12px] text-shell-subtext">{s.hint}</p>
          </div>
        ))}
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
          <ul className="mt-4 divide-y divide-shell-border">
            {RECENT.map((r, i) => (
              <li key={i} className="flex items-start justify-between gap-6 py-3.5">
                <div className="min-w-0">
                  <p className="text-[14px] text-shell-text">{r.text}</p>
                  <p className="mt-1 text-[12px] text-shell-muted">
                    <span className="text-shell-subtext">{r.tag}</span>
                    {r.pages > 0 && <span> · 生成 {r.pages} 个 Wiki 页面</span>}
                  </p>
                </div>
                <span className="shrink-0 text-[12px] tabular-nums text-shell-muted">{r.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-8">
        <SectionLabel>知识目录</SectionLabel>
        <div className="mt-4 grid grid-cols-2 gap-x-12 gap-y-6 lg:grid-cols-4">
          {CATALOG.map((cat) => (
            <Link
              key={cat.label}
              href={`/knowledge-base/wiki?category=${cat.label}`}
              className="group block"
            >
              <p className="text-[14px] font-medium text-shell-text transition-colors group-hover:text-brand-primary">
                {cat.name}
              </p>
              <p className="mt-1 text-[12px] text-shell-muted">{cat.count} 页</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
