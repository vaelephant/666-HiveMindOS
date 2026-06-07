'use client';

import { themeVars } from '@/lib/theme-vars';
import { useMemo } from 'react';
import {
  Activity,
  Box,
  Cpu,
  Globe2,
  RefreshCw,
  Route,
  Share2,
  Signal,
  Wifi,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  kuboMeta,
  nodeSwarmBriefs,
  nodes,
  regionPeerCounts,
} from '@/app/(ipfsmonitor)/data/mock';
import { NodeTable } from '@/app/(ipfsmonitor)/components/nodes/NodeTable';
import { mulberry32 } from '@/app/(ipfsmonitor)/lib/seeded-random';

const healthData = [
  { name: 'Healthy', value: 91, color: themeVars.statusSuccess },
  { name: 'Warning', value: 8, color: themeVars.statusWarning },
  { name: 'Critical', value: 1, color: themeVars.statusError },
];

const tooltipStyle = {
  borderRadius: 8,
  border: `1px solid ${themeVars.chartTooltipBorder}`,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  fontSize: 12,
};

const nodeKpis = [
  { icon: Activity, label: 'Fleet uptime', value: '99.94%', hint: 'Rolling 30d (mock)' },
  { icon: Share2, label: 'Avg swarm / peer node', value: '300', hint: 'Weighted by region' },
  { icon: Route, label: 'DHT server nodes', value: '11', hint: 'WAN-dual mode' },
  { icon: Wifi, label: 'Relay circuits', value: '48', hint: 'Active v2 sessions' },
  { icon: Signal, label: 'Holepunch success', value: '94%', hint: 'Last 24h attempts' },
  { icon: Cpu, label: 'CPU p95 (fleet)', value: '52%', hint: 'Excluding MAINT' },
];

