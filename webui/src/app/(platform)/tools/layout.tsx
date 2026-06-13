import { ToolsSubnav } from '@/components/tools/tools-subnav';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col px-6 md:px-8 lg:px-10">
      <ToolsSubnav />
      {children}
    </div>
  );
}
