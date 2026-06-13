import type {
  AgentExperience,
  AgentSkillCreate,
  AgentSkillDetail,
  AgentSkillSummary,
  AgentTask,
  AutomationJob,
  AutomationJobUpdate,
  AutomationRun,
  WorkflowDefinition,
  WorkflowRun,
  WorkflowTemplate,
  CandidateStats,
  ChatSendResponse,
  ChatSession,
  ChatSessionSummary,
  DeleteSessionResponse,
  EntityDetail,
  GraphSnapshot,
  IngestResult,
  KnowledgeCandidate,
  SessionPipeline,
  MemoryEventRecord,
  MemoryRecord,
  MemoryStats,
  OverviewData,
  CustomModelCreate,
  LlmUsageStats,
  AuditEventsResponse,
  ModelSettingsCatalog,
  OrgPlaybook,
  OrgPlaybookPreview,
  QueryResult,
  SourceCollection,
  SourceCollectionsResponse,
  SourceRecord,
  WikiCategory,
  WikiPage,
  WikiPageDetail,
  WikiPageResponse,
} from '@/lib/kb-types';

export const DEFAULT_ORG = process.env.NEXT_PUBLIC_KB_DEFAULT_ORG ?? 'demo';

let _clientOrgId: string | null = null;
let _clientUserId: string | null = null;

/** 由 OrgProvider 在客户端注入当前登录用户的 orgId / userId */
export function setClientOrgId(orgId: string | null): void {
  _clientOrgId = orgId;
}

export function setClientUserId(userId: string | null): void {
  _clientUserId = userId;
}

export function resolveOrgId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && _clientOrgId) return _clientOrgId;
  return DEFAULT_ORG;
}

export function resolveUserId(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window !== 'undefined' && _clientUserId) return _clientUserId;
  return 'demo';
}

const base = (orgId: string) => `/api/kb/${orgId}`;

function parseApiError(text: string, status: number): string {
  if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('__next_error__')) {
    return `请求失败 (HTTP ${status})：接口返回了页面而非 JSON，请确认 HiveMindOS 后端已启动并刷新页面`;
  }
  try {
    const body = JSON.parse(text) as { detail?: string; error?: string };
    if (typeof body.detail === 'string') return body.detail;
    if (typeof body.error === 'string') return body.error;
  } catch {
    // not JSON
  }
  return text || `HTTP ${status}`;
}

const API_FETCH_INIT: RequestInit = {
  credentials: 'same-origin',
  headers: { Accept: 'application/json' },
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...API_FETCH_INIT, ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(parseApiError(text, res.status));
  }
  return res.json() as Promise<T>;
}

export async function uploadSource(
  file: File,
  options?: { orgId?: string; collection?: string | null },
): Promise<SourceRecord> {
  const orgId = resolveOrgId(options?.orgId);
  const form = new FormData();
  form.append('file', file);
  if (options?.collection?.trim()) {
    form.append('collection', options.collection.trim());
  }
  return req(`${base(orgId)}/sources`, { method: 'POST', body: form });
}

export async function listSources(orgId = resolveOrgId()): Promise<SourceRecord[]> {
  const data = await req<{ sources: SourceRecord[] }>(`${base(orgId)}/sources`);
  return data.sources;
}

export async function compileSource(sourceId: string, orgId = resolveOrgId()): Promise<SourceRecord> {
  return req(`${base(orgId)}/sources/${sourceId}/compile`, { method: 'POST' });
}

export async function deleteSource(sourceId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/sources/${sourceId}`, { method: 'DELETE' });
}

export async function listSourceCollections(orgId = resolveOrgId()): Promise<SourceCollectionsResponse> {
  return req(`${base(orgId)}/collections`);
}

export async function updateSourceCollection(
  sourceId: string,
  collection: string | null,
  orgId = resolveOrgId(),
): Promise<SourceRecord> {
  return req(`${base(orgId)}/sources/${sourceId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection }),
  });
}

export async function ingestFile(file: File, orgId = resolveOrgId()): Promise<IngestResult> {
  const form = new FormData();
  form.append('file', file);
  return req(`${base(orgId)}/ingest`, { method: 'POST', body: form });
}

