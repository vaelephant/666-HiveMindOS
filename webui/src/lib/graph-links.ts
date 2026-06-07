export const RELATION_LABEL: Record<string, string> = {
  signs: '签署',
  belongs_to: '归属',
  manages: '管理',
  partners: '合作',
  audits: '审计',
  supplies: '供应',
  governed_by: '受约束于',
  related: '相关',
};

export function relationLabel(type: string) {
  return RELATION_LABEL[type] ?? type;
}

export function graphEntityUrl(
  entityName: string,
  options?: { via?: string; focus?: 1 | 2 },
): string {
  const params = new URLSearchParams();
  params.set('entity', entityName);
  if (options?.via) params.set('via', options.via);
  if (options?.focus) params.set('focus', String(options.focus));
  return `/knowledge-base/graph?${params.toString()}`;
}
