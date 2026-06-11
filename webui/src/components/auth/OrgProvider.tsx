'use client';

import { useSession } from 'next-auth/react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { DEFAULT_ORG, setClientOrgId, setClientUserId } from '@/lib/kb-api';

const OrgContext = createContext<string>(DEFAULT_ORG);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const orgId = useMemo(
    () => (status === 'authenticated' ? session.user.orgId : DEFAULT_ORG),
    [session, status],
  );

  useEffect(() => {
    // session 加载完成前不要写入 org，避免页面用 demo org 请求后不再刷新
    if (status === 'loading') {
      setClientOrgId(null);
      setClientUserId(null);
      return;
    }
    setClientOrgId(orgId);
    setClientUserId(status === 'authenticated' ? session.user.id : null);
  }, [orgId, session, status]);

  return <OrgContext.Provider value={orgId}>{children}</OrgContext.Provider>;
}

export function useOrgId(): string {
  return useContext(OrgContext);
}

/** session 就绪后再拉取 org 隔离数据（避免未登录或 loading 时用 demo org 请求） */
export function useOrgReady(): { ready: boolean; orgId: string } {
  const { status } = useSession();
  const orgId = useOrgId();
  return { ready: status === 'authenticated', orgId };
}
