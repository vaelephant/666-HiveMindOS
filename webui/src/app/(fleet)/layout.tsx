import FleetShell from '@/components/FleetShell';
import { OrgProvider } from '@/components/auth/OrgProvider';

export default function FleetLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <FleetShell>{children}</FleetShell>
    </OrgProvider>
  );
}
