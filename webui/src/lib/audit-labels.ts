import type { AuditEvent } from '@/lib/kb-types';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';
import { wikiHref } from '@/lib/wiki-links';

/** 工作流 id → 中文名（与内置模板一致） */
const WORKFLOW_LABELS: Record<string, string> = {
  nightly_knowledge_pipeline: '夜间知识管线',
  morning_digest: '晨间智慧摘要',
  wiki_sync_pipeline: 'Wiki 同步管线',
};

/** automation / 审计 action → 步骤中文名 */
const STEP_ACTION_LABELS: Record<string, string> = {
  'automation.recap_sessions': '会话复盘',
  'automation.resolve_candidates': '解析 Wiki 候选',
  'automation.compile_candidates': '编译进 Wiki',
  'automation.lint_wiki': 'Wiki 质量巡检',
  'automation.daily_digest': '生成每日摘要',
  'automation.sync_vectors': '同步智慧向量',
};

const ACTION_TITLES: Record<string, string> = {
  'workflow.run': '运行工作流',
  'wiki.compile': '写入 Wiki',
  'wiki.lint': 'Wiki 质量巡检',
  'candidate.approve': '批准 Wiki 候选',
  'candidate.reject': '驳回 Wiki 候选',
  'wechat.send': '发送企微消息',
};

const TRIGGER_LABELS: Record<string, string> = {
  manual: '手动',
  cron: '定时',
};

const LINT_ISSUE_LABELS: Record<string, string> = {
  empty_page: '内容过短',
  orphan_page: '孤立页面（无引用）',
  ai_review: 'AI 审阅建议',
};

const LINT_SEVERITY_LABELS: Record<string, string> = {
  warning: '需关注',
  info: '提示',
  error: '严重',
};

const TASK_ACTION_LABELS: Record<string, string> = {
  search_wiki: '搜索 Wiki',
  read_page: '读取 Wiki 页面',
  search_memories: '搜索智慧记忆',
  list_sessions: '列出会话',
  read_session: '读取会话',
  extract_facts: '提炼结构化事实',
  enqueue_candidates: '写入候选池',
  resolve_candidates: '解析 Wiki 候选',
  compile_candidates: '编译进 Wiki',
  llm_generate: '生成文本',
  web_search: '联网搜索',
  save_deliverable: '保存交付物',
  wechat_work_send: '发送企微消息',
  get_org_stats: '获取组织概况',
  list_entities: '列出知识实体',
};

export type WorkflowStep = {
  step_id?: string;
  action?: string;
  status?: string;
  reason?: string;
  result?: Record<string, unknown>;
};

function formatSkipReason(step: WorkflowStep, steps: WorkflowStep[]): string {
  const reason = step.reason ?? '';
  if (reason.includes('$resolve.approved') || step.step_id === 'compile') {
    const resolveStep = steps.find(
      (s) => s.step_id === 'resolve' || s.action?.includes('resolve_candidates'),
    );
    const approved = Number(resolveStep?.result?.approved ?? 0);
    const resolved = Number(resolveStep?.result?.resolved ?? 0);
    if (approved === 0 && resolved > 0) {
      return `解析了 ${resolved} 条候选，但尚无自动批准项（需人工审核后才可写入 Wiki）`;
    }
    if (approved === 0) {
      return '没有待写入 Wiki 的已批准候选';
    }
  }
  if (reason.includes('when not met')) {
    return '前置条件未满足，已跳过';
  }
  return reason || '已跳过';
}

type LintIssue = {
  type?: string;
  page?: string;
  severity?: string;
  feedback?: string;
};

export type AuditDetailLine = {
  text: string;
  href?: string;
};

export type AuditLink = {
  label: string;
  href: string;
};

export type AuditDisplay = {
  title: string;
  description: string;
  bullets: AuditDetailLine[];
  links: AuditLink[];
  actorLabel: string | null;
  workflowRunId?: string | null;
};

export function formatWorkflowStepBullets(steps: WorkflowStep[]): AuditDetailLine[] {
  return steps.map((s) => {
    const name = stepLabel(s.action);
    if (s.status === 'skipped') {
      const why = formatSkipReason(s, steps);
      return { text: `○ ${name}：${why}` };
    }
    const extra = formatStepResult(s.result as Record<string, unknown> | undefined);
    return { text: `✓ ${name}${extra ? `（${extra}）` : ''}` };
  });
}

function taskStepLabel(action: string): string {
  return TASK_ACTION_LABELS[action] ?? STEP_ACTION_LABELS[`automation.${action}`] ?? action;
}

