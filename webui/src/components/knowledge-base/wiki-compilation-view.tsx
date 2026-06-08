'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Network } from 'lucide-react';
import type { WikiPageDetail } from '@/lib/kb-types';
import { sourceFileUrl } from '@/lib/kb-api';
import { graphEntityUrl, relationLabel } from '@/lib/graph-links';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<string, string> = {
  entity: '实体',
  workflow: '流程',
  rule: '规则',
  decision: '决策',
  other: '知识',
};

function wikiHref(path: string, category?: string) {
  const cat = category ?? path.split('/')[0];
  return `/knowledge-base/wiki?category=${encodeURIComponent(cat)}&page=${encodeURIComponent(path)}`;
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b border-shell-border px-5 py-4 md:px-6">
      <p className="text-[14px] font-semibold text-shell-text">{title}</p>
      <p className="mt-0.5 text-[12px] text-shell-muted">{desc}</p>
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 rounded-2xl border border-shell-border bg-shell-panel">
      <SectionHeader title={title} desc={subtitle} />
      <div className="px-5 py-4 md:px-6">{children}</div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-shell-border bg-shell-bg px-4 py-6 text-center text-[13px] text-shell-muted">
      {text}
    </p>
  );
}

function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      className="scroll-mt-8 rounded-2xl border border-shell-border bg-shell-panel"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none border-b border-shell-border px-5 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-shell-text">{title}</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">{subtitle}</p>
          </div>
          <span className="shrink-0 rounded-full bg-shell-bg px-2 py-0.5 text-[10px] text-shell-muted">
            展开
          </span>
        </div>
      </summary>
      <div className="px-5 py-4 md:px-6">{children}</div>
    </details>
  );
}

function confidenceLabel(c?: string | null) {
  if (c === 'high') return '高';
  if (c === 'low') return '低';
  return '中';
}

function confidenceClass(c?: string | null) {
  if (c === 'high') return 'text-status-success';
  if (c === 'low') return 'text-shell-muted';
  return 'text-shell-subtext';
}

