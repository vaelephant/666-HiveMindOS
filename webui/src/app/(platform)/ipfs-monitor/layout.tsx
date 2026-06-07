import type { Metadata } from 'next';
import { MonitorShell } from '@/app/(ipfsmonitor)/components/layout/MonitorShell';
export const metadata: Metadata = {
  title: 'IPFS 监控',
  description: '去中心化集群基础设施与健康度量',
};

export default function IpfsMonitorLayout({ children }: { children: React.ReactNode }) {
  return <MonitorShell embedded>{children}</MonitorShell>;
}
