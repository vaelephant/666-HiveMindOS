import PlatformShell from '@/components/platform/PlatformShell';
import { OrgProvider } from '@/components/auth/OrgProvider';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrgProvider>
      <PlatformShell>{children}</PlatformShell>
    </OrgProvider>
  );
}