export async function queryKnowledge(question: string, orgId = resolveOrgId()): Promise<QueryResult> {
  return req(`${base(orgId)}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
}

export async function createTask(
  input: string,
  options?: { orgId?: string; constraints?: Record<string, unknown> },
): Promise<AgentTask> {
  const orgId = resolveOrgId(options?.orgId);
  return req(`${base(orgId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input,
      ...(options?.constraints ? { constraints: options.constraints } : {}),
    }),
  });
}

export async function listTasks(orgId = resolveOrgId()): Promise<AgentTask[]> {
  const data = await req<{ tasks: AgentTask[] }>(`${base(orgId)}/tasks`);
  return data.tasks;
}

export async function getTask(taskId: string, orgId = resolveOrgId()): Promise<AgentTask> {
  return req(`${base(orgId)}/tasks/${taskId}`);
}

export async function deleteTask(taskId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function approveTask(
  taskId: string,
  fromTask?: string,
  orgId = resolveOrgId(),
): Promise<AgentTask> {
  return req(`${base(orgId)}/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_task: fromTask ?? null }),
  });
}

export async function cancelTask(taskId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/tasks/${taskId}/cancel`, { method: 'POST' });
}

export async function listExperiences(
  orgId = resolveOrgId(),
  taskType?: string,
  limit = 5,
): Promise<AgentExperience[]> {
  const url = new URL(`${base(orgId)}/experiences`, window.location.origin);
  if (taskType) url.searchParams.set('task_type', taskType);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ experiences: AgentExperience[] }>(url.pathname + url.search);
  return data.experiences;
}

export async function listAutomations(orgId = resolveOrgId()): Promise<AutomationJob[]> {
  const data = await req<{ jobs: AutomationJob[] }>(`${base(orgId)}/automations`);
  return data.jobs;
}

export async function listAutomationRuns(
  jobId?: string,
  orgId = resolveOrgId(),
  limit = 50,
): Promise<AutomationRun[]> {
  const url = new URL(`${base(orgId)}/automations/runs`, window.location.origin);
  if (jobId) url.searchParams.set('job_id', jobId);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ runs: AutomationRun[] }>(url.toString());
  return data.runs;
}

export async function runAutomation(
  jobId: string,
  params?: Record<string, number | boolean | string>,
  orgId = resolveOrgId(),
): Promise<{ ok: boolean; run: AutomationRun }> {
  return req(`${base(orgId)}/automations/${jobId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: params ?? {} }),
  });
}

export async function updateAutomation(
  jobId: string,
  patch: AutomationJobUpdate,
  orgId = resolveOrgId(),
): Promise<AutomationJob> {
  const data = await req<{ job: AutomationJob }>(`${base(orgId)}/automations/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return data.job;
}

export async function deleteAutomation(jobId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/automations/${jobId}`, { method: 'DELETE' });
}

export async function reseedAutomations(orgId = resolveOrgId()): Promise<AutomationJob[]> {
  const data = await req<{ restored: AutomationJob[]; count: number }>(
    `${base(orgId)}/automations/reseed`,
    { method: 'POST' },
  );
  return data.restored;
}

export async function restoreAutomation(jobId: string, orgId = resolveOrgId()): Promise<AutomationJob> {
  const data = await req<{ job: AutomationJob }>(`${base(orgId)}/automations/${jobId}/restore`, {
    method: 'POST',
  });
  return data.job;
}

export async function deleteAutomationRun(runId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/automations/runs/${runId}`, { method: 'DELETE' });
}

// ── Workflows (YAML 编排) ─────────────────────────────────────────────────────

export async function listWorkflows(orgId = resolveOrgId()): Promise<WorkflowDefinition[]> {
  const data = await req<{ workflows: WorkflowDefinition[] }>(`${base(orgId)}/workflows`);
  return data.workflows;
}

export async function listWorkflowTemplates(orgId = resolveOrgId()): Promise<WorkflowTemplate[]> {
  const data = await req<{ templates: WorkflowTemplate[] }>(`${base(orgId)}/workflows/templates`);
  return data.templates;
}