export function WikiCompilationView({ detail }: { detail: WikiPageDetail }) {
  const { extraction, meta } = detail;
  const graphHref =
    detail.kind === 'entity'
      ? graphEntityUrl(detail.title)
      : '/knowledge-base/graph';

  return (
    <div className="space-y-4">
      {detail.has_conflicts ? (
        <div
          id="merge-alert"
          className="scroll-mt-8 flex items-start gap-3 rounded-2xl border border-status-warning/35 bg-status-warning/8 px-5 py-4"
        >
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-warning" />
          <div>
            <p className="text-[14px] font-semibold text-shell-text">
              检测到 {detail.conflicts.length} 处知识冲突
            </p>
            <p className="mt-1 text-[13px] text-shell-muted">
              不同来源对同一字段给出了不同值，请在「知识合并」中确认。
            </p>
          </div>
        </div>
      ) : null}

      {/* 页头 */}
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-shell-muted">
              {detail.category_label} · AI 编译知识页
            </p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[26px]">
              {detail.title}
            </h1>
            {extraction.summary ? (
              <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-shell-subtext">
                {extraction.summary}
              </p>
            ) : (
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-shell-muted">
                企业原始资料经 AI 知识编译器处理后形成的结构化知识结果。
              </p>
            )}
          </div>
          <Link
            href={graphHref}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[12px] font-medium text-shell-text transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5 hover:text-brand-primary"
          >
            实体图谱
            <Network className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-brand-primary/8 px-3 py-1 text-[12px] font-medium text-brand-primary">
            {KIND_LABEL[detail.kind] ?? '知识'}
          </span>
          {Object.entries(meta).map(([k, v]) => (
            <span
              key={k}
              className="inline-flex items-center gap-1.5 rounded-full bg-shell-bg px-3 py-1 text-[12px]"
            >
              <span className="text-shell-muted">{k}</span>
              <span className="font-medium text-shell-text">{v}</span>
            </span>
          ))}
          {detail.updated_at ? (
            <span className="rounded-full bg-shell-bg px-3 py-1 text-[12px] text-shell-muted">
              更新 {detail.updated_at}
            </span>
          ) : null}
        </div>

        {detail.pipeline.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
            {detail.pipeline.map((stage, i) => (
              <div key={stage.stage} className="relative">
                <div className="rounded-xl border border-shell-border bg-shell-bg px-3 py-2.5">
                  <p className="text-[11px] text-shell-muted">{stage.label}</p>
                  <p className="mt-0.5 text-[18px] font-semibold tabular-nums text-shell-text">
                    {stage.count}
                  </p>
                </div>
                {i < detail.pipeline.length - 1 ? (
                  <ArrowRight className="absolute -right-3 top-1/2 hidden size-3 -translate-y-1/2 text-shell-muted lg:block" />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </header>

      <Section
        id="ai-extraction"
        title="AI 提取结果"
        subtitle="从原始资料中识别出的结构化知识"
      >
        <div className="space-y-5">
          {detail.kind === 'workflow' ? (
            <div className="grid gap-3 md:grid-cols-2">
              {extraction.trigger ? (
                <InfoBlock label="触发事件" value={extraction.trigger} />
              ) : null}
              {extraction.duration ? (
                <InfoBlock label="时限要求" value={extraction.duration} />
              ) : null}
              {extraction.output ? <InfoBlock label="产出物" value={extraction.output} /> : null}
            </div>
          ) : null}

          {extraction.attributes.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-medium text-shell-muted">结构化属性</p>
              <div className="overflow-hidden rounded-xl border border-shell-border">
                <table className="w-full text-left text-[13px]">
                  <thead className="bg-shell-bg text-shell-muted">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">属性</th>
                      <th className="px-4 py-2.5 font-medium">值</th>
                      <th className="px-4 py-2.5 font-medium">来源</th>
                      <th className="px-4 py-2.5 font-medium">置信度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.attributes.map((row) => (
                      <tr key={row.key} className="border-t border-shell-border-dim">
                        <td className="px-4 py-3 text-shell-muted">{row.key}</td>
                        <td className="px-4 py-3 text-shell-text">
                          <p>{row.value}</p>
                          {row.excerpt ? (
                            <p className="mt-1 text-[11px] text-shell-muted">「{row.excerpt}」</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-shell-muted">
                          {row.page ? `第${row.page}页 · ` : ''}
                          {row.source ?? '—'}
                        </td>
                        <td className={cn('px-4 py-3 text-[12px]', confidenceClass(row.confidence))}>
                          {confidenceLabel(row.confidence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {extraction.workflow_steps && extraction.workflow_steps.length > 0 ? (
            <ListBlock label="流程步骤" items={extraction.workflow_steps} ordered />
          ) : null}

          {extraction.workflow_conditions && extraction.workflow_conditions.length > 0 ? (
            <ListBlock label="前提条件" items={extraction.workflow_conditions} />
          ) : null}

          {extraction.workflow_participants ? (
            <InfoBlock label="参与角色" value={extraction.workflow_participants} />
          ) : null}

          {extraction.rule_condition ? (
            <InfoBlock label="触发条件" value={extraction.rule_condition} />
          ) : null}
          {extraction.rule_action ? <InfoBlock label="执行动作" value={extraction.rule_action} /> : null}
          {extraction.rule_penalty ? <InfoBlock label="违规后果" value={extraction.rule_penalty} /> : null}

          {!extraction.summary &&
          extraction.attributes.length === 0 &&
          !extraction.workflow_steps?.length &&
          !extraction.rule_condition ? (
            <EmptyHint text="暂无提取结果。" />
          ) : null}
        </div>
      </Section>

      <Section
        id="cross-links"
        title="交叉引用"
        subtitle="相关人物、客户、产品、流程与制度"
      >
        {detail.relations.length === 0 && detail.graph_neighbors.length === 0 ? (
          <EmptyHint text="暂无关联实体。" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {detail.relations.length > 0 ? (
              <div>
                <p className="mb-2 text-[12px] font-medium text-shell-muted">页面内关联</p>
                <ul className="space-y-2">
                  {detail.relations.map((rel) => (
                    <li key={`${rel.target}-${rel.relation_type}`}>
                      {rel.target_path ? (
                        <Link
                          href={wikiHref(rel.target_path)}
                          className="flex items-center justify-between rounded-xl border border-shell-border bg-shell-bg px-3 py-2.5 text-[13px] transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5"
                        >
                          <span className="font-medium text-shell-text">{rel.target}</span>
                          <span className="text-shell-muted">{relationLabel(rel.relation_type)}</span>
                        </Link>
                      ) : (
                        <div className="rounded-xl border border-shell-border bg-shell-bg px-3 py-2.5 text-[13px]">
                          {rel.target}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {detail.graph_neighbors.length > 0 ? (
              <div>
                <p className="mb-2 text-[12px] font-medium text-shell-muted">图谱邻居</p>
                <ul className="space-y-2">
                  {detail.graph_neighbors.map((n) => (
                    <li key={n.name}>
                      <div className="flex items-stretch gap-2">
                        {n.wiki_path ? (
                          <Link
                            href={wikiHref(n.wiki_path)}
                            className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-shell-border bg-shell-bg px-3 py-2.5 text-[13px] transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5"
                          >
                            <span className="truncate font-medium text-shell-text">{n.name}</span>
                            <span className="ml-2 shrink-0 text-shell-muted">{n.entity_type}</span>
                          </Link>
                        ) : (
                          <div className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-shell-border bg-shell-bg px-3 py-2.5 text-[13px]">
                            <span className="font-medium text-shell-text">{n.name}</span>
                            <span className="text-shell-muted">{n.entity_type}</span>
                          </div>
                        )}
                        {detail.kind === 'entity' ? (
                          <Link
                            href={graphEntityUrl(detail.title, { via: n.name })}
                            className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-shell-border bg-shell-bg px-2.5 py-2 text-[11px] text-brand-primary transition-colors hover:border-brand-primary/30 hover:bg-brand-primary/5"
                            title="在图谱中高亮路径"
                          >
                            <Network className="size-3.5" strokeWidth={1.75} />
                            路径
                          </Link>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <CollapsibleSection
        id="raw-sources"
        title="原始来源"
        subtitle="编译本页所依据的企业原始资料"
      >
        {detail.raw_sources.length === 0 ? (
          <EmptyHint text="暂未关联到上传文件。" />
        ) : (
          <ul className="space-y-2">
            {detail.raw_sources.map((src) => (
              <li
                key={`${src.filename}-${src.created_at}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-shell-border bg-shell-bg px-4 py-3"
              >
                <div>
                  <p className="text-[14px] font-medium text-shell-text">{src.filename}</p>
                  <p className="mt-1 text-[12px] text-shell-muted">
                    {src.source_type_label}
                    {src.created_at ? ` · ${src.created_at.slice(0, 10)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {src.id ? (
                    <a
                      href={sourceFileUrl(src.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-shell-border bg-shell-panel px-2.5 py-1 text-[11px] text-brand-primary transition-colors hover:border-brand-primary/30"
                    >
                      查看原文
                    </a>
                  ) : null}
                  <Link
                    href="/knowledge-base/ingest"
                    className="rounded-lg border border-shell-border bg-shell-panel px-2.5 py-1 text-[11px] text-shell-muted transition-colors hover:text-shell-text"
                  >
                    上传资料
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        id="merge"
        title="知识合并"
        subtitle="与已有 Wiki 合并时的新增、更新与冲突"
        defaultOpen={detail.has_conflicts}
      >
        {detail.conflicts.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-shell-border">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-shell-bg text-shell-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">字段</th>
                  <th className="px-4 py-2.5 font-medium">现有值</th>
                  <th className="px-4 py-2.5 font-medium">新值</th>
                  <th className="px-4 py-2.5 font-medium">来源</th>
                </tr>
              </thead>
              <tbody>
                {detail.conflicts.map((c) => (
                  <tr key={`${c.field}-${c.source}`} className="border-t border-shell-border-dim">
                    <td className="px-4 py-3 font-medium text-shell-text">{c.field}</td>
                    <td className="px-4 py-3 text-shell-subtext">{c.existing_value}</td>
                    <td className="px-4 py-3 text-shell-subtext">{c.new_value}</td>
                    <td className="px-4 py-3 text-shell-muted">{c.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : detail.version_log.length > 1 ? (
          <EmptyHint text="已与已有 Wiki 合并更新，当前无字段冲突。" />
        ) : (
          <EmptyHint text="首次编译创建，尚未与其他 Wiki 页发生冲突。" />
        )}
      </CollapsibleSection>

      <CollapsibleSection id="citations" title="来源引用" subtitle="每条知识对应的原始文件与编译批次">
        {detail.citations.length === 0 ? (
          <EmptyHint text="暂无来源引用记录。页码/段落级定位将在后续版本支持。" />
        ) : (
          <ul className="space-y-2">
            {detail.citations.map((c, i) => (
              <li
                key={`${c.source}-${c.date}-${i}`}
                className="rounded-xl border border-shell-border bg-shell-bg px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-shell-muted">
                  <span className="font-medium text-shell-text">{c.source}</span>
                  <span>·</span>
                  <span>{c.date}</span>
                  {c.location ? (
                    <>
                      <span>·</span>
                      <span>{c.location}</span>
                    </>
                  ) : c.page ? (
                    <>
                      <span>·</span>
                      <span>第{c.page}页</span>
                    </>
                  ) : null}
                  {c.source_id ? (
                    <a
                      href={sourceFileUrl(c.source_id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-brand-primary hover:underline"
                    >
                      原文
                    </a>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-shell-subtext">{c.note}</p>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>

      <CollapsibleSection id="version-log" title="版本变化" subtitle="新增、修改与矛盾发现记录">
        {detail.version_log.length === 0 ? (
          <EmptyHint text="暂无版本记录。新格式编译页会自动写入更新日志。" />
        ) : (
          <ol className="space-y-3">
            {detail.version_log.map((entry, i) => (
              <li key={`${entry.date}-${entry.source}-${i}`} className="relative pl-5">
                <span className="absolute left-0 top-2 size-2 rounded-full bg-brand-primary/60" />
                <div className="rounded-xl border border-shell-border bg-shell-bg px-4 py-3">
                  <p className="text-[13px] font-medium text-shell-text">
                    {entry.date} · {entry.source}
                  </p>
                  {entry.summary ? (
                    <p className="mt-1 text-[12px] text-shell-muted">{entry.summary}</p>
                  ) : null}
                  {entry.changes.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-[13px] text-shell-subtext">
                      {entry.changes.map((change) => (
                        <li key={change} className="flex gap-2">
                          <span className="text-shell-muted">·</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleSection>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-shell-border bg-shell-bg px-4 py-3">
      <p className="text-[12px] font-medium text-shell-muted">{label}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-shell-subtext">{value}</p>
    </div>
  );
}

function ListBlock({
  label,
  items,
  ordered = false,
}: {
  label: string;
  items: string[];
  ordered?: boolean;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <div>
      <p className="text-[12px] font-medium text-shell-muted">{label}</p>
      <Tag
        className={cn(
          'mt-2 space-y-1 text-[14px] leading-relaxed text-shell-subtext',
          ordered ? 'list-decimal pl-5' : 'list-disc pl-5',
        )}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </Tag>
    </div>
  );
}

export const WIKI_DETAIL_SECTIONS = [
  { id: 'ai-extraction', label: 'AI 提取' },
  { id: 'cross-links', label: '交叉引用' },
  { id: 'raw-sources', label: '原始来源' },
  { id: 'merge', label: '知识合并' },
  { id: 'citations', label: '来源引用' },
  { id: 'version-log', label: '版本变化' },
] as const;
