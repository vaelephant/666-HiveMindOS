'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Cpu,
  LayoutDashboard,
  LineChart,
  MapPin,
  Package,
  Search,
  Settings,
  Warehouse,
  Zap,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ViewType } from '@/types';
import { ModeToggle } from '@/components/mode-toggle';
import { SidebarUser } from '@/components/auth/SidebarUser';

const navItems: { id: ViewType; label: string; icon: typeof LayoutDashboard; href: string }[] = [
  { id: 'dashboard', label: '运营总览', icon: LayoutDashboard, href: '/dashboard' },
  { id: 'master', label: '仓库基础', icon: Warehouse, href: '/master' },
  { id: 'inbound', label: '入库管理', icon: ArrowDownToLine, href: '/inbound' },
  { id: 'outbound', label: '出库管理', icon: ArrowUpFromLine, href: '/outbound' },
  { id: 'inventory', label: '库存管理', icon: Package, href: '/inventory' },
  { id: 'slot-ai', label: '智能库位', icon: MapPin, href: '/slot-ai' },
  { id: 'stocktake', label: '盘点管理', icon: ClipboardList, href: '/stocktake' },
  { id: 'devices', label: '设备自动化', icon: Cpu, href: '/devices' },
  { id: 'analytics', label: '数据分析', icon: LineChart, href: '/analytics' },
  { id: 'ai-brain', label: 'AI 决策', icon: Brain, href: '/ai-brain' },
  { id: 'settings', label: '设置', icon: Settings, href: '/settings' },
];

const NAV_EXPANDED_PX = 256;
const NAV_COLLAPSED_PX = 72;

export default function FleetShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navCollapsed, setNavCollapsed] = useState(false);

  return (
    <div className="flex h-screen w-full bg-surface-base text-on-background overflow-hidden font-sans">
      <motion.aside
        initial={false}
        animate={{ width: navCollapsed ? NAV_COLLAPSED_PX : NAV_EXPANDED_PX }}
        transition={{ type: 'spring', stiffness: 400, damping: 34 }}
        className="hidden md:flex shrink-0 flex-col overflow-hidden border-r border-surface-border bg-shell-sidebar"
        aria-label="Primary navigation"
      >
        <div
          className={`shrink-0 border-b border-shell-border-dim ${navCollapsed ? 'px-2 py-3' : 'p-5'}`}
        >
          <div
            className={`flex gap-2 ${navCollapsed ? 'flex-col items-center' : 'items-start justify-between'}`}
          >
            <div className={`min-w-0 ${navCollapsed ? 'sr-only' : ''}`}>
              <h1 className="text-base font-bold text-shell-text">WareMind OS</h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-shell-muted">
                WareFlow · 流程执行
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNavCollapsed((c) => !c)}
              className="shrink-0 rounded-lg p-1.5 text-shell-muted transition-colors hover:bg-shell-panel-hover hover:text-shell-text"
              aria-label={navCollapsed ? '展开主导航' : '收起主导航'}
              aria-expanded={!navCollapsed}
            >
              {navCollapsed ? (
                <ChevronRight className="h-[18px] w-[18px]" />
              ) : (
                <ChevronLeft className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2 py-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.label}
                className={`flex w-full items-center rounded py-2 text-[13px] font-medium transition-all duration-200 ${
                  navCollapsed ? 'justify-center px-0' : 'space-x-3 px-3'
                } ${
                  active
                    ? navCollapsed
                      ? 'bg-brand-primary/10 text-brand-bright'
                      : 'border-r-4 border-brand-primary bg-brand-primary/10 text-brand-bright'
                    : 'text-shell-muted hover:bg-shell-bg hover:text-shell-subtext'
                }`}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                {!navCollapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto shrink-0 border-t border-shell-border-dim px-2 py-3">
          <SidebarUser collapsed={navCollapsed} />
        </div>
      </motion.aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center h-14 px-6 bg-shell-panel border-b border-surface-border">
          <div className="flex items-center space-x-8">
            <span className="text-sm font-black tracking-tighter text-shell-text uppercase">
              仓储指挥中心
            </span>
            <div className="hidden lg:flex items-center relative group">
              <Search className="absolute left-3 text-shell-muted w-4 h-4" />
              <input
                className="pl-10 pr-4 py-1.5 bg-shell-bg border-none rounded-lg text-xs w-80 focus:ring-1 focus:ring-slate-300 transition-all"
                placeholder="搜索 SKU、出库单、库位或托盘…"
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ModeToggle />
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold text-brand-on-primary transition-opacity hover:opacity-90"
            >
              <Zap className="w-4 h-4" />
              <span>AI 优化</span>
            </button>
            <div className="h-6 w-px bg-shell-border" />
            <div className="flex items-center space-x-2">
              <button
                type="button"
                className="p-1.5 text-shell-muted hover:bg-shell-bg rounded transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-error rounded-full border-2 border-white" />
              </button>
              <button
                type="button"
                className="p-1.5 text-shell-muted hover:bg-shell-bg rounded transition-colors"
              >
                <Calendar className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full w-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
