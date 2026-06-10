'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { KnowledgePipelineSteps } from '@/components/knowledge-base/knowledge-pipeline-steps';
import { HIVEMIND_MEMORIES_PATH } from '@/config/navigation';
import { getOverviewData } from '@/lib/kb-api';
import type { OverviewStats, PipelineStage } from '@/lib/kb-types';

function stagesFromStats(stats: OverviewStats): PipelineStage[] {
  const hasChat = (stats.chat_message_count ?? 0) > 0;
  const memories = stats.memory_count ?? 0;
  const pending = stats.candidate_pending ?? 0;
  const wikiPages = stats.wiki_page_count ?? 0;

  return [
    {
      id: 'chat',
      label: '对话记录',
      description: 'Chat 原始问答',
      status: hasChat ? 'done' : 'idle',
      hint: hasChat ? `${stats.chat_message_count} 条消息` : '等待对话',
    },
    {
      id: 'extract',
      label: '智慧提炼',
      description: 'L1 每轮异步',
      status: memories > 0 ? 'done' : 'idle',
      hint: memories > 0 ? `已沉淀 ${memories} 条` : '→ 智慧进化',
    },
    {
      id: 'candidate',
      label: 'Wiki 候选',
      description: '候选池审核',
      status: pending > 0 ? 'active' : 'idle',
      hint: pending > 0 ? `${pending} 条待审核` : '→ 概览队列',
    },
    {
      id: 'wiki',
      label: '企业 Wiki',
      description: '结构化知识页',
      status: wikiPages > 0 ? 'done' : 'idle',
      hint: wikiPages > 0 ? `${wikiPages} 页` : '→ Wiki 浏览',
    },
  ];
}

export function KnowledgePipelineBanner() {
  const [stages, setStages] = useState<PipelineStage[] | null>(null);

  useEffect(() => {
    getOverviewData()
      .then((data) => setStages(stagesFromStats(data.stats)))
      .catch(() => setStages(stagesFromStats({} as OverviewStats)));
  }, []);

  return (
    <div className="rounded-xl border border-shell-border bg-shell-bg px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-medium text-shell-text">知识如何流动</p>
          <p className="mt-0.5 text-[11px] text-shell-muted">
            对话在后台自动走完整管线，无需手动触发提炼
          </p>
        </div>
        <Link
          href={HIVEMIND_MEMORIES_PATH}
          className="text-[11px] font-medium text-brand-primary hover:underline"
        >
          查看智慧进化 →
        </Link>
      </div>
      <div className="mt-3">
        {stages ? (
          <KnowledgePipelineSteps stages={stages} />
        ) : (
          <div className="flex items-center gap-2 py-1 text-[11px] text-shell-muted">
            <Loader2 className="size-3 animate-spin" />
            加载管线状态…
          </div>
        )}
      </div>
    </div>
  );
}
