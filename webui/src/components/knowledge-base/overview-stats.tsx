'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getOverviewData } from '@/lib/kb-api';
import type { ActivityRecord, OverviewData, SourceActivityRecord } from '@/lib/kb-types';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';
import { CANDIDATE_STATUS_LABEL, MEMORY_TYPE_LABEL } from '@/lib/kb-labels';
import { cn } from '@/lib/utils';

function normalizeActivity(item: ActivityRecord & { kind?: string }): ActivityRecord {
  if (
    item.kind === 'chat' ||
    item.kind === 'memory' ||
    item.kind === 'source' ||
    item.kind === 'candidate'
  ) {
    return item;
  }
  return { ...(item as SourceActivityRecord), kind: 'source' };
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
  return new Date(iso).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function statusLabel(status: string): string {
  switch (status) {
    case 'done': return '编译完成';
    case 'error': return '编译出错';
    case 'compiling': return '编译中';
    case 'uploaded': return '已上传';
    default: return status;
  }
}

const MEMORY_EVENT_LABEL: Record<string, string> = {
  create: '新增',
  update: '更新',
  merge: '合并',
};

const KIND_META = {
  source: { label: '编译', className: 'bg-shell-bg text-shell-subtext' },
  chat: { label: '对话', className: 'bg-brand-primary/8 text-brand-primary' },
  memory: { label: '智慧', className: 'bg-brand-primary/8 text-brand-primary' },
  candidate: { label: '候选', className: 'bg-brand-primary/8 text-brand-primary' },
} as const;

type StatItem = {
  label: string;
  value: string;
  unit: string;
  hint: string;
  accent?: boolean;
};

function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <p className="text-[14px] font-semibold text-shell-text">{title}</p>
      {desc && <p className="mt-0.5 text-[12px] text-shell-muted">{desc}</p>}
    </div>
  );
}

function StatCard({ item }: { item: StatItem }) {
  return (
    <div className="rounded-xl border border-shell-border bg-shell-panel px-4 py-3.5">
      <p className="text-[12px] text-shell-muted">{item.label}</p>
      <p className="mt-1.5 flex items-baseline gap-1 tabular-nums leading-none">
        <span
          className={cn(
            'text-[26px] font-semibold',
            item.accent ? 'text-brand-primary' : 'text-shell-text',
          )}
        >
          {item.value}
        </span>
        <span className="text-[13px] text-shell-muted">{item.unit}</span>
      </p>
      <p className="mt-2 text-[11px] text-shell-subtext">{item.hint}</p>
    </div>
  );
}

function StatGroup({ title, desc, items }: { title: string; desc?: string; items: StatItem[] }) {
  return (
    <div>
      <SectionTitle title={title} desc={desc} />
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {items.map((s) => (
          <StatCard key={s.label} item={s} />
        ))}
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: keyof typeof KIND_META | 'candidate' }) {
  const meta = KIND_META[kind];
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
        meta.className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function OverviewStats() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverviewData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载统计数据…
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;
  const documentItems: StatItem[] = [
    {
      label: '已上传文件',
      value: String(stats.source_count),
      unit: '份',
      hint: stats.source_count_week > 0 ? `本周 +${stats.source_count_week}` : '暂无新增',
      accent: stats.source_count_week > 0,
    },
    {
      label: '提取实体',
      value: String(stats.entity_count),
      unit: '个',
      hint: '客户 / 产品 / 流程',
    },
    {
      label: 'Wiki 页面',
      value: String(stats.wiki_page_count),
      unit: '页',
      hint: '自动生成',
    },
  ];
  const conversationItems: StatItem[] = [
    {
      label: '对话会话',
      value: String(stats.chat_session_count ?? 0),
      unit: '个',
      hint: (stats.chat_sessions_week ?? 0) > 0
        ? `本周活跃 ${stats.chat_sessions_week}`
        : 'Chat 原始记录',
      accent: (stats.chat_sessions_week ?? 0) > 0,
    },
    {
      label: '对话消息',
      value: String(stats.chat_message_count ?? 0),
      unit: '条',
      hint: '用户与助手往来',
    },
    {
      label: '智慧沉淀',
      value: String(stats.memory_count ?? 0),
      unit: '条',
      hint: (stats.memories_week ?? 0) > 0
        ? `本周 +${stats.memories_week}`
        : '从对话自动提取',
      accent: (stats.memories_week ?? 0) > 0,
    },
    {
      label: '待晋升 Wiki',
      value: String(stats.candidate_pending ?? 0),
      unit: '条',
      hint: (stats.candidates_pending_week ?? 0) > 0
        ? `本周新增 ${stats.candidates_pending_week}`
        : '候选池待审核',
      accent: (stats.candidate_pending ?? 0) > 0,
    },
  ];

  return (
    <div className="space-y-5">
      <StatGroup
        title="文档知识"
        desc="上传资料编译后的结构化产出"
        items={documentItems}
      />
      <StatGroup
        title="对话与智慧"
        desc="Chat 原始记录与自动提炼的长期认知"
        items={conversationItems}
      />
    </div>
  );
}

