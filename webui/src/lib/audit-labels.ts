import type { AuditEvent } from '@/lib/kb-types';

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

type WorkflowStep = {
  step_id?: string;
  action?: string;
  status?: string;
  reason?: string;
  result?: Record<string, unknown>;
};

export type AuditDisplay = {
  title: string;
  description: string;
  bullets: string[];
  meta?: string;
};

function stepLabel(action: string | undefined): string {
  if (!action) return '未知步骤';
  return STEP_ACTION_LABELS[action] ?? action.replace('automation.', '').replace('tool.', '');
}

function formatStepResult(result: Record<string, unknown> | undefined): string | null {
  if (!result) return null;
  if (typeof result.sessions_recapped === 'number') {
    return `复盘 ${result.sessions_recapped} 个会话`;
  }
  if (typeof result.resolved === 'number') {
    return `解析 ${result.resolved} 条（批准 ${result.approved ?? 0}，冲突 ${result.conflict ?? 0}）`;
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

export function formatAuditEvent(ev: AuditEvent): AuditDisplay {
  const d = ev.detail ?? {};
  const action = ev.action;

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

    const bullets = steps.map((s) => {
      const name = stepLabel(s.action);
      if (s.status === 'skipped') {
        const why = s.reason?.includes('when not met')
          ? '条件未满足，已跳过'
          : s.reason ?? '已跳过';
        return `○ ${name}：${why}`;
      }
      const extra = formatStepResult(s.result as Record<string, unknown> | undefined);
      return `✓ ${name}${extra ? `（${extra}）` : ''}`;
    });

    let description =
      ev.summary ??
      (steps.length
        ? `${trigger}执行：${done} 步完成${skipped ? `，${skipped} 步跳过` : ''}`
        : `${trigger}运行工作流`);

    return {
      title: `工作流「${wfName}」`,
      description,
      bullets,
    };
  }

  if (action === 'wiki.compile') {
    const title = String(d.title ?? '');
    const path = String(d.wiki_path ?? '');
    const fromSummary = ev.summary?.replace(/^编译进 Wiki:\s*/, '') ?? '';
    const resolvedPath = path || fromSummary;
    return {
      title: title ? `知识写入 Wiki：${title}` : '知识写入 Wiki',
      description: resolvedPath ? `页面路径：${resolvedPath}` : (ev.summary ?? '候选知识已编译为企业 Wiki 页面'),
      bullets: [],
    };
  }

  if (action === 'wiki.lint') {
    const pages = Number(d.total_pages ?? 0);
    const issueList = d.issues as unknown[] | undefined;
    const issues = Number(d.issues_found ?? issueList?.length ?? 0);
    const descFromSummary = ev.summary;
    return {
      title: 'Wiki 质量巡检',
      description:
        descFromSummary ??
        (issues === 0
          ? `已检查 ${pages} 篇页面，未发现明显问题`
          : `已检查 ${pages} 篇页面，发现 ${issues} 处提示（无严重问题）`),
      bullets: [],
    };
  }

  if (action === 'candidate.approve') {
    return {
      title: '人工批准 Wiki 候选',
      description: ev.summary || '管理员批准了一条待晋升 Wiki 的候选知识',
      bullets: ev.resource_id ? [`候选 #${ev.resource_id}`] : [],
    };
  }

  if (action === 'candidate.reject') {
    return {
      title: '人工驳回 Wiki 候选',
      description: ev.summary || '管理员驳回了一条 Wiki 候选',
      bullets: ev.resource_id ? [`候选 #${ev.resource_id}`] : [],
    };
  }

  if (action === 'wechat.send') {
    const to = String(d.to_user ?? ev.resource_id ?? '');
    return {
      title: '发送企微消息',
      description: to ? `收件人：${to}` : '已向企微成员发送消息',
      bullets: typeof d.chars === 'number' ? [`${d.chars} 字`] : [],
    };
  }

  if (action.startsWith('task.')) {
    const taskAction = action.replace('task.', '');
    return {
      title: `自主任务步骤：${stepLabel(`automation.${taskAction}`) || taskAction}`,
      description: ev.summary ?? '',
      bullets: [],
    };
  }

  return {
    title: ACTION_TITLES[action] ?? ev.summary ?? action,
    description: ev.summary && ACTION_TITLES[action] ? ev.summary : '',
    bullets: [],
  };
}
