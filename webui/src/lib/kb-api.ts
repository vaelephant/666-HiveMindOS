import type {
  EntityDetail,
  IngestResult,
  QueryResult,
  SourceRecord,
  WikiPage,
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

export async function listWikiPages(orgId = DEFAULT_ORG, category?: string): Promise<WikiPage[]> {
  const url = new URL(`${base(orgId)}/wiki`, window.location.origin);
  if (category) url.searchParams.set('category', category);
  const data = await req<{ pages: WikiPage[] }>(url.toString());
  return data.pages;
}

export async function getWikiPage(
  path: string,
  orgId = DEFAULT_ORG,
): Promise<{ path: string; content: string }> {
  return req(`${base(orgId)}/wiki/${path}`);
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