function ActivityRow({ item }: { item: ActivityRecord }) {
  if (item.kind === 'chat') {
    return (
      <li className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-shell-bg">
        <KindBadge kind="chat" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-shell-text">
            <Link
              href={`${HIVEMIND_HOME_PATH}?id=${item.session_id}`}
              className="font-medium hover:text-brand-primary"
            >
              {item.title}
            </Link>
            <span className="text-shell-muted"> · 对话更新</span>
          </p>
          <p className="mt-1 text-[11px] text-shell-subtext">原始聊天记录</p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">
          {timeAgo(item.created_at)}
        </span>
      </li>
    );
  }

  if (item.kind === 'candidate') {
    const statusLabel = CANDIDATE_STATUS_LABEL[item.status] ?? item.status;
    return (
      <li className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-shell-bg">
        <KindBadge kind="candidate" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-shell-text">
            <span className="font-medium">{item.title}</span>
            <span className="text-shell-muted"> · {statusLabel}</span>
          </p>
          <p className="mt-1 text-[11px] text-shell-subtext">
            Wiki 候选 · {item.source_type === 'chat' ? '来自对话' : item.source_type}
          </p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">
          {timeAgo(item.created_at)}
        </span>
      </li>
    );
  }

  if (item.kind === 'memory') {
    const typeLabel = MEMORY_TYPE_LABEL[item.memory_type] ?? item.memory_type;
    const eventLabel = MEMORY_EVENT_LABEL[item.event_type] ?? item.event_type;
    return (
      <li className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-shell-bg">
        <KindBadge kind="memory" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-shell-text">
            <Link href="/memories" className="font-medium hover:text-brand-primary">
              {item.memory_title}
            </Link>
            <span className="text-shell-muted"> · {eventLabel}</span>
          </p>
          <p className="mt-1 text-[11px] text-shell-subtext">{typeLabel}认知</p>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">
          {timeAgo(item.created_at)}
        </span>
      </li>
    );
  }

  return (
    <li className="flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-shell-bg">
      <KindBadge kind="source" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-shell-text">
          <span className="font-medium">《{item.filename}》</span>
          <span className="text-shell-muted"> · {statusLabel(item.status)}</span>
        </p>
        <p className="mt-1 text-[11px] text-shell-subtext">
          {item.status === 'done' && item.wiki_pages_created > 0 && (
            <span>生成 {item.wiki_pages_created} 个 Wiki 页面</span>
          )}
          {item.status === 'done' && item.entities_extracted > 0 && (
            <span>
              {item.wiki_pages_created > 0 ? ' · ' : ''}
              提取 {item.entities_extracted} 个实体
            </span>
          )}
          {item.status === 'error' && item.error && (
            <span className="text-status-error">{item.error.slice(0, 60)}</span>
          )}
          {item.status === 'compiling' && '正在编译中'}
          {item.status === 'uploaded' && '等待编译'}
        </p>
      </div>
      <span className="shrink-0 text-[11px] tabular-nums text-shell-muted">
        {timeAgo(item.created_at)}
      </span>
    </li>
  );
}

export function RecentActivity() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOverviewData()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载动态…
      </div>
    );
  }

  const activity = data?.recent_activity ?? [];

  if (activity.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-shell-border bg-shell-bg px-4 py-8 text-center text-[13px] text-shell-muted">
        暂无动态。上传资料编译 Wiki，或在 Chat 中对话以沉淀智慧。
      </p>
    );
  }

  return (
    <ul className="divide-y divide-shell-border-dim">
      {activity.map((raw, i) => {
        const item = normalizeActivity(raw);
        return <ActivityRow key={`${item.kind}-${i}`} item={item} />;
      })}
    </ul>
  );
}
