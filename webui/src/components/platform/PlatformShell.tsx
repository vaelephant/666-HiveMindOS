'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  UserCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ANNOTATION_CHILDREN,
  IPFS_MONITOR_CHILDREN,
  KB_BASE_PATH,
  KNOWLEDGE_BASE_CHILDREN,
  PLATFORM_HOME_PATH,
  PRIMARY_NAV,
  TOP_NAV,
  isIpfsMonitorChildActive,
  type PrimaryNavItem,
} from '@/config/navigation';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import { ModeToggle } from '@/components/mode-toggle';

const NAV_EXPANDED_PX = 260;
const NAV_COLLAPSED_PX = 64;

function navItemActive(href: string, pathname: string): boolean {
  if (href === PLATFORM_HOME_PATH) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isAnnotationItem(item: PrimaryNavItem): item is Extract<PrimaryNavItem, { navKey: 'annotation' }> {
  return item.navKey === 'annotation';
}

function isIpfsMonitorItem(item: PrimaryNavItem): item is Extract<PrimaryNavItem, { navKey: 'ipfs_monitor' }> {
  return item.navKey === 'ipfs_monitor';
}

function isKnowledgeBaseItem(item: PrimaryNavItem): item is Extract<PrimaryNavItem, { navKey: 'knowledge_base' }> {
  return item.navKey === 'knowledge_base';
}

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(() => pathname.startsWith('/annotation'));
  const [ipfsMonitorOpen, setIpfsMonitorOpen] = useState(() => pathname.startsWith(IPFS_MONITOR_BASE_PATH));
  const [knowledgeBaseOpen, setKnowledgeBaseOpen] = useState(() => pathname.startsWith(KB_BASE_PATH));

  useEffect(() => {
    if (pathname.startsWith('/annotation')) setAnnotationOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith(IPFS_MONITOR_BASE_PATH)) setIpfsMonitorOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith(KB_BASE_PATH)) setKnowledgeBaseOpen(true);
  }, [pathname]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-shell-bg font-sans text-slate-100">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: navCollapsed ? NAV_COLLAPSED_PX : NAV_EXPANDED_PX }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        className="flex shrink-0 flex-col overflow-hidden border-r border-shell-border bg-shell-sidebar"
        aria-label="主导航"
      >
        {/* Logo */}
        <div className={`shrink-0 border-b border-shell-border-dim ${navCollapsed ? 'px-2 py-4' : 'px-4 py-4'}`}>
          <div className={`flex gap-2 ${navCollapsed ? 'flex-col items-center' : 'items-center justify-between'}`}>
            {!navCollapsed && (
              <div className="flex min-w-0 items-center gap-2.5">
                {/* Hive hexagon mark */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-primary shadow-lg shadow-brand-primary/20">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-brand-on-primary">
                    <path d="M12 2L4 6.5V14l8 4.5L20 14V6.5L12 2zm0 2.3l6 3.37v6.66L12 17.7 6 14.33V7.67L12 4.3z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-[13px] font-bold tracking-tight text-slate-100">HiveMindOS</h1>
                  <p className="text-[9px] font-semibold uppercase tracking-widest text-brand-bright/70">
                    Enterprise AI OS
                  </p>
                </div>
              </div>
            )}
            {navCollapsed && (
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary shadow-lg shadow-brand-primary/20">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-brand-on-primary">
                  <path d="M12 2L4 6.5V14l8 4.5L20 14V6.5L12 2zm0 2.3l6 3.37v6.66L12 17.7 6 14.33V7.67L12 4.3z" />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={() => setNavCollapsed((c) => !c)}
              className="shrink-0 rounded-md p-1 text-shell-muted transition-colors hover:bg-shell-panel/5 hover:text-shell-subtext"
              aria-label={navCollapsed ? '展开导航' : '收起导航'}
              aria-expanded={!navCollapsed}
            >
              {navCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Nav items */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-2 py-3">
          {PRIMARY_NAV.flatMap((item, idx) => {
            const prev = PRIMARY_NAV[idx - 1];
            const prefix: React.ReactNode[] = [];

            // Section label above first HiveMind item
            if (!navCollapsed && item.factory === 'hivemind' && prev?.factory !== 'hivemind') {
              prefix.push(
                <p key={`label-hivemind`} className="mb-1 mt-1 px-3 text-[9px] font-semibold uppercase tracking-widest text-brand-bright/40">
                  HiveMind
                </p>
              );
            }
            // Divider between factory groups
            if (prev && prev.factory !== item.factory) {
              prefix.push(
                <div key={`div-${item.navKey}`} className="my-2 border-t border-shell-border-dim" />
              );
            }

            let el: React.ReactNode;

            if (isAnnotationItem(item)) {
              const annotationActive = pathname.startsWith('/annotation');
              el = navCollapsed ? (
                <Link
                  key={item.navKey}
                  href="/annotation/overview"
                  title={item.label}
                  className={`flex w-full items-center justify-center rounded-lg py-2.5 text-[13px] font-medium transition-all ${annotationActive ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button type="button" onClick={() => setAnnotationOpen((o) => !o)}
                    className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${annotationActive ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}
                  >
                    <item.icon className="mr-3 h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-shell-subtext transition-transform ${annotationOpen ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {annotationOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="ml-2 space-y-0.5 border-l border-shell-border py-0.5 pl-2">
                          {ANNOTATION_CHILDREN.map((child) => {
                            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
                            return (
                              <Link key={child.navKey} href={child.href} className={`flex items-center rounded-md px-2 py-2 text-[12px] font-medium transition-colors ${active ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            } else if (isIpfsMonitorItem(item)) {
              const ipfsActive = pathname.startsWith(IPFS_MONITOR_BASE_PATH);
              el = navCollapsed ? (
                <Link key={item.navKey} href={IPFS_MONITOR_BASE_PATH} title={item.label}
                  className={`flex w-full items-center justify-center rounded-lg py-2.5 text-[13px] font-medium transition-all ${ipfsActive ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button type="button" onClick={() => setIpfsMonitorOpen((o) => !o)}
                    className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${ipfsActive ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}
                  >
                    <item.icon className="mr-3 h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-shell-subtext transition-transform ${ipfsMonitorOpen ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {ipfsMonitorOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="ml-2 space-y-0.5 border-l border-shell-border py-0.5 pl-2">
                          {IPFS_MONITOR_CHILDREN.map((child) => {
                            const active = isIpfsMonitorChildActive(child, pathname);
                            return (
                              <Link key={child.navKey} href={child.href} className={`flex items-center rounded-md px-2 py-2 text-[12px] font-medium transition-colors ${active ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            } else if (isKnowledgeBaseItem(item)) {
              const kbActive = pathname.startsWith(KB_BASE_PATH);
              el = navCollapsed ? (
                <Link key={item.navKey} href={`${KB_BASE_PATH}/overview`} title={item.label}
                  className={`flex w-full items-center justify-center rounded-lg py-2.5 text-[13px] font-medium transition-all ${kbActive ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button type="button" onClick={() => setKnowledgeBaseOpen((o) => !o)}
                    className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${kbActive ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}
                  >
                    <item.icon className="mr-3 h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-shell-subtext transition-transform ${knowledgeBaseOpen ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {knowledgeBaseOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="ml-2 space-y-0.5 border-l border-shell-border py-0.5 pl-2">
                          {KNOWLEDGE_BASE_CHILDREN.map((child) => {
                            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
                            return (
                              <Link key={child.navKey} href={child.href} className={`flex items-center rounded-md px-2 py-2 text-[12px] font-medium transition-colors ${active ? 'bg-brand-primary/10 text-brand-bright' : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'}`}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-70" />
                                <span className="truncate">{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            } else {
              const active = navItemActive(item.href, pathname);
              el = (
                <Link
                  key={item.navKey}
                  href={item.href}
                  title={item.label}
                  className={`flex w-full items-center rounded-lg py-2.5 text-[13px] font-medium transition-all duration-150 ${
                    navCollapsed ? 'justify-center px-0' : 'space-x-3 px-3'
                  } ${
                    active
                      ? navCollapsed
                        ? 'bg-brand-primary/10 text-brand-bright'
                        : 'border-l-2 border-brand-primary bg-brand-primary/10 pl-[10px] text-brand-bright'
                      : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!navCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            }

            return [...prefix, el];
          })}
        </nav>

        {/* User */}
        <div className="mt-auto border-t border-shell-border-dim px-2 py-3">
          <div className={`flex items-center ${navCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-bright">
              <UserCircle className="h-5 w-5" />
            </div>
            {!navCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-shell-subtext">演示用户</p>
                <p className="truncate text-[10px] text-shell-subtext">HiveMindOS · Dev</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-shell-border bg-shell-sidebar/80 px-4 backdrop-blur-sm md:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-6">
            <nav className="hidden gap-1 md:flex" aria-label="顶栏能力入口">
              {TOP_NAV.map((tab) => {
                const active =
                  tab.href === PLATFORM_HOME_PATH
                    ? pathname === PLATFORM_HOME_PATH
                    : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
                return (
                  <Link
                    key={tab.navKey}
                    href={tab.href}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-brand-primary text-brand-on-primary'
                        : 'text-shell-muted hover:bg-shell-panel/5 hover:text-shell-subtext'
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <div className="relative hidden max-w-sm flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-subtext" />
              <input
                className="w-full rounded-lg border border-white/8 bg-shell-panel/5 py-1.5 pl-9 pr-3 text-xs text-shell-subtext outline-none transition-all placeholder:text-shell-subtext focus:border-brand-primary/40 focus:bg-shell-panel/8 focus:ring-1 focus:ring-brand-primary/20"
                placeholder="搜索知识、Agent、工作流…"
                type="search"
                aria-label="全局搜索"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <button
              type="button"
              className="relative rounded-lg p-2 text-shell-subtext transition-colors hover:bg-shell-panel/5 hover:text-shell-subtext"
              aria-label="通知"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-bright ring-2 ring-shell-sidebar" />
            </button>
            <Link
              href="/dashboard"
              className="hidden rounded-lg border border-white/8 px-2.5 py-1.5 text-[11px] font-medium text-shell-muted transition-colors hover:bg-shell-panel/5 hover:text-shell-subtext sm:inline"
            >
              WareMind 演示
            </Link>
          </div>
        </header>

        <main className="relative min-h-0 flex-1 overflow-auto bg-shell-bg">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex min-h-0 w-full flex-1 flex-col"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
