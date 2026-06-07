'use client';

import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

type MetricCardProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  sub: string;
  progress: number;
  chartData: number[];
};

export function MetricCard({ label, value, icon: Icon, sub, progress, chartData }: MetricCardProps) {
  return (
    <div className="bg-shell-panel border border-outline-variant p-6 rounded-xl shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-surface-container-low rounded-lg text-primary border border-outline-variant">
          <Icon className="w-4 h-4" />
        </div>
        <div className="h-8 flex items-end gap-1">
          {chartData.map((h, i) => (
            <div
              key={i}
              className={`w-1 rounded-t-sm ${i === chartData.length - 1 ? 'bg-primary' : 'bg-primary-container/20'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <h3 className="text-2xl font-bold text-primary my-1">{value}</h3>
      <p className="text-[10px] text-on-surface-variant font-medium mb-4">{sub}</p>
      <div className="h-1 w-full bg-surface-container rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} className="h-full bg-primary-container" />
      </div>
    </div>
  );
}
