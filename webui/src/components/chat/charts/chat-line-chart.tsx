'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartSpec } from '@/components/chat/charts/types';
import {
  CHART_COLORS,
  CHAT_CHART_HEIGHT,
  ChartShell,
  chartTooltipStyle,
} from '@/components/chat/charts/chart-shared';
import { themeVars } from '@/lib/theme-vars';

export function ChatLineChart({ spec }: { spec: ChartSpec }) {
  return (
    <ChartShell title={spec.title}>
      <div className="w-full" style={{ height: CHAT_CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHAT_CHART_HEIGHT} minWidth={0}>
          <LineChart data={spec.data}>
            <CartesianGrid strokeDasharray="3 3" stroke={themeVars.chartGrid} />
            <XAxis
              dataKey={spec.xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: themeVars.chartAxis, fontSize: 10, fontWeight: 600 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: themeVars.chartAxis, fontSize: 10 }}
            />
            <Tooltip contentStyle={chartTooltipStyle()} />
            {spec.series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
