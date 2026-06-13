'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
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

export function ChatBarChart({ spec }: { spec: ChartSpec }) {
  return (
    <ChartShell title={spec.title}>
      <div className="w-full" style={{ height: CHAT_CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHAT_CHART_HEIGHT} minWidth={0}>
          <BarChart data={spec.data} barGap={4} barCategoryGap="28%" maxBarSize={28}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
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
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
