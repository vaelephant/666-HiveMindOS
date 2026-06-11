import Link from 'next/link';
import { ArrowRight, BookOpen, Bot, Brain, Library, MessageSquare, Network, Upload } from 'lucide-react';
import { WikiCategoryCatalog } from '@/components/knowledge-base/wiki-category-catalog';
import { CandidateQueue } from '@/components/knowledge-base/candidate-queue';
import { KnowledgePipelineBanner } from '@/components/knowledge-base/knowledge-pipeline-banner';
import { OverviewStats, RecentActivity } from '@/components/knowledge-base/overview-stats';
import { HIVEMIND_HOME_PATH, HIVEMIND_MEMORIES_PATH } from '@/config/navigation';

const QUICK_ACTIONS = [
  {
    href: HIVEMIND_HOME_PATH,
    label: 'Chat',
    desc: '与 HiveMind 对话，检索 Wiki 与智慧',
    icon: MessageSquare,
    tone: 'brand' as const,
  },
  {
    href: HIVEMIND_MEMORIES_PATH,
    label: '智慧进化',
    desc: '查看对话沉淀的智慧',
    icon: Brain,
    tone: 'brand' as const,
  },
  {
    href: '/knowledge-base/ingest',
    label: '上传资料',
    desc: '上传资料编译进 Wiki',
    icon: Upload,
    tone: 'default' as const,
  },
  {
    href: '/knowledge-base/wiki',
    label: 'Wiki 浏览',
    desc: '查看结构化知识页面',
    icon: BookOpen,
    tone: 'default' as const,
  },
  {
    href: '/knowledge-base/graph',
    label: '实体图谱',
    desc: '浏览实体关联关系',
    icon: Network,
    tone: 'default' as const,
  },
  {
    href: '/tasks/agent',
    label: '自主任务',
    desc: '提交开放目标，由 Agent 规划执行',
    icon: Bot,
    tone: 'default' as const,
  },
] as const;

export default function KnowledgeBaseOverviewPage() {
  return (
    <div className="w-full py-6 md:py-8">
      {/* 页头 */}
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <Library className="size-6 text-brand-primary" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">知识管理</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                知识沉淀全景
              </h1>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-shell-muted">
                文档资料与对话记录共同构成可信知识来源，为 Chat 与 Agent 提供 grounding 层。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-shell-bg px-3 py-1 text-[12px] text-shell-subtext">
                  文档 → Wiki / 图谱
                </span>
                <span className="rounded-full bg-brand-primary/8 px-3 py-1 text-[12px] text-brand-primary">
                  对话 → 智慧进化
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 知识管线说明 */}
      <section className="mt-4">
        <KnowledgePipelineBanner />
      </section>

      {/* 统计 */}
      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        <OverviewStats />
      </section>

      {/* 快速操作 + 近期动态 */}
      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
          <div className="mb-4">
            <p className="text-[14px] font-semibold text-shell-text">快速操作</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">常用入口</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  className="group flex items-start gap-3 rounded-xl border border-shell-border bg-shell-bg px-3.5 py-3 transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5"
                >
                  <span
                    className={
                      a.tone === 'brand'
                        ? 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/8'
                        : 'flex size-8 shrink-0 items-center justify-center rounded-lg bg-shell-panel'
                    }
                  >
                    <Icon
                      className={
                        a.tone === 'brand'
                          ? 'size-3.5 text-brand-primary'
                          : 'size-3.5 text-shell-subtext'
                      }
                      strokeWidth={1.75}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-shell-text group-hover:text-brand-primary">
                        {a.label}
                      </span>
                      <ArrowRight className="size-3 shrink-0 text-shell-muted opacity-0 transition-opacity group-hover:text-brand-primary group-hover:opacity-100" />
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-shell-muted">
                      {a.desc}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
          <div className="mb-4">
            <p className="text-[14px] font-semibold text-shell-text">近期动态</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">编译、对话与智慧进化合并时间线</p>
          </div>
          <RecentActivity />
        </div>
      </section>

      {/* 知识候选池 */}
      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-shell-text">待晋升 Wiki</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">
              对话与智慧提炼产生的候选知识，解析后可编译进企业 Wiki
            </p>
          </div>
          <Link
            href="/human-review"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-primary hover:underline"
          >
            前往人工审核
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
        <CandidateQueue />
      </section>

      {/* 知识目录 */}
      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-shell-text">知识目录</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">Wiki 分类与页面规模</p>
          </div>
          <Link
            href="/knowledge-base/wiki"
            className="text-[12px] font-medium text-brand-primary hover:underline"
          >
            浏览全部 Wiki
          </Link>
        </div>
        <WikiCategoryCatalog />
      </section>
    </div>
  );
}
