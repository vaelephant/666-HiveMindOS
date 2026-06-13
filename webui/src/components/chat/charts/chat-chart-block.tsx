'use client';

import type { CustomRendererProps } from 'streamdown';
import { ChatChartView } from '@/components/chat/charts/chat-chart-view';
import { parseChartSpec } from '@/components/chat/charts/parse-chart-spec';
import { ChartError, ChartSkeleton } from '@/components/chat/charts/chart-shared';

/** Streamdown custom renderer for ```chart fenced blocks. */
export function ChatChartBlock({ code, isIncomplete }: CustomRendererProps) {
  if (isIncomplete) {
    return <ChartSkeleton />;
  }

  const spec = parseChartSpec(code);
  if (!spec) {
    return <ChartError message="图表数据格式无效，请检查 ```chart JSON 结构" />;
  }

  return <ChatChartView spec={spec} />;
}
