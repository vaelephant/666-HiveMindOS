'use client';

import { themeVars } from '@/lib/theme-vars';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { BandwidthDatum } from '@/app/(ipfsmonitor)/types/node';

type BandwidthAreaChartProps = {
  data: BandwidthDatum[];
  /** SVG gradient id (unique per chart on page) */
  gradientId: string;
  strokeColor?: string;
  hideXAxis?: boolean;
};

export function BandwidthAreaChart({
  data,
  gradientId,
  strokeColor = themeVars.statusSuccess,
  hideXAxis = false,
}: BandwidthAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={256} minWidth={0}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.1} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
        <XAxis dataKey="name" axisLine={false} tickLine={false} hide={hideXAxis} tick={{ fontSize: 10 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="outbound"
          stroke={strokeColor}
          strokeWidth={2}
          fillOpacity={1}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
