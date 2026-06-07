'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getOverviewData } from '@/lib/kb-api';
import type { OverviewData } from '@/lib/kb-types';

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

function statusTag(status: string): string {
  switch (status) {
    case 'done': return '编译';
    case 'error': return '错误';
    case 'compiling': return '编译中';
    case 'uploaded': return '上传';
    default: return status;
  }
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
      <div className="col-span-4 flex items-center gap-2 py-6 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载统计数据…
      </div>
    );
  }

  if (!data) return null;

  const { stats } = data;
  const items = [
    {
      label: '已上传文件',
      value: String(stats.source_count),
      unit: '份',
      hint: stats.source_count_week > 0 ? `本周 +${stats.source_count_week}` : '暂无新增',
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

  return (
    <>
      {items.map((s) => (
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
    </>
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
      <p className="py-4 text-[13px] text-shell-muted">暂无动态，请先上传并编译资料。</p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-shell-border">
      {activity.map((r, i) => (
        <li key={i} className="flex items-start justify-between gap-6 py-3.5">
          <div className="min-w-0">
            <p className="text-[14px] text-shell-text">
              《{r.filename}》{statusLabel(r.status)}
            </p>
            <p className="mt-1 text-[12px] text-shell-muted">
              <span className="text-shell-subtext">{statusTag(r.status)}</span>
              {r.status === 'done' && r.wiki_pages_created > 0 && (
                <span> · 生成 {r.wiki_pages_created} 个 Wiki 页面</span>
              )}
              {r.status === 'done' && r.entities_extracted > 0 && (
                <span> · 提取 {r.entities_extracted} 个实体</span>
              )}
              {r.status === 'error' && r.error && (
                <span className="text-status-error"> · {r.error.slice(0, 60)}</span>
              )}
            </p>
          </div>
          <span className="shrink-0 text-[12px] tabular-nums text-shell-muted">
            {timeAgo(r.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
