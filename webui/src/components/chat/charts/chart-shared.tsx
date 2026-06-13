'use client';

import { themeVars } from '@/lib/theme-vars';
import { cn } from '@/lib/utils';

export const CHAT_CHART_HEIGHT = 280;

export const CHART_COLORS = [
  themeVars.chart1,
  themeVars.chart2,
  themeVars.chart3,
  themeVars.chart4,
  themeVars.brandPrimary,
  themeVars.brandDim,
] as const;

export function chartTooltipStyle() {
  return {
    borderRadius: '8px',
    border: `1px solid ${themeVars.chartTooltipBorder}`,
    background: themeVars.chartTooltipBg,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
    fontSize: '12px',
  };
}

export function ChartShell({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'my-3 overflow-hidden rounded-xl border border-shell-border bg-shell-bg/40 p-3',
        className,
      )}
    >
      {title ? (
        <p className="mb-2 text-[13px] font-medium text-shell-text">{title}</p>
      ) : null}
      {children}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <ChartShell>
      <div
        className="animate-pulse rounded-lg bg-shell-border/40"
        style={{ height: CHAT_CHART_HEIGHT }}
      />
    </ChartShell>
  );
}

export function ChartError({ message }: { message: string }) {
  return (
    <div className="my-3 rounded-xl border border-status-error/30 bg-status-error/5 px-3 py-2 text-[12px] text-status-error">
      {message}
    </div>
  );
}
