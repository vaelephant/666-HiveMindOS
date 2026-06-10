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
  TASK_CENTER_BASE_PATH,
  TASK_CENTER_CHILDREN,
  TOP_NAV,
  isIpfsMonitorChildActive,
  type PrimaryNavItem,
} from '@/config/navigation';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import { ModeToggle } from '@/components/mode-toggle';
import { UserMenu } from '@/components/auth/UserMenu';

const NAV_EXPANDED_PX = 260;
const NAV_COLLAPSED_PX = 64;

function HiveLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2L4 6.5V14l8 4.5L20 14V6.5L12 2zm0 2.3l6 3.37v6.66L12 17.7 6 14.33V7.67L12 4.3z" />
    </svg>
  );
}

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

function isTaskCenterItem(item: PrimaryNavItem): item is Extract<PrimaryNavItem, { navKey: 'task_center' }> {
  return item.navKey === 'task_center';
}

export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [annotationOpen, setAnnotationOpen] = useState(() => pathname.startsWith('/annotation'));
  const [ipfsMonitorOpen, setIpfsMonitorOpen] = useState(() => pathname.startsWith(IPFS_MONITOR_BASE_PATH));
  const [knowledgeBaseOpen, setKnowledgeBaseOpen] = useState(() => pathname.startsWith(KB_BASE_PATH));
  const [taskCenterOpen, setTaskCenterOpen] = useState(
    () =>
      pathname.startsWith(TASK_CENTER_BASE_PATH) ||
      pathname.startsWith('/agent-tasks') ||
      pathname.startsWith('/automations'),
  );

  useEffect(() => {
    if (pathname.startsWith('/annotation')) setAnnotationOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith(IPFS_MONITOR_BASE_PATH)) setIpfsMonitorOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith(KB_BASE_PATH)) setKnowledgeBaseOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (
      pathname.startsWith(TASK_CENTER_BASE_PATH) ||
      pathname.startsWith('/agent-tasks') ||
      pathname.startsWith('/automations')
    ) {
      setTaskCenterOpen(true);
    }
  }, [pathname]);

  const navLinkClass = (active: boolean, collapsed: boolean) =>
    [
      'group relative flex w-full items-center rounded-xl text-[13px] font-medium transition-all duration-200',
      collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5',
      active
        ? collapsed
          ? 'bg-brand-primary/12 text-brand-primary shadow-sm shadow-brand-primary/10'
          : 'bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/15'
        : 'text-shell-muted hover:bg-shell-panel-hover hover:text-shell-text',
    ].join(' ');

  const subNavLinkClass = (active: boolean) =>
    [
      'flex items-center rounded-lg px-2.5 py-2 text-[12px] font-medium transition-all duration-200',
      active
        ? 'bg-brand-primary/10 text-brand-primary'
        : 'text-shell-muted hover:bg-shell-panel-hover hover:text-shell-text',
    ].join(' ');

  return (
    <div className="flex h-screen w-full overflow-hidden bg-shell-bg font-sans text-shell-text">
      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: navCollapsed ? NAV_COLLAPSED_PX : NAV_EXPANDED_PX }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        className="relative flex shrink-0 flex-col overflow-hidden border-r border-shell-border bg-shell-sidebar"
        aria-label="主导航"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand-primary/[0.06] to-transparent dark:from-brand-primary/10"
          aria-hidden
        />

        {/* Logo */}
        <div className={`relative shrink-0 ${navCollapsed ? 'px-2 py-4' : 'px-4 py-5'}`}>
          <div className={`flex gap-2 ${navCollapsed ? 'flex-col items-center' : 'items-center justify-between'}`}>
            {!navCollapsed && (
              <Link href={PLATFORM_HOME_PATH} className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-dim shadow-md shadow-brand-primary/25">
                  <HiveLogoMark className="h-[18px] w-[18px] text-brand-on-primary" />
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-bright ring-2 ring-shell-sidebar" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-[15px] font-semibold tracking-tight text-shell-text">
                    HiveMindOS
                  </h1>
                  <p className="text-[10px] font-medium tracking-wide text-brand-primary dark:text-brand-bright">
                    Enterprise AI OS
                  </p>
                </div>
              </Link>
            )}
            {navCollapsed && (
              <Link
                href={PLATFORM_HOME_PATH}
                title="HiveMindOS"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-brand-dim shadow-md shadow-brand-primary/25"
              >
                <HiveLogoMark className="h-[18px] w-[18px] text-brand-on-primary" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setNavCollapsed((c) => !c)}
              className="shrink-0 rounded-lg p-1.5 text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text"
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
        <nav className="custom-scrollbar relative flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {PRIMARY_NAV.flatMap((item, idx) => {
            const prev = PRIMARY_NAV[idx - 1];
            const prefix: React.ReactNode[] = [];

            // Section label above first HiveMind item
            if (!navCollapsed && item.factory === 'hivemind' && prev?.factory !== 'hivemind') {
              prefix.push(
                <p key="label-hivemind" className="mb-1.5 mt-3 px-3 text-[10px] font-medium text-shell-muted">
                  HiveMind
                </p>
              );
            }
            // Spacer between factory groups
            if (prev && prev.factory !== item.factory) {
              prefix.push(
                <div key={`div-${item.navKey}`} className="my-2.5 mx-3 border-t border-shell-border-dim" />
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
                  className={navLinkClass(annotationActive, true)}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setAnnotationOpen((o) => !o)}
                    className={navLinkClass(annotationActive, false)}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-shell-muted transition-transform ${annotationOpen ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {annotationOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="ml-3 space-y-0.5 border-l border-shell-border py-1 pl-2.5">
                          {ANNOTATION_CHILDREN.map((child) => {
                            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
                            return (
                              <Link key={child.navKey} href={child.href} className={subNavLinkClass(active)}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
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
                <Link key={item.navKey} href={IPFS_MONITOR_BASE_PATH} title={item.label} className={navLinkClass(ipfsActive, true)}>
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button type="button" onClick={() => setIpfsMonitorOpen((o) => !o)} className={navLinkClass(ipfsActive, false)}>
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-shell-muted transition-transform ${ipfsMonitorOpen ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {ipfsMonitorOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="ml-3 space-y-0.5 border-l border-shell-border py-1 pl-2.5">
                          {IPFS_MONITOR_CHILDREN.map((child) => {
                            const active = isIpfsMonitorChildActive(child, pathname);
                            return (
                              <Link key={child.navKey} href={child.href} className={subNavLinkClass(active)}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
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
                <Link key={item.navKey} href={`${KB_BASE_PATH}/overview`} title={item.label} className={navLinkClass(kbActive, true)}>
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button type="button" onClick={() => setKnowledgeBaseOpen((o) => !o)} className={navLinkClass(kbActive, false)}>
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-shell-muted transition-transform ${knowledgeBaseOpen ? 'rotate-0' : '-rotate-90'}`} />
                  </button>
                  <AnimatePresence initial={false}>
                    {knowledgeBaseOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="ml-3 space-y-0.5 border-l border-shell-border py-1 pl-2.5">
                          {KNOWLEDGE_BASE_CHILDREN.map((child) => {
                            const active = pathname === child.href || pathname.startsWith(`${child.href}/`);
                            return (
                              <Link key={child.navKey} href={child.href} className={subNavLinkClass(active)}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
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
            } else if (isTaskCenterItem(item)) {
              const tasksActive =
                pathname.startsWith(TASK_CENTER_BASE_PATH) ||
                pathname.startsWith('/agent-tasks') ||
                pathname.startsWith('/automations');
              el = navCollapsed ? (
                <Link
                  key={item.navKey}
                  href={`${TASK_CENTER_BASE_PATH}/agent`}
                  title={item.label}
                  className={navLinkClass(tasksActive, true)}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                </Link>
              ) : (
                <div key={item.navKey} className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setTaskCenterOpen((o) => !o)}
                    className={navLinkClass(tasksActive, false)}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-shell-muted transition-transform ${taskCenterOpen ? 'rotate-0' : '-rotate-90'}`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {taskCenterOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-3 space-y-0.5 border-l border-shell-border py-1 pl-2.5">
                          {TASK_CENTER_CHILDREN.map((child) => {
                            const active =
                              pathname === child.href || pathname.startsWith(`${child.href}/`);
                            return (
                              <Link key={child.navKey} href={child.href} className={subNavLinkClass(active)}>
                                <child.icon className="mr-2 h-4 w-4 shrink-0 opacity-80" />
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
                  className={navLinkClass(active, navCollapsed)}
                >
                  <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-brand-primary' : 'text-shell-muted group-hover:text-shell-text'}`} />
                  {!navCollapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            }

            return [...prefix, el];
          })}
        </nav>

        {/* User */}
        <div className="relative mt-auto px-2.5 py-3">
          <div
            className={`flex items-center rounded-xl border border-shell-border-dim bg-shell-panel-hover/60 ${
              navCollapsed ? 'justify-center p-2' : 'gap-3 p-2.5'
            }`}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-primary to-brand-dim text-brand-on-primary shadow-sm shadow-brand-primary/20">
              <UserCircle className="h-5 w-5" />
            </div>
            {!navCollapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-shell-text">演示用户</p>
                <p className="truncate text-[10px] text-shell-muted">HiveMindOS · Dev</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-shell-border bg-shell-sidebar/90 px-4 backdrop-blur-md md:px-6">
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
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/20'
                        : 'text-shell-muted hover:bg-shell-panel-hover hover:text-shell-text'
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
                className="w-full rounded-lg border border-shell-border bg-shell-panel py-1.5 pl-9 pr-3 text-xs text-shell-text outline-none transition-all placeholder:text-shell-muted focus:border-brand-primary/40 focus:ring-1 focus:ring-brand-primary/20"
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
              className="relative rounded-lg p-2 text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text"
              aria-label="通知"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-bright ring-2 ring-shell-sidebar" />
            </button>
            <UserMenu />
          </div>
        </header>

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-shell-bg">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="flex min-h-0 w-full flex-1 flex-col overflow-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