function chatLinksFromDetail(d: Record<string, unknown>): AuditLink[] {
  const sid = String(d.session_id ?? '');
  if (!sid) return [];
  return [{
    label: '打开来源对话',
    href: `${HIVEMIND_HOME_PATH}?id=${encodeURIComponent(sid)}`,
  }];
}

function withChatLinks(links: AuditLink[], d: Record<string, unknown>): AuditLink[] {
  return [...links, ...chatLinksFromDetail(d)];
}

function stepLabel(action: string | undefined): string {
  if (!action) return '未知步骤';
  return STEP_ACTION_LABELS[action] ?? action.replace('automation.', '').replace('tool.', '');
}

function pageLabel(path: string): string {
  const name = path.split('/').pop()?.replace(/\.md$/, '') ?? path;
  return decodeURIComponent(name.replace(/_/g, ' '));
}

function formatStepResult(result: Record<string, unknown> | undefined): string | null {
  if (!result) return null;
  if (typeof result.sessions_recapped === 'number') {
    return `复盘 ${result.sessions_recapped} 个会话`;
  }
  if (typeof result.resolved === 'number') {
    const approved = Number(result.approved ?? 0);
    const conflict = Number(result.conflict ?? 0);
    const pending = Math.max(0, result.resolved - approved - conflict);
    const parts: string[] = [`处理 ${result.resolved} 条候选`];
    if (approved > 0) parts.push(`${approved} 条可写入 Wiki`);
    if (conflict > 0) parts.push(`${conflict} 条存在冲突`);
    if (pending > 0) parts.push(`${pending} 条待人工审核`);
    return parts.join('，');
  }
  if (typeof result.merged === 'number') {
    return `写入 Wiki ${result.merged} 条`;
  }
  if (typeof result.total_pages === 'number') {
    return `检查 ${result.total_pages} 页，发现 ${result.issues_found ?? 0} 项`;
  }
  if (typeof result.synced === 'number') {
    return `同步 ${result.synced} 条向量`;
  }
  if (typeof result.digest === 'string') {
    return `生成摘要 ${(result.digest as string).slice(0, 40)}…`;
  }
  return null;
}

function formatLintIssue(issue: LintIssue): AuditDetailLine {
  const kind = LINT_ISSUE_LABELS[issue.type ?? ''] ?? issue.type ?? '问题';
  const severity = issue.severity ? LINT_SEVERITY_LABELS[issue.severity] ?? issue.severity : '';
  const page = issue.page ?? '';
  const pageName = page ? pageLabel(page) : '';
  const href = page && page.includes('/') ? wikiHref(page) : undefined;

  let text = severity ? `${kind}（${severity}）` : kind;
  if (pageName) text += ` · ${pageName}`;
  if (issue.type === 'ai_review' && issue.feedback) {
    const snippet = issue.feedback.replace(/\s+/g, ' ').slice(0, 120);
    text += `：${snippet}${issue.feedback.length > 120 ? '…' : ''}`;
  }

  return { text, href };
}

export function formatActorLabel(ev: AuditEvent): string | null {
  const trigger = String(ev.detail?.trigger ?? '');
  if (trigger === 'cron') return '定时任务';
  const name = ev.user_name?.trim();
  if (name && name.length > 1) return name;
  if (ev.user_email) {
    const prefix = ev.user_email.split('@')[0] ?? '';
    if (prefix.length <= 2 || /^\d+$/.test(prefix)) {
      return ev.user_email;
    }
    return prefix;
  }
  if (!ev.user_id) return '系统';
  return null;
}

