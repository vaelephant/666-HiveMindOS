import 'server-only';

import { auth } from '@/auth';

export function kbBackendBase(): string {
  return process.env.KB_API_BASE_URL ?? 'http://localhost:8006';
}

/** 当前登录用户 ID，作为后端 user_id（Chat / 记忆 / 候选池隔离） */
export async function getSessionUserId(): Promise<string> {
  const session = await auth();
  return session?.user?.id ?? 'demo';
}

export async function kbBackendUrl(
  orgId: string,
  subpath: string,
  options?: {
    searchParams?: URLSearchParams;
    withUserId?: boolean;
  },
): Promise<string> {
  const path = subpath.startsWith('/') ? subpath : `/${subpath}`;
  const url = new URL(`${kbBackendBase()}/api/v1/orgs/${encodeURIComponent(orgId)}${path}`);
  options?.searchParams?.forEach((value, key) => {
    url.searchParams.set(key, value);
  });
  if (options?.withUserId !== false) {
    url.searchParams.set('user_id', await getSessionUserId());
  }
  return url.toString();
}

/** 为 JSON POST 请求体注入 user_id（若调用方未指定） */
export async function mergeUserIntoJsonBody(bodyText: string): Promise<string> {
  const userId = await getSessionUserId();
  if (!bodyText.trim()) {
    return JSON.stringify({ user_id: userId });
  }
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>;
    if (parsed.user_id == null || parsed.user_id === '') {
      parsed.user_id = userId;
    }
    return JSON.stringify(parsed);
  } catch {
    return bodyText;
  }
}