export async function getWorkflow(
  workflowId: string,
  orgId = resolveOrgId(),
): Promise<{ workflow: WorkflowDefinition; yaml: string }> {
  return req(`${base(orgId)}/workflows/${workflowId}`);
}

export async function createWorkflowFromYaml(
  yaml: string,
  orgId = resolveOrgId(),
): Promise<WorkflowDefinition> {
  const data = await req<{ workflow: WorkflowDefinition }>(`${base(orgId)}/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml }),
  });
  return data.workflow;
}

export async function createWorkflowFromTemplate(
  templateId: string,
  orgId = resolveOrgId(),
): Promise<WorkflowDefinition> {
  const data = await req<{ workflow: WorkflowDefinition }>(
    `${base(orgId)}/workflows/from-template/${templateId}`,
    { method: 'POST' },
  );
  return data.workflow;
}

export async function updateWorkflowYaml(
  workflowId: string,
  yaml: string,
  orgId = resolveOrgId(),
): Promise<WorkflowDefinition> {
  const data = await req<{ workflow: WorkflowDefinition }>(`${base(orgId)}/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ yaml }),
  });
  return data.workflow;
}

export async function deleteWorkflow(workflowId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/workflows/${workflowId}`, { method: 'DELETE' });
}

export async function restoreWorkflow(workflowId: string, orgId = resolveOrgId()): Promise<WorkflowDefinition> {
  const data = await req<{ workflow: WorkflowDefinition }>(
    `${base(orgId)}/workflows/${workflowId}/restore`,
    { method: 'POST' },
  );
  return data.workflow;
}

export async function runWorkflow(
  workflowId: string,
  params?: Record<string, unknown>,
  orgId = resolveOrgId(),
): Promise<{ ok: boolean; run: WorkflowRun }> {
  return req(`${base(orgId)}/workflows/${workflowId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ params: params ?? {} }),
  });
}

export async function setWorkflowSchedule(
  workflowId: string,
  enabled: boolean,
  orgId = resolveOrgId(),
): Promise<WorkflowDefinition> {
  const data = await req<{ workflow: WorkflowDefinition }>(
    `${base(orgId)}/workflows/${workflowId}/schedule`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    },
  );
  return data.workflow;
}

export async function listWorkflowRuns(
  workflowId?: string,
  orgId = resolveOrgId(),
  limit = 50,
): Promise<WorkflowRun[]> {
  const url = new URL(`${base(orgId)}/workflows/runs`, window.location.origin);
  if (workflowId) url.searchParams.set('workflow_id', workflowId);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ runs: WorkflowRun[] }>(url.toString());
  return data.runs;
}

export async function deleteWorkflowRun(runId: string, orgId = resolveOrgId()): Promise<void> {
  await req(`${base(orgId)}/workflows/runs/${runId}`, { method: 'DELETE' });
}

export async function getOverviewData(orgId = resolveOrgId()): Promise<OverviewData> {
  return req(`${base(orgId)}/overview`);
}

export async function listCandidates(
  status?: string,
  orgId = resolveOrgId(),
  limit = 100,
): Promise<KnowledgeCandidate[]> {
  const url = new URL(`${base(orgId)}/candidates`, window.location.origin);
  if (status) url.searchParams.set('status', status);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ candidates: KnowledgeCandidate[] }>(url.toString());
  return data.candidates;
}

export async function getCandidateStats(orgId = resolveOrgId()): Promise<CandidateStats> {
  const data = await req<{ stats: CandidateStats }>(`${base(orgId)}/candidates/stats`);
  return data.stats;
}

