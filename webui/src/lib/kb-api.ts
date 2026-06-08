import type {
  AgentTask,
  ChatSendResponse,
  ChatSession,
  ChatSessionSummary,
  EntityDetail,
  GraphSnapshot,
  IngestResult,
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

export async function createTask(input: string, orgId = DEFAULT_ORG): Promise<AgentTask> {
  return req(`${base(orgId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
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

export async function getOverviewData(orgId = DEFAULT_ORG): Promise<OverviewData> {
  return req(`${base(orgId)}/overview`);
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

export async function deleteChatSession(sessionId: string, orgId = DEFAULT_ORG): Promise<void> {
  await req(`${base(orgId)}/chat/sessions/${sessionId}`, { method: 'DELETE' });
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
