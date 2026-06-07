import Link from 'next/link';
import { IPFS_MONITOR_BASE_PATH } from '@/config/ipfs-monitor';

export default function IpfsMonitorNotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-bold text-primary">未找到页面</h1>
      <p className="max-w-md text-sm text-on-surface-variant">该节点不存在或链接无效。</p>
      <Link
        href={`${IPFS_MONITOR_BASE_PATH}/nodes`}
        className="text-sm font-bold uppercase tracking-widest text-primary hover:underline"
      >
        返回节点列表
      </Link>
    </div>
  );
}