export async function resolveCandidates(
  limit = 20,
  orgId = resolveOrgId(),
): Promise<{ resolved: unknown[]; count: number }> {
  return req(`${base(orgId)}/candidates/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
}

export async function compileCandidates(
  limit = 20,
  orgId = resolveOrgId(),
): Promise<{ compiled: unknown[]; count: number }> {
  return req(`${base(orgId)}/candidates/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
}

export async function approveCandidate(
  candidateId: number,
  reason = '',
  orgId = resolveOrgId(),
): Promise<void> {
  await req(`${base(orgId)}/candidates/${candidateId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function rejectCandidate(
  candidateId: number,
  reason = '',
  orgId = resolveOrgId(),
): Promise<void> {
  await req(`${base(orgId)}/candidates/${candidateId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function migrateWiki(orgId = resolveOrgId(), force = false): Promise<{ migrated: number; skipped: number; total: number }> {
  const url = new URL(`${base(orgId)}/wiki/migrate`, window.location.origin);
  if (force) url.searchParams.set('force', 'true');
  return req(url.toString(), { method: 'POST' });
}

export function sourceFileUrl(sourceId: string, orgId = resolveOrgId()): string {
  return `${base(orgId)}/sources/${sourceId}/file`;
}

export async function listWikiCategories(orgId = resolveOrgId()): Promise<WikiCategory[]> {
  const data = await req<{ categories: WikiCategory[] }>(`${base(orgId)}/wiki/categories`);
  return data.categories;
}

export async function listWikiPages(orgId = resolveOrgId(), category?: string): Promise<WikiPage[]> {
  const url = new URL(`${base(orgId)}/wiki`, window.location.origin);
  if (category) url.searchParams.set('category', category);
  const data = await req<{ pages: WikiPage[] }>(url.toString());
  return data.pages;
}

export async function getWikiPage(
  path: string,
  orgId = resolveOrgId(),
  detail = false,
): Promise<WikiPageResponse> {
  const url = new URL(`${base(orgId)}/wiki/${path}`, window.location.origin);
  if (detail) url.searchParams.set('detail', 'true');
  return req(url.toString());
}

export async function listEntities(
  orgId = resolveOrgId(),
  entityType?: string,
) {
  const url = new URL(`${base(orgId)}/graph/entities`, window.location.origin);
  if (entityType) url.searchParams.set('entity_type', entityType);
  const data = await req<{ entities: EntityDetail['entity'][] }>(url.toString());
  return data.entities;
}

export async function getEntityDetail(
  name: string,
  orgId = resolveOrgId(),
): Promise<EntityDetail> {
  return req(`${base(orgId)}/graph/entity/${encodeURIComponent(name)}`);
}

export async function getGraphSnapshot(orgId = resolveOrgId()): Promise<GraphSnapshot> {
  return req(`${base(orgId)}/graph/snapshot`);
}

export async function listChatSessions(orgId = resolveOrgId()): Promise<ChatSessionSummary[]> {
  const data = await req<{ sessions: ChatSessionSummary[] }>(`${base(orgId)}/chat/sessions`);
  return data.sessions;
}

export async function getChatSession(sessionId: string, orgId = resolveOrgId()): Promise<ChatSession> {
  return req(`${base(orgId)}/chat/sessions/${sessionId}`);
}

export async function getSessionPipeline(
  sessionId: string,
  orgId = resolveOrgId(),
): Promise<SessionPipeline> {
  const data = await req<{ pipeline: SessionPipeline }>(
    `${base(orgId)}/chat/sessions/${sessionId}/pipeline`,
  );
  return data.pipeline;
}

export async function deleteChatSession(
  sessionId: string,
  options?: { recap?: boolean },
  orgId = resolveOrgId(),
): Promise<DeleteSessionResponse> {
  const url = new URL(`${base(orgId)}/chat/sessions/${sessionId}`, window.location.origin);
  if (options?.recap) url.searchParams.set('recap', 'true');
  return req(url.toString(), { method: 'DELETE' });
}

export async function listMemories(
  orgId = resolveOrgId(),
  sourceType?: 'chat' | 'ingest',
): Promise<MemoryRecord[]> {
  const path = `${base(orgId)}/memories${sourceType ? `?source_type=${encodeURIComponent(sourceType)}` : ''}`;
  const data = await req<{ memories: MemoryRecord[] }>(path);
  return data.memories;
}

export async function listMemoryEvents(
  orgId = resolveOrgId(),
  limit = 50,
): Promise<MemoryEventRecord[]> {
  const data = await req<{ events: MemoryEventRecord[] }>(
    `${base(orgId)}/memories/events?limit=${encodeURIComponent(String(limit))}`,
  );
  return data.events;
}

export async function getMemoryStats(orgId = resolveOrgId()): Promise<MemoryStats> {
  const data = await req<{ stats: MemoryStats }>(`${base(orgId)}/memories/stats`);
  return data.stats;
}

export async function syncMemoryVectors(orgId = resolveOrgId()): Promise<{
  synced: number;
  total: number;
  available: boolean;
}> {
  return req(`${base(orgId)}/memories/sync-vectors`, { method: 'POST' });
}

/** 发送消息 — 历史由 FastAPI 从 PostgreSQL 加载，前端无需传 history */
export async function sendChatMessage(
  message: string,
  sessionId?: string | null,
  orgId = resolveOrgId(),
): Promise<ChatSendResponse> {
  return req(`${base(orgId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId ?? undefined,
      user_id: resolveUserId(),
    }),
  });
}

export type ChatStreamPhase = 'gathering' | 'writing';

export type ChatStreamHandlers = {
  onStatus?: (phase: ChatStreamPhase) => void;
  onToken?: (text: string) => void;
  onSources?: (sources: ChatSendResponse['sources']) => void;
  onError?: (detail: string) => void;
};

/** SSE 流式发送 — 检索 status → 回答 token → done */
export async function sendChatMessageStream(
  message: string,
  sessionId: string | null | undefined,
  handlers: ChatStreamHandlers,
  orgId = resolveOrgId(),
  signal?: AbortSignal,
): Promise<ChatSendResponse> {
  const res = await fetch(`${base(orgId)}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      session_id: sessionId ?? undefined,
      user_id: resolveUserId(),
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (!res.body) {
    throw new Error('流式响应不可用');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: ChatSendResponse | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        const ev = JSON.parse(line.slice(6)) as {
          type: string;
          phase?: ChatStreamPhase;
          text?: string;
          sources?: ChatSendResponse['sources'];
          detail?: string;
        };

        if (ev.type === 'status' && ev.phase) handlers.onStatus?.(ev.phase);
        if (ev.type === 'token' && ev.text) handlers.onToken?.(ev.text);
        if (ev.type === 'sources' && ev.sources) handlers.onSources?.(ev.sources);
        if (ev.type === 'error') {
          const detail = ev.detail ?? '流式聊天失败';
          handlers.onError?.(detail);
          throw new Error(detail);
        }
        if (ev.type === 'done') {
          donePayload = ev as unknown as ChatSendResponse;
        }
      }
    }

    if (!donePayload) {
      throw new Error('流式响应未完成');
    }
    return donePayload;
  } finally {
    reader.releaseLock();
  }
}

// ── WeChat Work integration ───────────────────────────────────────────────────

export type WeChatWorkConfig = {
  configured: boolean;
  org_id?: string;
  corp_id?: string;
  agent_id?: string;
  secret?: string;
  token?: string;
  encoding_aes_key?: string;
  enabled?: boolean;
};

export type WeChatWorkBinding = {
  id: number;
  org_id: string;
  platform_user_id: string;
  wechat_userid: string;
  wechat_name: string | null;
  bound_at: string;
};

export async function getWeChatWorkConfig(orgId?: string): Promise<WeChatWorkConfig> {
  return req<WeChatWorkConfig>(`${base(resolveOrgId(orgId))}/integrations/wechat-work`);
}

export async function saveWeChatWorkConfig(
  payload: {
    corp_id: string;
    agent_id: string;
    secret: string;
    token: string;
    encoding_aes_key: string;
    enabled: boolean;
  },
  orgId?: string,
): Promise<{ ok: boolean }> {
  return req(`${base(resolveOrgId(orgId))}/integrations/wechat-work`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function testWeChatWorkConnection(orgId?: string): Promise<{ ok: boolean; token_prefix?: string }> {
  return req(`${base(resolveOrgId(orgId))}/integrations/wechat-work/test`, { method: 'POST' });
}

export async function listWeChatWorkBindings(orgId?: string): Promise<{ bindings: WeChatWorkBinding[] }> {
  return req(`${base(resolveOrgId(orgId))}/integrations/wechat-work/bindings`);
}

export async function bindWeChatWorkUser(
  payload: { platform_user_id: string; wechat_userid: string; wechat_name?: string },
  orgId?: string,
): Promise<{ ok: boolean; id: number }> {
  return req(`${base(resolveOrgId(orgId))}/integrations/wechat-work/bindings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function unbindWeChatWorkUser(bindingId: number, orgId?: string): Promise<{ ok: boolean }> {
  return req(`${base(resolveOrgId(orgId))}/integrations/wechat-work/bindings/${bindingId}`, {
    method: 'DELETE',
  });
}

// ── Agent Skills ─────────────────────────────────────────────────────────────

export async function listAgentSkills(orgId = resolveOrgId()): Promise<AgentSkillSummary[]> {
  const data = await req<{ skills: AgentSkillSummary[] }>(`${base(orgId)}/skills`);
  return data.skills;
}

export async function getAgentSkill(skillName: string, orgId = resolveOrgId()): Promise<AgentSkillDetail> {
  return req(`${base(orgId)}/skills/${encodeURIComponent(skillName)}`);
}

export async function createAgentSkill(
  payload: AgentSkillCreate,
  orgId = resolveOrgId(),
): Promise<AgentSkillDetail> {
  return req(`${base(orgId)}/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ── Org Playbook ───────────────────────────────────────────────────────────────

export async function getOrgPlaybook(orgId = resolveOrgId()): Promise<OrgPlaybook> {
  return req(`${base(orgId)}/playbook`);
}

export async function saveOrgPlaybook(content: string, orgId = resolveOrgId()): Promise<OrgPlaybook> {
  return req(`${base(orgId)}/playbook`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

export async function resetOrgPlaybook(orgId = resolveOrgId()): Promise<OrgPlaybook> {
  return req(`${base(orgId)}/playbook`, { method: 'DELETE' });
}

export async function previewOrgPlaybook(
  content: string,
  orgId = resolveOrgId(),
): Promise<OrgPlaybookPreview> {
  return req(`${base(orgId)}/playbook/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
}

// ── Usage stats ────────────────────────────────────────────────────────────────

export async function getLlmUsageStats(
  days = 30,
  orgId = resolveOrgId(),
): Promise<LlmUsageStats> {
  const params = new URLSearchParams({ days: String(days) });
  return req(`${base(orgId)}/usage/stats?${params}`);
}

// ── Audit log ──────────────────────────────────────────────────────────────────

export async function getAuditEvents(
  options: {
    days?: number;
    category?: string;
    limit?: number;
    offset?: number;
    orgId?: string;
  } = {},
): Promise<AuditEventsResponse> {
  const orgId = resolveOrgId(options.orgId);
  const params = new URLSearchParams();
  if (options.days != null) params.set('days', String(options.days));
  if (options.category) params.set('category', options.category);
  if (options.limit != null) params.set('limit', String(options.limit));
  if (options.offset != null) params.set('offset', String(options.offset));
  const qs = params.toString();
  return req(`${base(orgId)}/audit/events${qs ? `?${qs}` : ''}`);
}

// ── Model settings ─────────────────────────────────────────────────────────────

export async function getModelSettings(orgId = resolveOrgId()): Promise<ModelSettingsCatalog> {
  return req(`${base(orgId)}/settings/models`);
}

export async function saveModelPreferences(
  payload: Partial<ModelSettingsCatalog['preferences']>,
  orgId = resolveOrgId(),
): Promise<ModelSettingsCatalog> {
  return req(`${base(orgId)}/settings/models`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function addCustomModel(
  payload: CustomModelCreate,
  orgId = resolveOrgId(),
): Promise<ModelSettingsCatalog> {
  return req(`${base(orgId)}/settings/models/custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteCustomModel(profileId: string, orgId = resolveOrgId()): Promise<ModelSettingsCatalog> {
  return req(`${base(orgId)}/settings/models/custom/${encodeURIComponent(profileId)}`, {
    method: 'DELETE',
  });
}
