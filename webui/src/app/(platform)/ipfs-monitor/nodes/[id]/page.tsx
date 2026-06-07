import { notFound } from 'next/navigation';
import { getNodeById } from '@/app/(ipfsmonitor)/data/mock';
import { NodeDetailView } from '@/app/(ipfsmonitor)/components/nodes/NodeDetailView';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function IpfsMonitorNodeDetailPage({ params }: Props) {
  const { id } = await params;
  const node = getNodeById(decodeURIComponent(id));
  if (!node) notFound();
  return <NodeDetailView node={node} />;
}
