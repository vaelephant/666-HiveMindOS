import type { ChatTurn } from '@/lib/kb-types';

export type UpgradeStrength = 'strong' | 'weak' | 'none';

export type UpgradeSuggestion = {
  recommended: boolean;
  strength: UpgradeStrength;
  taskType: string;
  taskTypeLabel: string;
  suggestedGoal: string;
  reason: string;
  estimatedSteps: string[];
};

export const TASK_TYPE_META: Record<string, { label: string; steps: string[] }> = {
  wiki_organize_decisions: {
    label: 'Wiki 整理',
    steps: ['检索记忆与会话', '提炼事实', '写入候选池', '解析并编译 Wiki'],
  },
  sales_proposal: {
    label: '销售方案',
    steps: ['检索 Wiki', '网络调研', '读取资料', '生成痛点与方案'],
  },
  generic_goal: {
    label: '通用目标',
    steps: ['了解现状', '检索知识', '执行并反思'],
  },
};

const OPEN_GOAL_RE =
  /帮(我|忙)?|请(帮|你)|整理|生成|写入|编译|执行|完成|分析|制定|汇总|记进|落到|做成/;
const AFFIRMATIVE_RE = /^(好[的吧嘛呀]?|可以|行|没问题|那就|请|帮我|都去|都做)/;
const WIKI_SIGNAL_RE = /wiki|整理|决策|decision|编译|记进|候选|写入/i;
const SALES_SIGNAL_RE = /销售方案|客户分析|客户公司|销售|方案|痛点/i;

export function matchTaskType(text: string): string {
  const g = text.toLowerCase();
  if (WIKI_SIGNAL_RE.test(g)) return 'wiki_organize_decisions';
  if (SALES_SIGNAL_RE.test(g)) return 'sales_proposal';
  return 'generic_goal';
}

function isDirectOpenGoal(question: string): boolean {
  const q = question.trim();
  if (!OPEN_GOAL_RE.test(q)) return false;
  const taskType = matchTaskType(q);
  if (taskType !== 'generic_goal') return true;
  return /整理|生成|方案|写入|编译|执行|完成/.test(q);
}

function synthesizeGoal(prior: ChatTurn, last: ChatTurn): string {
  const lastQ = last.question.trim();
  const priorQ = prior.question.trim();
  const taskType = matchTaskType(`${priorQ} ${lastQ}`);

  if (taskType === 'wiki_organize_decisions' || WIKI_SIGNAL_RE.test(lastQ)) {
    return `帮我整理本对话中讨论的项目决策进 Wiki（背景：${priorQ.slice(0, 100)}）`;
  }
  if (taskType === 'sales_proposal' || SALES_SIGNAL_RE.test(lastQ)) {
    const subject = priorQ.length > 10 ? priorQ.slice(0, 80) : lastQ;
    return `基于本对话分析客户并生成销售方案（${subject}）`;
  }
  return `${lastQ}（延续对话：${priorQ.slice(0, 80)}）`;
}

function metaFor(taskType: string): { label: string; steps: string[] } {
  return TASK_TYPE_META[taskType] ?? TASK_TYPE_META.generic_goal;
}

