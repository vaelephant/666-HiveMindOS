import type {
  AgentExperience,
  AgentTask,
  AutomationJob,
  AutomationJobUpdate,
  AutomationRun,
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
  QueryResult,
  SourceRecord,
  WikiCategory,
  WikiPage,
  WikiPageDetail,
  WikiPageResponse,
} from '@/lib/kb-types';

export const DEFAULT_ORG = process.env.NEXT_PUBLIC_KB_DEFAULT_ORG ?? 'demo';

const base = (orgId: string) => `/api/kb/${orgId}`;

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function uploadSource(file: File, orgId = DEFAULT_ORG): Promise<SourceRecord> {
  const form = new FormData();
  form.append('file', file);
  return req(`${base(orgId)}/sources`, { method: 'POST', body: form });
}

export async function listSources(orgId = DEFAULT_ORG): Promise<SourceRecord[]> {
  const data = await req<{ sources: SourceRecord[] }>(`${base(orgId)}/sources`);
  return data.sources;
}

export async function compileSource(sourceId: string, orgId = DEFAULT_ORG): Promise<SourceRecord> {
  return req(`${base(orgId)}/sources/${sourceId}/compile`, { method: 'POST' });
}

export async function deleteSource(sourceId: string, orgId = DEFAULT_ORG): Promise<void> {
  await req(`${base(orgId)}/sources/${sourceId}`, { method: 'DELETE' });
}

export async function ingestFile(file: File, orgId = DEFAULT_ORG): Promise<IngestResult> {
  const form = new FormData();
  form.append('file', file);
  return req(`${base(orgId)}/ingest`, { method: 'POST', body: form });
}

export async function queryKnowledge(question: string, orgId = DEFAULT_ORG): Promise<QueryResult> {
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
  const orgId = options?.orgId ?? DEFAULT_ORG;
  return req(`${base(orgId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input,
      ...(options?.constraints ? { constraints: options.constraints } : {}),
    }),
  });
}

export async function listTasks(orgId = DEFAULT_ORG): Promise<AgentTask[]> {
  const data = await req<{ tasks: AgentTask[] }>(`${base(orgId)}/tasks`);
  return data.tasks;
}

export async function getTask(taskId: string, orgId = DEFAULT_ORG): Promise<AgentTask> {
  return req(`${base(orgId)}/tasks/${taskId}`);
}

export async function deleteTask(taskId: string, orgId = DEFAULT_ORG): Promise<void> {
  await req(`${base(orgId)}/tasks/${taskId}`, { method: 'DELETE' });
}

export async function approveTask(
  taskId: string,
  fromTask?: string,
  orgId = DEFAULT_ORG,
): Promise<AgentTask> {
  return req(`${base(orgId)}/tasks/${taskId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from_task: fromTask ?? null }),
  });
}

export async function cancelTask(taskId: string, orgId = DEFAULT_ORG): Promise<void> {
  await req(`${base(orgId)}/tasks/${taskId}/cancel`, { method: 'POST' });
}

export async function listExperiences(
  orgId = DEFAULT_ORG,
  taskType?: string,
  limit = 5,
): Promise<AgentExperience[]> {
  const url = new URL(`${base(orgId)}/experiences`, window.location.origin);
  if (taskType) url.searchParams.set('task_type', taskType);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ experiences: AgentExperience[] }>(url.pathname + url.search);
  return data.experiences;
}

export async function listAutomations(orgId = DEFAULT_ORG): Promise<AutomationJob[]> {
  const data = await req<{ jobs: AutomationJob[] }>(`${base(orgId)}/automations`);
  return data.jobs;
}

export async function listAutomationRuns(
  jobId?: string,
  orgId = DEFAULT_ORG,
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
  params?: Record<string, number>,
  orgId = DEFAULT_ORG,
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
  orgId = DEFAULT_ORG,
): Promise<AutomationJob> {
  const data = await req<{ job: AutomationJob }>(`${base(orgId)}/automations/${jobId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return data.job;
}

export async function deleteAutomation(jobId: string, orgId = DEFAULT_ORG): Promise<void> {
  await req(`${base(orgId)}/automations/${jobId}`, { method: 'DELETE' });
}

export async function reseedAutomations(orgId = DEFAULT_ORG): Promise<AutomationJob[]> {
  const data = await req<{ restored: AutomationJob[]; count: number }>(
    `${base(orgId)}/automations/reseed`,
    { method: 'POST' },
  );
  return data.restored;
}

export async function restoreAutomation(jobId: string, orgId = DEFAULT_ORG): Promise<AutomationJob> {
  const data = await req<{ job: AutomationJob }>(`${base(orgId)}/automations/${jobId}/restore`, {
    method: 'POST',
  });
  return data.job;
}

export async function deleteAutomationRun(runId: string, orgId = DEFAULT_ORG): Promise<void> {
  await req(`${base(orgId)}/automations/runs/${runId}`, { method: 'DELETE' });
}

export async function getOverviewData(orgId = DEFAULT_ORG): Promise<OverviewData> {
  return req(`${base(orgId)}/overview`);
}

export async function listCandidates(
  status?: string,
  orgId = DEFAULT_ORG,
  limit = 100,
): Promise<KnowledgeCandidate[]> {
  const url = new URL(`${base(orgId)}/candidates`, window.location.origin);
  if (status) url.searchParams.set('status', status);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ candidates: KnowledgeCandidate[] }>(url.toString());
  return data.candidates;
}

export async function getCandidateStats(orgId = DEFAULT_ORG): Promise<CandidateStats> {
  const data = await req<{ stats: CandidateStats }>(`${base(orgId)}/candidates/stats`);
  return data.stats;
}

export async function resolveCandidates(
  limit = 20,
  orgId = DEFAULT_ORG,
): Promise<{ resolved: unknown[]; count: number }> {
  return req(`${base(orgId)}/candidates/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit }),
  });
}

