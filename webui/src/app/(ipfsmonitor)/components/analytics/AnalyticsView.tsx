'use client';

import { themeVars } from '@/lib/theme-vars';
import { BarChart3, Database, Globe, Layers, PieChart as PieChartIcon, Radio, Timer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  bandwidthData,
  hourlyTrafficSeries,
  protocolTraffic,
  providerRecordGrowth,
  repoSwarmSeries,
  topCidStats,
} from '@/app/(ipfsmonitor)/data/mock';
import { BandwidthAreaChart } from '@/app/(ipfsmonitor)/components/charts/BandwidthAreaChart';

const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${themeVars.chartTooltipBorder}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  fontSize: 12,
};

const analyticsTiles = [
  { icon: Layers, label: 'Egress (24h)', value: '14.2', unit: 'PiB eq.', hint: 'Normalized mock scale' },
  { icon: Database, label: 'Unique CIDs served', value: '2.04', unit: 'M', hint: 'Across gateways + bitswap' },
  { icon: Globe, label: 'Gateway share', value: '38', unit: '%', hint: 'Of total bytes out' },
  { icon: Radio, label: 'DHT record churn', value: '1.1', unit: 'M/d', hint: 'Provider + peer ids (est.)' },
  { icon: Timer, label: 'TTFB p99', value: '214', unit: 'ms', hint: 'Public gateway' },
  { icon: PieChartIcon, label: 'Cache byte hit', value: '81.4', unit: '%', hint: 'Edge + origin' },
];

export function AnalyticsView() {
  return (
    <div className="w-full max-w-none space-y-5 px-2 pb-8 pt-5 sm:px-3">
      <div className="border-b border-outline-variant/80 pb-5">
        <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Traffic analytics</h2>
        <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
          Ingress/egress trends, protocol mix, hot objects, and routing-table growth proxies — swap chart data for Kubo
          stats, Prometheus, or bifrost exports.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            UTC · 24h window (mock)
          </span>
          <span className="rounded-full border border-secondary/25 bg-secondary-container/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
            Cluster aggregate
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {analyticsTiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm">
            <t.icon className="h-5 w-5 text-primary opacity-80" />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{t.label}</p>
            <p className="mt-1 text-xl font-bold text-primary sm:text-2xl">
              {t.value}
              <span className="ml-1 text-sm font-medium text-on-surface-variant">{t.unit}</span>
            </p>
            <p className="mt-1 text-[10px] text-on-surface-variant/90">{t.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-primary sm:text-xl">Hourly throughput</h3>
              <p className="text-xs text-on-surface-variant sm:text-sm">Ingress vs egress (relative Gbps scale)</p>
            </div>
            <BarChart3 className="h-5 w-5 shrink-0 text-primary opacity-50" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <LineChart data={hourlyTrafficSeries} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={themeVars.chartGrid} />
                <XAxis dataKey="h" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} label={{ value: 'Hour', position: 'insideBottom', offset: -4, fontSize: 10, fill: themeVars.chartAxis }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="ingress" name="Ingress" stroke="color-mix(in srgb, var(--color-brand-primary) 33%, transparent)" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="egress" name="Egress" stroke={themeVars.brandDim} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-outline-variant bg-gradient-to-b from-white to-surface-container-low/60 p-4 shadow-sm sm:p-6 xl:col-span-4">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Snapshot mix</h3>
          <p className="text-xs text-on-surface-variant sm:text-sm">Where bytes left the cluster (mock %)</p>
          <ul className="mt-4 flex-1 space-y-3">
            {[
              ['Bitswap P2P', '44%'],
              ['HTTP gateway', '38%'],
              ['Graphsync / HTTP trustless', '9%'],
              ['Relay egress', '6%'],
              ['Other (DHT, RPC)', '3%'],
            ].map(([k, v]) => (
              <li key={k as string} className="flex items-center justify-between border-b border-outline-variant/50 pb-2 text-sm last:border-0">
                <span className="text-on-surface-variant">{k}</span>
                <span className="font-bold text-primary">{v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-outline-variant bg-shell-panel/90 p-3 text-[10px] leading-relaxed text-on-surface-variant">
            Correlates with protocol chart below; use one view for ops, one for exec review.
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Weekly outbound (TB scale)</h3>
          <p className="mb-4 text-xs text-on-surface-variant sm:text-sm">From bandwidth aggregates</p>
          <div className="h-64 w-full">
            <BandwidthAreaChart data={bandwidthData} gradientId="analAreaOutbound" strokeColor={themeVars.statusSuccess} />
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Daily outbound bars</h3>
          <p className="mb-4 text-xs text-on-surface-variant sm:text-sm">Same series, bar view</p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <BarChart data={bandwidthData} barCategoryGap="36%" maxBarSize={18} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="outbound" fill={themeVars.statusSuccess} name="Outbound" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 xl:col-span-7">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Protocol throughput (Gbps)</h3>
          <p className="mb-3 text-xs text-on-surface-variant sm:text-sm">Stacked inbound + outbound estimate</p>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <BarChart layout="vertical" data={protocolTraffic} margin={{ left: 4, right: 12 }} barCategoryGap={12}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={themeVars.chartGrid} />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={118}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: themeVars.chartAxis, fontSize: 10, fontWeight: 600 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inbound" stackId="t" fill="color-mix(in srgb, var(--color-brand-primary) 33%, transparent)" name="Inbound" />
                <Bar dataKey="outbound" stackId="t" fill={themeVars.brandDim} name="Outbound" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 xl:col-span-5">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Repo vs swarm</h3>
          <p className="mb-4 text-xs text-on-surface-variant sm:text-sm">Footprint vs live peering (same series as dashboard)</p>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <LineChart data={repoSwarmSeries} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={themeVars.chartGrid} />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="repoGiB"
                  name="Repo GiB"
                  stroke={themeVars.brandDim}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="swarm"
                  name="Swarm peers"
                  stroke={themeVars.statusSuccess}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-shell-panel shadow-sm lg:col-span-7">
          <div className="border-b border-outline-variant px-4 py-4 sm:px-6">
            <h3 className="text-lg font-bold text-primary sm:text-xl">Hot CIDs (egress)</h3>
            <p className="text-xs text-on-surface-variant sm:text-sm">Top content by gateway + bitswap (mock)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="px-4 py-3 sm:px-6">CID</th>
                  <th className="px-4 py-3 sm:px-6">Label</th>
                  <th className="px-4 py-3 sm:px-6">Hits</th>
                  <th className="px-4 py-3 sm:px-6">Egress</th>
                  <th className="px-4 py-3 text-right sm:px-6">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {topCidStats.map((row) => (
                  <tr key={row.cid} className="hover:bg-surface-container-low/70">
                    <td className="px-4 py-3 font-mono text-xs text-primary sm:px-6">{row.cid}</td>
                    <td className="px-4 py-3 text-on-surface-variant sm:px-6">{row.label}</td>
                    <td className="px-4 py-3 font-semibold text-primary sm:px-6">{row.hits}</td>
                    <td className="px-4 py-3 text-xs sm:px-6">{row.egressGib} GiB</td>
                    <td className="px-4 py-3 text-right text-xs font-bold text-secondary sm:px-6">{row.sharePct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 lg:col-span-5">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Provider records indexed</h3>
          <p className="mb-4 text-xs text-on-surface-variant sm:text-sm">Daily composite count (thousands, mock)</p>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height={240} minWidth={0}>
              <BarChart data={providerRecordGrowth} barCategoryGap="32%" maxBarSize={22}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [`${value}k`, 'Records']}
                />
                <Bar dataKey="records" fill={themeVars.statusSuccess} name="Records (k)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
