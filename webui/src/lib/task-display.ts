import type { AgentTask, QueueTaskItem, TaskStep } from '@/lib/kb-types';

export const ACTION_LABELS: Record<string, string> = {
  search_wiki: '搜索 Wiki',
  read_page: '读取页面',
  list_entities: '查询实体',
  search_memories: '检索智慧',
  list_sessions: '列出会话',
  read_session: '读取会话',
  extract_facts: '提炼事实',
  enqueue_candidates: '写入候选池',
  resolve_candidates: '解析候选',
  compile_candidates: '编译进 Wiki',
  get_org_stats: '组织概况',
  llm_generate: '生成内容',
  web_search: '网络搜索',
  read_url: '读取网页',
};

export const GATE_LABELS: Record<string, string> = {
  auto: '自动执行',
  step_human: '逐步人工确认',
  human: '整单人工批准',
  auto_if_low_risk: '低风险自动 / 高风险人工',
};

export type TimelineItem = {
  id: string;
  name: string;
  action: string;
  status: string;
  gate?: string;
  reflection?: TaskStep['reflection'];
  summary?: Record<string, unknown>;
  error?: string;
};

export function actionLabel(action?: string): string {
  if (!action) return '步骤';
  return ACTION_LABELS[action] ?? action;
}

export function buildTimeline(task: AgentTask): TimelineItem[] {
  const queue = task.queue ?? task.plan?.tasks ?? [];
  const stepById = new Map(
    task.steps.filter((s) => s.task_id).map((s) => [s.task_id as string, s]),
  );

  if (queue.length > 0) {
    return queue.map((q) => {
      const step = stepById.get(q.id);
      return {
        id: q.id,
        name: q.name,
        action: q.action,
        status: step?.status ?? q.status ?? 'pending',
        gate: q.gate,
        reflection: step?.reflection,
        summary: step?.result_summary,
        error: step?.error,
      };
    });
  }

  return task.steps.map((s, i) => ({
    id: s.task_id ?? `step-${i}`,
    name: s.name ?? actionLabel(s.action ?? s.tool),
    action: s.action ?? s.tool ?? 'step',
    status: s.status ?? 'done',
    reflection: s.reflection,
    summary: s.result_summary,
    error: s.error,
  }));
}

export function formatStepSummary(action: string, summary?: Record<string, unknown>): string | null {
  if (!summary || summary.skipped) return null;
  const n = (k: string) => {
    const v = summary[k];
    return typeof v === 'number' ? v : null;
  };

  switch (action) {
    case 'compile_candidates':
      return `编译 ${n('compiled') ?? 0} 条候选，${n('merged') ?? 0} 条写入 Wiki`;
    case 'resolve_candidates':
      return `解析 ${n('resolved') ?? 0} 条，冲突 ${n('conflict') ?? 0} 条`;
    case 'enqueue_candidates':
      return `写入候选池 ${n('created') ?? 0} 条，跳过 ${n('skipped') ?? 0} 条`;
    case 'extract_facts':
      return `提炼 ${n('count') ?? 0} 条事实`;
    case 'web_search': {
      const hits = n('count') ?? (Array.isArray(summary.results) ? summary.results.length : 0);
      return `检索到 ${hits} 条结果`;
    }
    case 'read_url':
      return `读取网页 ${n('chars') ?? 0} 字符`;
    case 'llm_generate':
      return `生成 ${n('chars') ?? 0} 字符内容`;
    case 'search_wiki':
      return `命中 ${n('count') ?? 0} 个 Wiki 页面`;
    case 'search_memories':
      return `召回 ${n('count') ?? 0} 条智慧`;
    default: {
      const keys = ['count', 'compiled', 'resolved', 'created', 'merged', 'chars'] as const;
      const parts = keys
        .map((k) => (n(k) != null ? `${k}=${n(k)}` : null))
        .filter(Boolean);
      return parts.length ? parts.join(' · ') : null;
    }
  }
}

export type ApprovalContext = {
  stepId: string;
  stepName: string;
  action: string;
  reason: string;
  gate?: string;
  riskLevel: 'high' | 'medium' | 'low';
};

export function getApprovalContext(task: AgentTask): ApprovalContext | null {
  if (task.phase !== 'awaiting_approval' || !task.pending_step_id) return null;

  const stepId = task.pending_step_id;
  const queueItem = (task.queue ?? task.plan?.tasks ?? []).find((q) => q.id === stepId);
  const step = task.steps.find((s) => s.task_id === stepId);
  const action = queueItem?.action ?? step?.action ?? 'unknown';
  const reason = step?.error ?? task.error ?? '需人工确认后继续';

  let riskLevel: ApprovalContext['riskLevel'] = 'medium';
  if (action === 'compile_candidates' || reason.includes('冲突')) riskLevel = 'high';
  else if (queueItem?.gate === 'auto') riskLevel = 'low';

  return {
    stepId,
    stepName: queueItem?.name ?? step?.name ?? stepId,
    action,
    reason,
    gate: queueItem?.gate,
    riskLevel,
  };
}

export type TaskFilter = 'all' | 'active' | 'approval' | 'done';

export function taskMatchesFilter(task: AgentTask, filter: TaskFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'approval') return task.phase === 'awaiting_approval';
  if (filter === 'done') return task.status === 'done' || task.status === 'error';
  const activePhases = new Set(['planning', 'planned', 'executing', 'reflecting', 'pending']);
  return task.status === 'running' || activePhases.has(task.phase ?? '');
}

export function collectDimensionScores(task: AgentTask): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const step of task.steps) {
    const dims = step.reflection?.dimensions;
    if (!dims) continue;
    for (const [k, v] of Object.entries(dims)) {
      const num = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (!Number.isFinite(num)) continue;
      (out[k] ??= []).push(num);
    }
  }
  return out;
}

export function avgDimensionScores(task: AgentTask): { name: string; score: number }[] {
  const grouped = collectDimensionScores(task);
  return Object.entries(grouped).map(([name, scores]) => ({
    name,
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
}
