'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Navigation,
  Fuel,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { FleetSnapshot, FleetVehicle } from '@/types';

const WIDTH_PX = 320;
/** 收起后仍占位一条窄轨，避免右侧 main 盖住展开按钮、无法点击 */
const COLLAPSED_RAIL_PX = 40;

function rosterBadgeClass(label: string) {
  if (label === 'In Motion' || label === 'In Transit')
    return 'bg-emerald-500/10 text-emerald-400';
  if (label === 'Delayed' || label === 'Offline') return 'bg-red-500/10 text-red-400';
  return 'bg-slate-700 text-shell-muted';
}

export type SidebarProps = {
  roster: FleetVehicle[];
  selectedAsset: string | null;
  onSelectAsset: (id: string) => void;
  snapshot: FleetSnapshot | null;
};

export default function Sidebar({
  roster,
  selectedAsset,
  onSelectAsset,
  snapshot,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_RAIL_PX : WIDTH_PX }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="relative z-20 flex h-full min-w-0 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-slate-900/80 shadow-2xl backdrop-blur-md"
    >
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex min-h-0 flex-1 items-center justify-center text-shell-subtext transition-colors hover:bg-shell-panel/10 hover:text-white"
          aria-label="展开侧边栏"
        >
          <ChevronRight className="h-4 w-4 shrink-0" />
        </button>
      ) : (
        <aside className="flex min-h-0 w-80 min-w-0 flex-1 flex-col" aria-label="作业单元列表">
          <div className="border-b border-white/5 bg-black/20 p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">
                在库作业视图
              </h2>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="rounded-lg border border-white/10 p-1.5 text-shell-muted transition-colors hover:bg-shell-panel/10 hover:text-white"
                aria-label="收起侧边栏"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            <div className="group relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-shell-muted transition-colors group-hover:text-shell-subtext" />
              <input
                type="text"
                placeholder="搜索库位、拣货任务或班组…"
                className="w-full rounded-lg border border-white/10 bg-slate-800/50 py-2 pl-10 pr-4 text-xs text-white placeholder:text-shell-muted transition-all focus:ring-1 focus:ring-white/20"
              />
            </div>
            {snapshot ? (
              <p className="mt-3 font-mono text-[10px] text-shell-muted">
                {snapshot.count} 条记录 · seed {snapshot.seed}
              </p>
            ) : null}
          </div>

          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-3">
            {roster.map((asset) => (
              <button
                key={asset.vin}
                type="button"
                onClick={() => onSelectAsset(asset.id)}
                className={`group w-full rounded-xl border p-3 text-left transition-all ${
                  selectedAsset === asset.id
                    ? 'scale-[1.02] border-white/20 bg-shell-panel/10 shadow-lg'
                    : 'border-transparent bg-shell-panel/5 hover:border-white/10 hover:bg-shell-panel/10'
                }`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <span className="text-[13px] font-black text-white">{asset.id}</span>
                    <p className="text-[10px] font-medium text-shell-muted">{asset.driverName}</p>
                    <p className="mt-0.5 text-[9px] text-shell-muted">{asset.makeModel}</p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-tighter ${rosterBadgeClass(asset.motionLabel)}`}
                  >
                    {asset.motionLabel}
                  </span>
                </div>
                <div className="mt-3 flex items-center space-x-3 opacity-60 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center space-x-1 text-[10px] text-white">
                    <Navigation className="h-3 w-3 text-shell-muted" />
                    <span>{asset.speedDisplay}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-[10px] text-white">
                    <Fuel className="h-3 w-3 text-shell-muted" />
                    <span>{asset.fuelDisplay}</span>
                  </div>
                  <div className="flex flex-1 items-center justify-end">
                    <ChevronRight
                      className={`h-4 w-4 text-shell-subtext transition-transform ${selectedAsset === asset.id ? 'translate-x-1 text-white' : ''}`}
                    />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex gap-2 border-t border-white/5 bg-black/20 p-4">
            <button
              type="button"
              className="flex-1 rounded border border-white/5 bg-shell-panel/5 py-2 text-[10px] font-black uppercase italic text-white transition-colors hover:bg-shell-panel/10"
            >
              导出作业日志
            </button>
            <button
              type="button"
              className="rounded border border-white/5 bg-shell-panel/5 p-2 text-white transition-colors hover:bg-shell-panel/10"
              aria-label="Filter roster"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}
    </motion.div>
  );
}
