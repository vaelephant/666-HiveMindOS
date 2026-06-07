'use client';

import { themeVars } from '@/lib/theme-vars';
import {
  Activity,
  Database,
  FileKey,
  Globe,
  Layers,
  Network,
  Radio,
  Share2,
} from 'lucide-react';
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
  clusterAlerts,
  kuboMeta,
  nodes,
  protocolTraffic,
  recentPins,
  repoSwarmSeries,
} from '@/app/(ipfsmonitor)/data/mock';
import { StatCard } from '@/app/(ipfsmonitor)/components/ui/StatCard';
import { BandwidthBarChart } from '@/app/(ipfsmonitor)/components/charts/BandwidthBarChart';
import { NodeTable } from '@/app/(ipfsmonitor)/components/nodes/NodeTable';

const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${themeVars.chartTooltipBorder}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  fontSize: 12,
};

export function DashboardView() {
  return (
    <div className="w-full max-w-none space-y-5 px-2 pb-8 pt-5 sm:px-3">
      <div className="flex flex-col gap-3 border-b border-outline-variant/80 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Network overview</h2>
          <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
            Live snapshot of pinning, swarm connectivity, Bitswap throughput, and gateway load across your IPFS cluster
            (mock telemetry for demonstration).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
            {kuboMeta.version}
          </span>
          <span className="rounded-full border border-secondary/25 bg-secondary-container/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
            {kuboMeta.dhtMode}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/80">
            {kuboMeta.routing}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Repo (logical)"
          value="128.4"
          unit="GiB"
          icon={Database}
          footer="CAR + blockstore across active members"
          progress={71}
          tag="GC OK"
        />
        <StatCard
          label="Swarm peers"
          value="504"
          unit="live"
          icon={Share2}
          footer="WAN + LAN — median RTT 42 ms"
          trend="+6%"
          trendUp={true}
        />
        <StatCard
          label="DHT peers"
          value="3.1"
          unit="k rt"
          icon={Radio}
          footer="Routing table estimate — server mode"
          status="Stable"
        />
        <StatCard
          label="Pinned roots"
          value="18.2"
          unit="k"
          icon={FileKey}
          footer="Recursive + direct pins"
          trend="+0.4%"
          trendUp={true}
        />
        <StatCard
          label="Bitswap blocks/s"
          value={kuboMeta.blocksPerSec}
          unit=""
          icon={Layers}
          footer={`Want-list peak ${kuboMeta.wantListMax} entries`}
        />
        <StatCard
          label="Gateway RPM"
          value="12.4"
          unit="k"
          icon={Globe}
          footer="HTTP /ipfs · 94th pct 118 ms"
          grid={true}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 xl:col-span-7">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-primary sm:text-xl">Cluster bandwidth</h3>
              <p className="text-xs text-on-surface-variant sm:text-sm">
                Aggregated inbound / outbound (Gbps) — Bitswap + gateway + control plane
              </p>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
              Last 7 days
            </span>
          </div>
          <BandwidthBarChart data={bandwidthData} height={320} />
        </section>

        <section className="flex flex-col gap-3 xl:col-span-5">
          <div className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-5">
            <h3 className="text-base font-bold text-primary sm:text-lg">Traffic by protocol</h3>
            <p className="mb-3 text-xs text-on-surface-variant">Outbound share (Gbps) — stacked view</p>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height={220} minWidth={0}>
                <BarChart layout="vertical" data={protocolTraffic} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={themeVars.chartGrid} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: themeVars.chartAxis, fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={108}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: themeVars.chartAxis, fontSize: 10, fontWeight: 600 }}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="inbound" stackId="io" fill="color-mix(in srgb, var(--color-brand-primary) 33%, transparent)" name="Inbound" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="outbound" stackId="io" fill={themeVars.brandDim} name="Outbound" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Block fetch</p>
              <p className="mt-1 text-xl font-bold text-primary">98.7%</p>
              <p className="text-[10px] text-on-surface-variant">Hits local / Bitswap</p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface-container-low/50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">DHT lookup</p>
              <p className="mt-1 text-xl font-bold text-primary">176 ms</p>
              <p className="text-[10px] text-on-surface-variant">p50 provider resolve</p>
            </div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary sm:text-xl">Repo & swarm trend</h3>
            <p className="text-xs text-on-surface-variant sm:text-sm">
              Repo footprint (GiB) vs swarm size — coarser sampling
            </p>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <LineChart data={repoSwarmSeries} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={themeVars.chartGrid} />
                <XAxis dataKey="t" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'GiB', angle: -90, position: 'insideLeft', fill: themeVars.chartAxis, fontSize: 10 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10 }}
                  label={{ value: 'Peers', angle: 90, position: 'insideRight', fill: themeVars.chartAxis, fontSize: 10 }}
                />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="repoGiB"
                  name="Repo GiB"
                  stroke={themeVars.brandDim}
                  strokeWidth={2}
                  dot={{ r: 3, fill: themeVars.brandDim }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="swarm"
                  name="Swarm peers"
                  stroke={themeVars.statusSuccess}
                  strokeWidth={2}
                  dot={{ r: 3, fill: themeVars.statusSuccess }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-primary sm:text-xl">Cluster notices</h3>
              <p className="text-xs text-on-surface-variant sm:text-sm">Operator-facing alerts (mock)</p>
            </div>
            <Activity className="h-5 w-5 shrink-0 text-primary opacity-60" />
          </div>
          <ul className="space-y-3">
            {clusterAlerts.map((a, i) => (
              <li
                key={i}
                className="flex gap-3 border-l-2 border-outline-variant py-1 pl-3"
                style={{
                  borderLeftColor:
                    a.level === 'crit' ? themeVars.statusError : a.level === 'warn' ? themeVars.statusWarning : themeVars.statusSuccess,
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-primary">{a.msg}</p>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                    {a.level} · {a.ago}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <section className="overflow-hidden rounded-xl border border-outline-variant bg-shell-panel shadow-sm lg:col-span-7">
          <div className="border-b border-outline-variant px-4 py-4 sm:px-6">
            <h3 className="text-lg font-bold text-primary sm:text-xl">Recent pins</h3>
            <p className="text-xs text-on-surface-variant sm:text-sm">Latest successful pin operations (truncated CID)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  <th className="px-4 py-3 sm:px-6">CID</th>
                  <th className="px-4 py-3 sm:px-6">Label</th>
                  <th className="px-4 py-3 sm:px-6">Size</th>
                  <th className="px-4 py-3 sm:px-6">Node</th>
                  <th className="px-4 py-3 text-right sm:px-6">Ago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentPins.map((row) => (
                  <tr key={row.cid} className="hover:bg-surface-container-low/80">
                    <td className="px-4 py-3 font-mono text-xs text-primary sm:px-6">{row.cid}</td>
                    <td className="px-4 py-3 text-on-surface-variant sm:px-6">{row.label}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-primary sm:px-6">{row.size}</td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant sm:px-6">{row.node}</td>
                    <td className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-on-surface-variant sm:px-6">
                      {row.ago}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-outline-variant bg-gradient-to-br from-surface-bright to-surface-container-low/80 p-4 shadow-sm sm:p-6 lg:col-span-5">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Quick health</h3>
          <p className="mb-4 text-xs text-on-surface-variant sm:text-sm">Synthetic SLO-style checks</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { k: 'Pin quorum', v: 'Healthy', d: 'APAC degraded 1 node' },
              { k: 'Gateway', v: 'OK', d: '503 rate 0.02%' },
              { k: 'Bitswap', v: 'OK', d: 'Dup block ratio low' },
              { k: 'Graphsync', v: 'Idle', d: 'No active transfers' },
            ].map((x) => (
              <div
                key={x.k}
                className="rounded-lg border border-outline-variant/80 bg-shell-panel/90 px-4 py-3 shadow-sm backdrop-blur-sm"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{x.k}</p>
                <p className="mt-1 text-sm font-bold text-secondary">{x.v}</p>
                <p className="text-[10px] text-on-surface-variant/90">{x.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant/80 pt-4">
            <Network className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium text-primary">
              {nodes.filter((n) => n.status === 'ACTIVE').length} of {nodes.length} nodes reporting in table below
            </span>
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-outline-variant bg-shell-panel shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant px-4 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-bold text-primary sm:text-xl">Fleet status</h3>
            <p className="text-xs text-on-surface-variant sm:text-sm">Click a row for node drill-down</p>
          </div>
        </div>
        <NodeTable nodes={nodes} />
      </section>
    </div>
  );
}