export async function compileCandidates(
  limit = 20,
  orgId = DEFAULT_ORG,
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
  orgId = DEFAULT_ORG,
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
  orgId = DEFAULT_ORG,
): Promise<void> {
  await req(`${base(orgId)}/candidates/${candidateId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function migrateWiki(orgId = DEFAULT_ORG, force = false): Promise<{ migrated: number; skipped: number; total: number }> {
  const url = new URL(`${base(orgId)}/wiki/migrate`, window.location.origin);
  if (force) url.searchParams.set('force', 'true');
  return req(url.toString(), { method: 'POST' });
}

export function sourceFileUrl(sourceId: string, orgId = DEFAULT_ORG): string {
  return `${base(orgId)}/sources/${sourceId}/file`;
}

export async function listWikiCategories(orgId = DEFAULT_ORG): Promise<WikiCategory[]> {
  const data = await req<{ categories: WikiCategory[] }>(`${base(orgId)}/wiki/categories`);
  return data.categories;
}

export async function listWikiPages(orgId = DEFAULT_ORG, category?: string): Promise<WikiPage[]> {
  const url = new URL(`${base(orgId)}/wiki`, window.location.origin);
  if (category) url.searchParams.set('category', category);
  const data = await req<{ pages: WikiPage[] }>(url.toString());
  return data.pages;
}

export async function getWikiPage(
  path: string,
  orgId = DEFAULT_ORG,
  detail = false,
): Promise<WikiPageResponse> {
  const url = new URL(`${base(orgId)}/wiki/${path}`, window.location.origin);
  if (detail) url.searchParams.set('detail', 'true');
  return req(url.toString());
}

export async function listEntities(
  orgId = DEFAULT_ORG,
  entityType?: string,
) {
  const url = new URL(`${base(orgId)}/graph/entities`, window.location.origin);
  if (entityType) url.searchParams.set('entity_type', entityType);
  const data = await req<{ entities: EntityDetail['entity'][] }>(url.toString());
  return data.entities;
}

export async function getEntityDetail(
  name: string,
  orgId = DEFAULT_ORG,
): Promise<EntityDetail> {
  return req(`${base(orgId)}/graph/entity/${encodeURIComponent(name)}`);
}

export async function getGraphSnapshot(orgId = DEFAULT_ORG): Promise<GraphSnapshot> {
  return req(`${base(orgId)}/graph/snapshot`);
}

export async function listChatSessions(orgId = DEFAULT_ORG): Promise<ChatSessionSummary[]> {
  const data = await req<{ sessions: ChatSessionSummary[] }>(`${base(orgId)}/chat/sessions`);
  return data.sessions;
}

export async function getChatSession(sessionId: string, orgId = DEFAULT_ORG): Promise<ChatSession> {
  return req(`${base(orgId)}/chat/sessions/${sessionId}`);
}

export async function getSessionPipeline(
  sessionId: string,
  orgId = DEFAULT_ORG,
): Promise<SessionPipeline> {
  const data = await req<{ pipeline: SessionPipeline }>(
    `${base(orgId)}/chat/sessions/${sessionId}/pipeline`,
  );
  return data.pipeline;
}

export async function deleteChatSession(
  sessionId: string,
  options?: { recap?: boolean },
  orgId = DEFAULT_ORG,
): Promise<DeleteSessionResponse> {
  const url = new URL(`${base(orgId)}/chat/sessions/${sessionId}`, window.location.origin);
  if (options?.recap) url.searchParams.set('recap', 'true');
  return req(url.toString(), { method: 'DELETE' });
}

export async function listMemories(orgId = DEFAULT_ORG): Promise<MemoryRecord[]> {
  const data = await req<{ memories: MemoryRecord[] }>(`${base(orgId)}/memories`);
  return data.memories;
}

export async function listMemoryEvents(
  orgId = DEFAULT_ORG,
  limit = 50,
): Promise<MemoryEventRecord[]> {
  const url = new URL(`${base(orgId)}/memories/events`, window.location.origin);
  url.searchParams.set('limit', String(limit));
  const data = await req<{ events: MemoryEventRecord[] }>(url.toString());
  return data.events;
}

export async function getMemoryStats(orgId = DEFAULT_ORG): Promise<MemoryStats> {
  const data = await req<{ stats: MemoryStats }>(`${base(orgId)}/memories/stats`);
  return data.stats;
}

export async function syncMemoryVectors(orgId = DEFAULT_ORG): Promise<{
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
  orgId = DEFAULT_ORG,
): Promise<ChatSendResponse> {
  return req(`${base(orgId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId ?? undefined }),
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
  orgId = DEFAULT_ORG,
  signal?: AbortSignal,
): Promise<ChatSendResponse> {
  const res = await fetch(`${base(orgId)}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId ?? undefined }),
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
