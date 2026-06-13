'use client';

import type { ChartSpec } from '@/components/chat/charts/types';
import { ChatBarChart } from '@/components/chat/charts/chat-bar-chart';
import { ChatLineChart } from '@/components/chat/charts/chat-line-chart';
import { ChatPieChart } from '@/components/chat/charts/chat-pie-chart';

export function ChatChartView({ spec }: { spec: ChartSpec }) {
  switch (spec.type) {
    case 'bar':
      return <ChatBarChart spec={spec} />;
    case 'line':
      return <ChatLineChart spec={spec} />;
    case 'pie':
      return <ChatPieChart spec={spec} />;
    default:
      return null;
  }
}
