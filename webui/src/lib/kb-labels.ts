/** 与后端 settings/taxonomy.yaml、settings/wiki.yaml 保持一致 */

export const CATEGORY_LABEL: Record<string, string> = {
  decision: '决策',
  project: '项目',
  workflow: '流程',
  rule: '规则',
  product: '产品',
  methodology: '方法论',
  entity: '实体',
  preference: '偏好',
  other: '其它',
  general: '通用',
};

export const MEMORY_TYPE_LABEL: Record<string, string> = {
  project: '项目',
  preference: '偏好',
  decision: '决策',
  fact: '事实',
  rule: '规则',
};

export const KIND_BADGE: Record<string, string> = {
  entity: '实体',
  workflow: '流程',
  rule: '规则',
  decision: '决策',
  project: '项目',
  product: '产品',
  methodology: '方法论',
  other: '其它',
};

export const SOURCE_LABEL: Record<string, string> = {
  chat: '对话',
  recap: '复盘',
  ingest: '文档',
  manual: '手动',
  agent: 'Agent',
};

export const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已批准',
  merged: '已进 Wiki',
  rejected: '已驳回',
  conflict: '冲突',
};

export const PROPOSED_ACTION_LABEL: Record<string, string> = {
  create: '新建',
  update: '更新',
  create_or_update: '创建或更新',
  supplement: '补充',
  merge: '合并',
};
