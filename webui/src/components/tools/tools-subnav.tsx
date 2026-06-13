'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/tools', label: 'Agent Skills', match: (p: string) => p === '/tools' || p.startsWith('/tools/skills/') },
  { href: '/tools/registry', label: '工具注册表 / MCP', match: (p: string) => p.startsWith('/tools/registry') },
] as const;

export function ToolsSubnav() {
  const pathname = usePathname();

  return (
    <nav className="mb-4 flex flex-wrap gap-2 border-b border-shell-border pb-3 pt-6 md:pt-8">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
              active
                ? 'bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/20'
                : 'border border-shell-border bg-shell-panel text-shell-muted hover:text-shell-text',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
