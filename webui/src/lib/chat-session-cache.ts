import { resolveOrgId } from '@/lib/kb-api';
import type { ChatSessionSummary } from '@/lib/kb-types';

const KEY = (orgId: string) => `hivemind-chat-sessions:${orgId}`;

export function readCachedSessions(orgId = resolveOrgId()): ChatSessionSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(KEY(orgId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSessionSummary[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedSessions(sessions: ChatSessionSummary[], orgId = resolveOrgId()): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(KEY(orgId), JSON.stringify(sessions));
  } catch {
    // quota exceeded — ignore
  }
}
