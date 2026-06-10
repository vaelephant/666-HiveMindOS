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
    setClientOrgId(orgId);
    setClientUserId(status === 'authenticated' ? session.user.id : null);
  }, [orgId, session, status]);

  return <OrgContext.Provider value={orgId}>{children}</OrgContext.Provider>;
}

export function useOrgId(): string {
  return useContext(OrgContext);
}