export function detectUpgradeSuggestion(turns: ChatTurn[]): UpgradeSuggestion {
  const none: UpgradeSuggestion = {
    recommended: false,
    strength: 'none',
    taskType: 'generic_goal',
    taskTypeLabel: TASK_TYPE_META.generic_goal.label,
    suggestedGoal: '',
    reason: '',
    estimatedSteps: TASK_TYPE_META.generic_goal.steps,
  };

  if (turns.length === 0) return none;

  const last = turns[turns.length - 1];
  const lastQ = last.question.trim();

  if (isDirectOpenGoal(lastQ)) {
    const taskType = matchTaskType(lastQ);
    const meta = metaFor(taskType);
    return {
      recommended: true,
      strength: 'strong',
      taskType,
      taskTypeLabel: meta.label,
      suggestedGoal: lastQ,
      reason: '当前问题属于多步骤开放目标，适合交给自主任务执行',
      estimatedSteps: meta.steps,
    };
  }

  if (turns.length >= 2 && AFFIRMATIVE_RE.test(lastQ)) {
    const prior = [...turns.slice(0, -1)]
      .reverse()
      .find(
        (t) =>
          matchTaskType(t.question) !== 'generic_goal'
          || WIKI_SIGNAL_RE.test(t.question)
          || SALES_SIGNAL_RE.test(t.question),
      );
    if (prior) {
      const composite = synthesizeGoal(prior, last);
      const taskType = matchTaskType(composite);
      if (taskType !== 'generic_goal' || OPEN_GOAL_RE.test(composite)) {
        const meta = metaFor(taskType);
        return {
          recommended: true,
          strength: 'strong',
          taskType,
          taskTypeLabel: meta.label,
          suggestedGoal: composite,
          reason: '你已确认要动手执行，可将对话上下文升级为自主任务',
          estimatedSteps: meta.steps,
        };
      }
    }
  }

  if (turns.length >= 2) {
    const recent = turns.slice(-3);
    const blob = recent.map((t) => `${t.question} ${t.answer.slice(0, 200)}`).join(' ');
    const taskType = matchTaskType(blob);
    if (taskType !== 'generic_goal') {
      const meta = metaFor(taskType);
      const anchor = recent.find((t) => matchTaskType(t.question) !== 'generic_goal')?.question ?? lastQ;
      return {
        recommended: true,
        strength: 'weak',
        taskType,
        taskTypeLabel: meta.label,
        suggestedGoal: isDirectOpenGoal(anchor) ? anchor : synthesizeGoal(recent[0], last),
        reason: `对话主题接近「${meta.label}」，可升级为自主任务自动完成`,
        estimatedSteps: meta.steps,
      };
    }

    const richContext =
      recent.some((t) => (t.sources?.length ?? 0) > 0 || (t.memories_used?.length ?? 0) > 0)
      && turns.length >= 3;
    if (richContext && OPEN_GOAL_RE.test(lastQ)) {
      const meta = metaFor('generic_goal');
      return {
        recommended: true,
        strength: 'weak',
        taskType: 'generic_goal',
        taskTypeLabel: meta.label,
        suggestedGoal: lastQ,
        reason: '对话已积累较多上下文，升级后可减少重复检索',
        estimatedSteps: meta.steps,
      };
    }
  }

  return none;
}

/** 用户手动升级时，无智能推荐则用最后一问构造默认建议 */
export function manualUpgradeSuggestion(turns: ChatTurn[]): UpgradeSuggestion | null {
  if (turns.length === 0) return null;
  const lastQ = turns[turns.length - 1].question.trim();
  const taskType = matchTaskType(
    turns.map((t) => t.question).join(' ') || lastQ,
  );
  const meta = metaFor(taskType);
  return {
    recommended: true,
    strength: 'none',
    taskType,
    taskTypeLabel: meta.label,
    suggestedGoal: lastQ,
    reason: '将本对话上下文带入自主任务，减少重复检索',
    estimatedSteps: meta.steps,
  };
}

export function collectWikiPaths(turns: ChatTurn[]): string[] {
  const paths = new Set<string>();
  for (const t of turns) {
    for (const s of t.sources ?? []) {
      if (s.path) paths.add(s.path);
    }
  }
  return [...paths];
}

export function collectMemoryIds(turns: ChatTurn[]): number[] {
  const ids = new Set<number>();
  for (const t of turns) {
    for (const m of t.memories_used ?? []) {
      if (m.id != null) ids.add(m.id);
    }
  }
  return [...ids];
}

export type UpgradeContextOptions = {
  includeTurns: boolean;
  includeSessionId: boolean;
  turnLimit?: number;
};

function slimTurn(t: ChatTurn) {
  return {
    question: t.question,
    answer: t.answer.slice(0, 2000),
    sources: (t.sources ?? []).map((s) => ({ path: s.path, name: s.name })),
    memories_used: (t.memories_used ?? []).map((m) => ({
      id: m.id,
      title: m.title,
      memory_type: m.memory_type,
    })),
  };
}

export function buildUpgradeConstraints(
  sessionId: string | null,
  turns: ChatTurn[],
  options: UpgradeContextOptions,
): Record<string, unknown> {
  const limit = options.turnLimit ?? 5;
  const slice = turns.slice(-limit);
  const wikiPaths = collectWikiPaths(slice);
  const memoryIds = collectMemoryIds(slice);

  return {
    source: 'chat_upgrade',
    session_id: options.includeSessionId && sessionId ? sessionId : undefined,
    turn_index: turns.length - 1,
    context: {
      turns: options.includeTurns ? slice.map(slimTurn) : undefined,
      wiki_paths: wikiPaths,
      memory_ids: memoryIds,
    },
  };
}
