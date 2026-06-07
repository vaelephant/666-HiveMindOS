'use client';

import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string;
  unit: string;
  icon: LucideIcon;
  footer: string;
  progress?: number;
  tag?: string;
  trend?: string;
  trendUp?: boolean;
  grid?: boolean;
  status?: string;
};

export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  footer,
  progress,
  tag,
  trend,
  trendUp,
  grid,
  status,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-shell-panel border border-outline-variant p-6 rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)]"
    >
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-surface-container-low rounded-xl text-primary border border-outline-variant">
          <Icon className="w-6 h-6" />
        </div>
        {tag ? (
          <span className="bg-secondary-container text-secondary text-[10px] font-bold px-3 py-1 rounded-full border border-secondary/20">
            {tag}
          </span>
        ) : null}
        {status ? (
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary">
            <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
            {status}
          </div>
        ) : null}
        {trend ? (
          <div className={`flex items-center text-[10px] font-bold ${trendUp ? 'text-primary' : 'text-error'}`}>
            <TrendingUp className="w-3 h-3 mr-1" />
            {trend}
          </div>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <h3 className="text-3xl font-bold text-primary">
          {value} <span className="text-lg font-medium text-on-surface-variant/50">{unit}</span>
        </h3>
      </div>

      {progress !== undefined ? (
        <div className="mt-6">
          <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-primary-container"
            />
          </div>
        </div>
      ) : null}

      {grid ? (
        <div className="mt-6 grid grid-cols-6 gap-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-[2px] ${
                i < 11 ? 'bg-primary-container' : 'bg-surface-container border border-outline-variant'
              }`}
            />
          ))}
        </div>
      ) : null}

      {!progress && !grid && !tag ? (
        <div className="mt-6 h-12 flex items-end justify-between gap-1 border-b border-outline-variant pb-1">
          {[20, 40, 25, 60, 90, 50, 75].map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              className={`w-full rounded-t-sm ${i === 4 ? 'bg-primary' : 'bg-primary-container/20'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-xs text-on-surface-variant font-medium opacity-80">{footer}</p>
    </motion.div>
  );
}