export function NodesView() {
  const heatmapCells = useMemo(() => {
    const rand = mulberry32(42);
    return Array.from({ length: 72 }, (_, i) => {
      const latency = Math.floor(rand() * 200);
      const color = latency < 50 ? themeVars.statusSuccess : latency < 120 ? themeVars.statusWarning : themeVars.statusError;
      const opacity = 0.7 + rand() * 0.3;
      return { latency, color, opacity, i };
    });
  }, []);

  const activeNodes = nodes.filter((n) => n.status === 'ACTIVE').length;

  return (
    <div className="w-full max-w-none space-y-5 px-2 pb-8 pt-5 sm:px-3">
      <div className="flex flex-col gap-4 border-b border-outline-variant/80 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Nodes & connectivity</h2>
          <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
            Swarm peering, DHT routing posture, NAT/relay health, and per-node addresses (demonstration telemetry —
            wire to Kubo / cluster APIs when ready).
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
              {kuboMeta.version}
            </span>
            <span className="rounded-full border border-secondary/25 bg-secondary-container/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
              {kuboMeta.dhtMode}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/80">
              {activeNodes} active · {nodes.length} total in table
            </span>
          </div>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-2 self-start rounded-lg bg-primary px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-opacity-90 lg:self-auto"
        >
          <RefreshCw className="h-4 w-4" />
          Sync topology
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {nodeKpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <k.icon className="h-5 w-5 shrink-0 text-primary opacity-80" />
            </div>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{k.label}</p>
            <p className="mt-1 text-xl font-bold text-primary sm:text-2xl">{k.value}</p>
            <p className="mt-1 text-[10px] text-on-surface-variant/90">{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="flex flex-col rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 xl:col-span-4">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Fleet health mix</h3>
          <p className="text-xs text-on-surface-variant sm:text-sm">Synthetic distribution across probes</p>
          <div className="relative mt-4 w-full">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <PieChart margin={{ top: 8, bottom: 8 }}>
                <Pie
                  data={healthData}
                  cx="50%"
                  cy="50%"
                  innerRadius="42%"
                  outerRadius="72%"
                  paddingAngle={4}
                  dataKey="value"
                >
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-primary tabular-nums sm:text-4xl">92%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Global</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {healthData.map((item) => (
              <div key={item.name} className="text-center">
                <div className="text-xs font-bold text-primary">{item.value}%</div>
                <div className="text-[9px] uppercase tracking-widest text-on-surface-variant">{item.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 xl:col-span-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-bold text-primary sm:text-xl">Inter-region latency grid</h3>
              <p className="text-xs text-on-surface-variant sm:text-sm">
                Mock RTT heatmap (ms) — 12×6 samples · use probes for production
              </p>
            </div>
            <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-status-success" /> Fast
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-status-warning" /> Med
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-status-error" /> Slow
              </span>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-0 overflow-hidden rounded-lg border border-outline-variant/50">
            {heatmapCells.map(({ latency, color, opacity, i }) => (
              <div
                key={i}
                className="aspect-square min-h-[6px] cursor-help transition-[filter] hover:z-10 hover:brightness-110"
                style={{ backgroundColor: color, opacity }}
                title={`${latency} ms`}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-outline-variant pt-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Window 5m</span>
            <span>Mesh + gateway paths</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <section className="rounded-xl border border-outline-variant bg-shell-panel p-4 shadow-sm sm:p-6 lg:col-span-7">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-primary sm:text-xl">Regional swarm density</h3>
            <p className="text-xs text-on-surface-variant sm:text-sm">Connected peers observed per macro-region</p>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height={260} minWidth={0}>
              <BarChart data={regionPeerCounts} margin={{ left: 0, right: 8 }} barCategoryGap="28%" maxBarSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="region" axisLine={false} tickLine={false} tick={{ fill: themeVars.chartAxis, fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: themeVars.chartAxis, fontSize: 10 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="peers" fill={themeVars.brandDim} name="Peers" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="flex flex-col justify-between rounded-xl border border-outline-variant bg-gradient-to-br from-surface-bright to-surface-container-low/90 p-4 shadow-sm sm:p-6 lg:col-span-5">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-primary sm:text-xl">
              <Globe2 className="h-5 w-5" />
              Transport & NAT
            </h3>
            <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">Quick readiness checks (mock)</p>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex justify-between gap-2 border-b border-outline-variant/60 pb-2">
              <span className="text-on-surface-variant">QUIC / Noise</span>
              <span className="font-bold text-secondary">Preferred</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-outline-variant/60 pb-2">
              <span className="text-on-surface-variant">TCP fallback</span>
              <span className="font-bold text-primary">Enabled</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-outline-variant/60 pb-2">
              <span className="text-on-surface-variant">AutoRelay</span>
              <span className="font-bold text-primary">On</span>
            </li>
            <li className="flex justify-between gap-2 border-b border-outline-variant/60 pb-2">
              <span className="text-on-surface-variant">Reachability</span>
              <span className="font-bold text-primary">Public + relay</span>
            </li>
            <li className="flex justify-between gap-2">
              <span className="text-on-surface-variant">TLS gateways</span>
              <span className="font-bold text-primary">TLS 1.3</span>
            </li>
          </ul>
          <div className="mt-4 rounded-lg border border-outline-variant/80 bg-shell-panel/80 p-3 text-[10px] text-on-surface-variant">
            <Box className="mb-1 inline h-3.5 w-3.5 text-primary" /> Bootstrappers:{' '}
            <span className="font-mono text-primary">/dnsaddr/bootstrap.libp2p.io/…</span> + 2 org-internal
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-outline-variant bg-shell-panel shadow-sm">
        <div className="border-b border-outline-variant px-4 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Swarm & DHT by node</h3>
          <p className="text-xs text-on-surface-variant sm:text-sm">Address hints truncated for display</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                <th className="px-4 py-3 sm:px-6">Node</th>
                <th className="px-4 py-3 sm:px-6">Region</th>
                <th className="px-4 py-3 sm:px-6">Swarm</th>
                <th className="px-4 py-3 sm:px-6">DHT RT</th>
                <th className="px-4 py-3 sm:px-6">NAT</th>
                <th className="px-4 py-3 sm:px-6">Relay</th>
                <th className="min-w-[200px] px-4 py-3 sm:px-6">Listen / advertised</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {nodeSwarmBriefs.map((row) => (
                <tr key={row.nodeId} className="hover:bg-surface-container-low/70">
                  <td className="px-4 py-3 font-bold text-primary sm:px-6">{row.nodeId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-on-surface-variant sm:px-6">{row.region}</td>
                  <td className="px-4 py-3 sm:px-6">{row.swarm}</td>
                  <td className="px-4 py-3 text-xs sm:px-6">{row.dhtRt}</td>
                  <td className="px-4 py-3 text-xs sm:px-6">{row.nat}</td>
                  <td className="px-4 py-3 text-xs sm:px-6">{row.relay}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-on-surface-variant sm:px-6">{row.addrs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-outline-variant bg-shell-panel shadow-sm">
        <div className="border-b border-outline-variant px-4 py-4 sm:px-6">
          <h3 className="text-lg font-bold text-primary sm:text-xl">Fleet storage & status</h3>
          <p className="text-xs text-on-surface-variant sm:text-sm">Row opens node detail</p>
        </div>
        <NodeTable nodes={nodes} />
      </section>
    </div>
  );
}
