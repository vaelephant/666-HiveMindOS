'use client';

import type { ComponentProps } from 'react';
import dynamic from 'next/dynamic';
import type FleetMap from './LogisticsMap';

const Dyn = dynamic(() => import('./LogisticsMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full min-h-[200px] rounded-xl border border-shell-border bg-shell-panel-hover animate-pulse"
      aria-hidden
    />
  ),
});

export type LogisticsMapProps = ComponentProps<typeof FleetMap>;

export default function LogisticsMapDynamic(props: LogisticsMapProps) {
  return <Dyn {...props} />;
}
