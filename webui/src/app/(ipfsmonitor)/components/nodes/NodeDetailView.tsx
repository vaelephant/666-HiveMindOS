'use client';

import { themeVars } from '@/lib/theme-vars';
import Link from 'next/link';
import {
  ArrowLeft,
  Server,
  MapPin,
  Clock,
  Settings,
  Cpu,
  Database,
  Activity,
  Monitor,
  Zap,
} from 'lucide-react';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import type { IpfsNode } from '@/app/(ipfsmonitor)/types/node';
import { bandwidthData } from '@/app/(ipfsmonitor)/data/mock';
import { MetricCard } from '@/app/(ipfsmonitor)/components/ui/MetricCard';
import { BandwidthAreaChart } from '@/app/(ipfsmonitor)/components/charts/BandwidthAreaChart';

type NodeDetailViewProps = {
  node: IpfsNode;
};

export function NodeDetailView({ node }: NodeDetailViewProps) {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-start">
        <div className="space-y-4">
          <Link
            href={`${IPFS_MONITOR_BASE_PATH}/nodes`}
            className="flex items-center gap-2 text-xs font-bold text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors mb-2 w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Fleet
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-lg">
              <Server className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-primary">{node.id}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[10px] font-mono font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
                  {node.ip}
                </span>
                <span className="text-xs text-on-surface-variant flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {node.location}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="px-6 py-2.5 bg-primary-container text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-opacity-90 transition-all shadow-sm"
          >
            Reboot Node
          </button>
          <button
            type="button"
            className="px-6 py-2.5 border border-outline-variant text-[10px] font-bold uppercase tracking-widest text-primary rounded-lg hover:bg-surface-container transition-all"
          >
            Settings
          </button>
        </div>
      </div>

      <div
        className={`p-4 rounded-xl border ${
          node.status === 'ACTIVE'
            ? 'bg-secondary-container/10 border-secondary/20 text-secondary'
            : 'bg-surface-container border-outline-variant text-on-surface-variant'
        } flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${node.status === 'ACTIVE' ? 'bg-secondary animate-pulse' : 'bg-on-surface-variant'}`}
          />
          <span className="text-xs font-bold uppercase tracking-wider">{node.status}</span>
        </div>
        <div className="flex gap-6 text-[10px] font-bold uppercase tracking-widest opacity-70">
          <span className="flex items-center gap-2">
            <Clock className="w-3 h-3" /> Uptime: {node.uptime}
          </span>
          <span className="flex items-center gap-2">
            <Settings className="w-3 h-3" /> Region: {node.region}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard
          label="CPU Usage"
          value={`${node.cpu}%`}
          icon={Cpu}
          sub="8 Cores active"
          progress={node.cpu}
          chartData={[20, 45, 28, 50, 42, 60, 45]}
        />
        <MetricCard
          label="Memory"
          value={`${node.memory}GB`}
          icon={Database}
          sub={`of ${node.maxMemory}GB Total`}
          progress={(node.memory / node.maxMemory) * 100}
          chartData={[40, 42, 38, 45, 41, 44, 43]}
        />
        <MetricCard
          label="Network"
          value={`${node.network} Mbps`}
          icon={Activity}
          sub="Stable connection"
          progress={55}
          chartData={[100, 140, 120, 160, 110, 150, 142]}
        />
        <MetricCard
          label="Storage"
          value={node.usage > 0 ? `${node.usage}%` : '0%'}
          icon={Monitor}
          sub={node.storageType}
          progress={node.usage}
          chartData={[80, 81, 82, 82, 82, 82, 82]}
        />
      </div>

      <section className="bg-shell-panel border border-outline-variant rounded-xl p-8 shadow-sm">
        <div className="flex justify-between items-center mb-10">
          <div>
            <h3 className="text-xl font-bold text-primary">Live Performance</h3>
            <p className="text-sm text-on-surface-variant">Real-time throughput and latency metrics</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary">
            <Zap className="w-4 h-4 text-secondary" />
            LIVE SYNCING
          </div>
        </div>
        <div className="h-64 w-full">
          <BandwidthAreaChart data={bandwidthData} gradientId="colorUsage" strokeColor={themeVars.brandDim} hideXAxis />
        </div>
      </section>
    </div>
  );
}