export function formatAuditEvent(ev: AuditEvent): AuditDisplay {
  const d = ev.detail ?? {};
  const action = ev.action;
  const actorLabel = formatActorLabel(ev);

  if (action === 'workflow.run') {
    const wfId = ev.resource_id ?? '';
    const wfName =
      String(d.workflow_label ?? '') ||
      WORKFLOW_LABELS[wfId] ||
      wfId;
    const trigger = TRIGGER_LABELS[String(d.trigger ?? 'manual')] ?? '手动';
    const steps = (d.steps as WorkflowStep[] | undefined) ?? [];
    const done = steps.length
      ? steps.filter((s) => s.status === 'done').length
      : Number(d.steps_done ?? 0);
    const skipped = steps.length
      ? steps.filter((s) => s.status === 'skipped').length
      : Number(d.steps_skipped ?? 0);

    const bullets = formatWorkflowStepBullets(steps);
    const runId = String(d.run_id ?? '');

    const description =
      ev.summary ??
      (steps.length
        ? `${trigger}执行：${done} 步完成${skipped ? `，${skipped} 步跳过` : ''}`
        : `${trigger}运行工作流`);

    const links: AuditLink[] = [{ label: '打开工作流', href: '/workflows' }];

    return {
      title: `工作流「${wfName}」`,
      description,
      bullets,
      links,
      actorLabel: trigger === 'cron' ? '定时任务' : actorLabel,
      workflowRunId: runId || null,
    };
  }

  if (action === 'wiki.compile') {
    const title = String(d.title ?? '');
    const path = String(d.wiki_path ?? '');
    const fromSummary = ev.summary?.replace(/^编译进 Wiki:\s*/, '').replace(/^将「.+」写入 Wiki$/, '') ?? '';
    const resolvedPath = path || fromSummary;
    const links: AuditLink[] = [];
    if (resolvedPath && resolvedPath.includes('/')) {
      links.push({ label: '打开 Wiki 页面', href: wikiHref(resolvedPath) });
    }
    return {
      title: title ? `知识写入 Wiki：${title}` : '知识写入 Wiki',
      description: resolvedPath ? `页面路径：${resolvedPath}` : (ev.summary ?? '候选知识已编译为企业 Wiki 页面'),
      bullets: [],
      links: withChatLinks(links, d),
      actorLabel,
    };
  }

  if (action === 'wiki.lint') {
    const pages = Number(d.total_pages ?? 0);
    const issueList = (d.issues as LintIssue[] | undefined) ?? [];
    const issues = Number(d.issues_found ?? issueList.length ?? 0);
    const descFromSummary = ev.summary;
    const bullets = issueList.map(formatLintIssue);

    return {
      title: 'Wiki 质量巡检',
      description:
        descFromSummary ??
        (issues === 0
          ? `已检查 ${pages} 篇页面，未发现明显问题`
          : `已检查 ${pages} 篇页面，发现 ${issues} 处提示（无严重问题）`),
      bullets,
      links: [{ label: '打开 Wiki', href: '/knowledge-base/wiki' }],
      actorLabel,
    };
  }

  if (action === 'candidate.approve') {
    const cid = ev.resource_id;
    return {
      title: '人工批准 Wiki 候选',
      description: ev.summary || '管理员批准了一条待晋升 Wiki 的候选知识',
      bullets: [],
      links: withChatLinks(
        cid
          ? [{ label: '查看候选详情', href: `/human-review?candidate=${cid}` }]
          : [{ label: '人工审核', href: '/human-review' }],
        d,
      ),
      actorLabel,
    };
  }

  if (action === 'candidate.reject') {
    const cid = ev.resource_id;
    return {
      title: '人工驳回 Wiki 候选',
      description: ev.summary || '管理员驳回了一条 Wiki 候选',
      bullets: [],
      links: withChatLinks(
        cid
          ? [{ label: '查看候选详情', href: `/human-review?candidate=${cid}` }]
          : [{ label: '人工审核', href: '/human-review' }],
        d,
      ),
      actorLabel,
    };
  }

  if (action === 'wechat.send') {
    const to = String(d.to_user ?? ev.resource_id ?? '');
    return {
      title: '发送企微消息',
      description: to ? `收件人：${to}` : '已向企微成员发送消息',
      bullets: typeof d.chars === 'number' ? [{ text: `${d.chars} 字` }] : [],
      links: [{ label: '企微集成设置', href: '/integrations/wechat-work' }],
      actorLabel,
    };
  }

  if (action === 'task.save_deliverable') {
    const path = String(d.wiki_path ?? '');
    const taskName = String(d.task_name ?? '');
    const links: AuditLink[] = [];
    if (path && path.includes('/')) {
      links.push({ label: '打开交付物', href: wikiHref(path) });
    }
    return {
      title: taskName ? `任务交付物：${taskName}` : '保存任务交付物',
      description: path ? `已写入 Wiki：${path}` : (ev.summary ?? '任务产出已保存'),
      bullets: [],
      links,
      actorLabel,
    };
  }

  if (action.startsWith('task.')) {
    const taskAction = action.replace('task.', '');
    const label = taskStepLabel(taskAction);
    const path = String(d.wiki_path ?? '');
    const links: AuditLink[] = [];
    if (path && path.includes('/')) {
      links.push({ label: '打开 Wiki 页面', href: wikiHref(path) });
    }
    if (taskAction === 'wechat_work_send') {
      links.push({ label: '企微集成设置', href: '/integrations/wechat-work' });
    }
    return {
      title: `自主任务 · ${label}`,
      description: ev.summary?.replace(/^[^·]+ · /, '') ?? ev.summary ?? '',
      bullets: [],
      links,
      actorLabel,
    };
  }

  return {
    title: ACTION_TITLES[action] ?? ev.summary ?? action,
    description: ev.summary && ACTION_TITLES[action] ? ev.summary : '',
    bullets: [],
    links: [],
    actorLabel,
  };
}
