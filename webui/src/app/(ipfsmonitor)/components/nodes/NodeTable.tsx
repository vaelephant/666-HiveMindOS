'use client';

import { motion } from 'motion/react';
import { MapPin, MoreVertical, Server } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';
import type { IpfsNode } from '@/app/(ipfsmonitor)/types/node';

type NodeTableProps = {
  nodes: IpfsNode[];
};

export function NodeTable({ nodes }: NodeTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-surface-container-low text-[10px] font-bold uppercase tracking-widest text-on-surface-variant border-b border-outline-variant">
            <th className="px-8 py-4">Node Name</th>
            <th className="px-8 py-4">Status</th>
            <th className="px-8 py-4">Location</th>
            <th className="px-8 py-4">Storage Usage</th>
            <th className="px-8 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant">
          {nodes.map((node) => (
            <tr
              key={node.id}
              onClick={() =>
                router.push(`${IPFS_MONITOR_BASE_PATH}/nodes/${encodeURIComponent(node.id)}`)
              }
              className="hover:bg-surface-container-low transition-colors group cursor-pointer"
            >
              <td className="px-8 py-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-primary border border-outline-variant">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{node.id}</p>
                    <p className="text-[10px] font-mono text-on-surface-variant/50">{node.ip}</p>
                  </div>
                </div>
              </td>
              <td className="px-8 py-5">
                <span
                  className={`text-[10px] font-bold px-3 py-1 rounded-full border ${
                    node.status === 'ACTIVE'
                      ? 'bg-secondary-container text-secondary border-secondary/20'
                      : 'bg-surface-container text-on-surface-variant border-outline-variant'
                  }`}
                >
                  {node.status}
                </span>
              </td>
              <td className="px-8 py-5">
                <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <MapPin className="w-3 h-3" />
                  {node.location}
                </div>
              </td>
              <td className="px-8 py-5">
                <div className="w-40">
                  <div className="flex justify-between text-[10px] font-mono mb-2">
                    <span className="font-bold text-primary">{node.usage > 0 ? `${node.usage}%` : '--'}</span>
                    <span className="text-on-surface-variant/60">{node.capacity}</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${node.usage}%` }}
                      className="h-full bg-primary-container"
                    />
                  </div>
                </div>
              </td>
              <td className="px-8 py-5 text-right">
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="p-2 text-on-surface-variant hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
