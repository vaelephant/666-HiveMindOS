'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Network,
  LineChart as LineChartIcon,
  Settings,
  Plus,
  Search,
  Bell,
  HelpCircle,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { MonitorPageTransition } from '@/app/(ipfsmonitor)/components/layout/MonitorPageTransition';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import { ModeToggle } from '@/components/mode-toggle';

const MONITOR_NAV = [
  { path: '', id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: 'nodes', id: 'nodes', icon: Network, label: 'Nodes' },
  { path: 'analytics', id: 'analytics', icon: LineChartIcon, label: 'Analytics' },
  { path: 'settings', id: 'settings', icon: Settings, label: 'Settings' },
] as const;

function monitorHref(base: string, path: string) {
  return path ? `${base}/${path}` : base;
}

function navItemActive(pathname: string, base: string, id: string, path: string): boolean {
  const href = monitorHref(base, path);
  if (id === 'dashboard') {
    return pathname === base || pathname === `${base}/`;
  }
  if (id === 'nodes') {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href;
}

function Sidebar({ base }: { base: string }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-outline-variant bg-surface-bright py-6">
      <div className="mb-10 px-6">
        <div className="mb-1 flex items-center gap-2">
          <Network className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold tracking-tight text-primary">Infrastructure</span>
        </div>
        <p className="text-[length:10px] font-semibold uppercase tracking-widest text-on-surface-variant/70">
          v2.4.0-stable
        </p>
      </div>

      <nav className="flex-1 space-y-1">
        {MONITOR_NAV.map((item) => {
          const href = monitorHref(base, item.path);
          const active = navItemActive(pathname, base, item.id, item.path);
          return (
            <Link
              key={item.id}
              href={href}
              className={`relative flex w-full items-center gap-4 px-6 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                active
                  ? 'text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {active ? (
                <motion.div layoutId="activeTab" className="absolute bottom-0 right-0 top-0 w-1 bg-primary" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-4 text-[length:10px] font-bold uppercase tracking-widest text-white shadow-sm transition-all hover:bg-opacity-90 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Add Node
        </button>
      </div>
    </aside>
  );
}

function AppHeader({ base, embedded }: { base: string; embedded: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-auto min-h-16 flex-wrap items-center justify-between gap-4 border-b border-outline-variant bg-surface-bright/80 px-6 py-3 backdrop-blur-md sm:px-8">
      <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center md:gap-8">
        <h1 className="shrink-0 text-xl font-bold text-primary">IPFS Monitor</h1>
        {embedded ? (
          <nav
            className="flex flex-wrap items-center gap-1 border-outline-variant md:border-l md:pl-6"
            aria-label="IPFS 监控"
          >
            {MONITOR_NAV.map((item) => {
              const href = monitorHref(base, item.path);
              const active = navItemActive(pathname, base, item.id, item.path);
              return (
                <Link
                  key={item.id}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                    active
                      ? 'bg-surface-container text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-low hover:text-primary'
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : null}
        <div className="group relative hidden w-72 max-w-full sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Search CIDs or Nodes..."
            className="w-full rounded-lg border-none bg-surface-container-low py-2 pl-10 pr-4 text-sm transition-all focus:ring-2 focus:ring-primary-container"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <ModeToggle />
        <button
          type="button"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <Bell className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
        >
          <HelpCircle className="h-5 w-5" />
        </button>
        <div className="mx-2 h-8 w-px bg-outline-variant" />
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs font-bold text-primary">Admin User</p>
            <p className="text-[length:10px] text-on-surface-variant">Infrastructure Lead</p>
          </div>
          <div className="relative h-8 w-8 overflow-hidden rounded-full border border-outline-variant bg-primary-container shadow-inner">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTKzVICqTu7F0or_WuvUdHLNLCrtMQ1KU3WcBeBW5GLFzDoRjyUDinM-1wi4L6Uo5YSgyU5Pvh-N3jDmvJUuKgdHHpolKP2Av4_5gzjsto9sps1NCkwft-eV95EwO31ZE5DuNPn1ycnuu9FUwL8K4UMcjUVYscDdU1GLSaCG0ysBxDn4fDEggiuTwLYhgg2aR_X4yWsTQ-zthpjLicEASF4e6UaUiW3QOBRTAe21sl6edh-47qp12HCPZqfDNORZK-4j9FTHUx4xNJ"
              alt="Avatar"
              width={32}
              height={32}
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export type MonitorShellProps = {
  children: ReactNode;
  /** 内嵌在平台主导航内时不展示监控左侧栏，子导航并入顶栏 */
  embedded?: boolean;
  /** 默认与平台路由前缀一致 */
  basePath?: string;
};

export function MonitorShell({
  children,
  embedded = false,
  basePath = IPFS_MONITOR_BASE_PATH,
}: MonitorShellProps) {
  return (
    <div
      className={`ipfs-monitor-scope flex bg-background selection:bg-primary-container selection:text-white ${
        embedded ? 'min-h-0 min-w-0 flex-1 flex-col' : 'min-h-screen'
      }`}
    >
      {embedded ? null : <Sidebar base={basePath} />}
      <main className={`flex min-w-0 flex-1 flex-col ${embedded ? '' : 'ml-64'}`}>
        <AppHeader base={basePath} embedded={embedded} />
        <MonitorPageTransition>{children}</MonitorPageTransition>
      </main>
    </div>
  );
}
