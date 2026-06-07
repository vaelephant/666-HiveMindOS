'use client';

import { themeVars } from '@/lib/theme-vars';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { BandwidthDatum } from '@/app/(ipfsmonitor)/types/node';

type BandwidthBarChartProps = {
  data: BandwidthDatum[];
  /** Chart height in px */
  height?: number;
};

export function BandwidthBarChart({ data, height = 288 }: BandwidthBarChartProps) {
  return (
    <div className="h-auto w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <BarChart data={data} barGap={4} barCategoryGap="36%" maxBarSize={18}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: themeVars.chartAxis, fontSize: 10, fontWeight: 600 }}
            dy={16}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: themeVars.chartAxis, fontSize: 10, fontWeight: 600 }} />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: `1px solid ${themeVars.chartTooltipBorder}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              fontSize: '12px',
            }}
          />
          <Bar dataKey="inbound" fill="color-mix(in srgb, var(--color-brand-primary) 33%, transparent)" radius={[3, 3, 0, 0]} name="Inbound" />
          <Bar dataKey="outbound" fill={themeVars.brandDim} radius={[3, 3, 0, 0]} name="Outbound" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
