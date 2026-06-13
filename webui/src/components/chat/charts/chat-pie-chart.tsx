'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChartSpec } from '@/components/chat/charts/types';
import {
  CHART_COLORS,
  CHAT_CHART_HEIGHT,
  ChartShell,
  chartTooltipStyle,
} from '@/components/chat/charts/chart-shared';

export function ChatPieChart({ spec }: { spec: ChartSpec }) {
  return (
    <ChartShell title={spec.title}>
      <div className="w-full" style={{ height: CHAT_CHART_HEIGHT }}>
        <ResponsiveContainer width="100%" height={CHAT_CHART_HEIGHT} minWidth={0}>
          <PieChart>
            <Pie
              data={spec.data}
              dataKey={spec.valueKey}
              nameKey={spec.nameKey}
              cx="50%"
              cy="50%"
              outerRadius="72%"
              innerRadius="42%"
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={{ strokeWidth: 1 }}
            >
              {spec.data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={chartTooltipStyle()} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartShell>
  );
}
