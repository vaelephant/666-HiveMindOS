import type {
  BandwidthDatum,
  ClusterAlert,
  HourlyTrafficPoint,
  IpfsNode,
  NodeSwarmBrief,
  ProtocolTraffic,
  RecentPinRow,
  RegionPeerCount,
  RepoSwarmPoint,
  TopCidStat,
} from '@/app/(ipfsmonitor)/types/node';

export const bandwidthData: BandwidthDatum[] = [
  { name: 'MON', inbound: 32, outbound: 48 },
  { name: 'TUE', inbound: 24, outbound: 36 },
  { name: 'WED', inbound: 40, outbound: 56 },
  { name: 'THU', inbound: 28, outbound: 44 },
  { name: 'FRI', inbound: 36, outbound: 52 },
  { name: 'SAT', inbound: 44, outbound: 60 },
  { name: 'SUN', inbound: 20, outbound: 32 },
];

export const nodes: IpfsNode[] = [
  {
    id: 'US-East-01',
    ip: '10.0.42.115',
    status: 'ACTIVE',
    location: 'Virginia, USA',
    usage: 82,
    capacity: '41/50 TB',
    cpu: 45,
    memory: 12.4,
    maxMemory: 32,
    network: 142,
    uptime: '14d 2h 45m',
    storageType: 'NVMe SSD',
    region: 'us-east-1',
  },
  {
    id: 'EU-West-04',
    ip: '172.16.8.92',
    status: 'ACTIVE',
    location: 'London, UK',
    usage: 45,
    capacity: '22/50 TB',
    cpu: 28,
    memory: 8.1,
    maxMemory: 32,
    network: 89,
    uptime: '42d 8h 12m',
    storageType: 'SATA SSD',
    region: 'eu-west-2',
  },
  {
    id: 'AS-East-09',
    ip: '192.168.1.1',
    status: 'MAINTENANCE',
    location: 'Tokyo, JP',
    usage: 0,
    capacity: 'Offline',
    cpu: 0,
    memory: 0,
    maxMemory: 32,
    network: 0,
    uptime: '0s',
    storageType: 'HDD Raid',
    region: 'ap-northeast-1',
  },
];

export function getNodeById(id: string): IpfsNode | undefined {
  return nodes.find((n) => n.id === id);
}

/** Repo size (GiB) vs swarm peer count — hourly sample */
export const repoSwarmSeries: RepoSwarmPoint[] = [
  { t: '00:00', repoGiB: 102, swarm: 312 },
  { t: '04:00', repoGiB: 105, swarm: 348 },
  { t: '08:00', repoGiB: 109, swarm: 402 },
  { t: '12:00', repoGiB: 114, swarm: 468 },
  { t: '16:00', repoGiB: 116, swarm: 485 },
  { t: '20:00', repoGiB: 118, swarm: 492 },
  { t: '24:00', repoGiB: 121, swarm: 504 },
];

export const protocolTraffic: ProtocolTraffic[] = [
  { name: 'Bitswap', inbound: 18.2, outbound: 24.1 },
  { name: 'Gateway', inbound: 6.4, outbound: 11.8 },
  { name: 'Relay / Holepunch', inbound: 2.1, outbound: 3.6 },
  { name: 'DHT / RPC', inbound: 0.9, outbound: 1.4 },
];

export const recentPins: RecentPinRow[] = [
  {
    cid: 'bafybei…2kq',
    label: 'dataset — manifests v3',
    size: '842 MB',
    node: 'US-East-01',
    ago: '2m',
  },
  {
    cid: 'QmYjtig…9n',
    label: 'wasm worker bundle',
    size: '18 MB',
    node: 'EU-West-04',
    ago: '14m',
  },
  {
    cid: 'bafkrei…7p',
    label: 'nginx config pack',
    size: '120 KB',
    node: 'US-East-01',
    ago: '41m',
  },
  {
    cid: 'bafybei…xz',
    label: 'CRDT snapshot',
    size: '3.2 GB',
    node: 'EU-West-04',
    ago: '1h',
  },
];

export const clusterAlerts: ClusterAlert[] = [
  { level: 'warn', msg: 'AS-East-09 under maintenance — pin quorum 2/3 for region APAC.', ago: '6m' },
  { level: 'info', msg: 'Garbage collection window completed — 140 GiB reclaimed (cluster).', ago: '38m' },
  { level: 'info', msg: 'Provider records refreshed — 1.2M keys in routing table (est.).', ago: '2h' },
  { level: 'info', msg: 'Pin queue depth 12 jobs — within SLA target.', ago: '3h' },
];

export const kuboMeta = {
  version: 'Kubo 0.32.1',
  dhtMode: 'DHT server · WAN',
  routing: 'HTTP delegated + Amino',
  blocksPerSec: '4.2k',
  wantListMax: '1.8k',
};

/** 24h synthetic traffic — Gbps-ish scale for chart */
export const hourlyTrafficSeries: HourlyTrafficPoint[] = [
  { h: '00', ingress: 12, egress: 19 },
  { h: '02', ingress: 9, egress: 14 },
  { h: '04', ingress: 8, egress: 12 },
  { h: '06', ingress: 14, egress: 22 },
  { h: '08', ingress: 22, egress: 31 },
  { h: '10', ingress: 28, egress: 38 },
  { h: '12', ingress: 31, egress: 42 },
  { h: '14', ingress: 29, egress: 40 },
  { h: '16', ingress: 26, egress: 36 },
  { h: '18', ingress: 24, egress: 34 },
  { h: '20', ingress: 32, egress: 45 },
  { h: '22', ingress: 18, egress: 28 },
];

export const regionPeerCounts: RegionPeerCount[] = [
  { region: 'US-East', peers: 168 },
  { region: 'EU-West', peers: 124 },
  { region: 'APAC', peers: 89 },
  { region: 'LATAM', peers: 52 },
  { region: 'Other', peers: 71 },
];

export const nodeSwarmBriefs: NodeSwarmBrief[] = [
  {
    nodeId: 'US-East-01',
    region: 'us-east-1',
    swarm: 512,
    dhtRt: '412 buckets',
    relay: 'circuit v2',
    nat: 'symmetric · mapped',
    addrs: '/ip4/10.0…/tcp/4001,/ip6/…/udp/4001/quic',
  },
  {
    nodeId: 'EU-West-04',
    region: 'eu-west-2',
    swarm: 388,
    dhtRt: '388 buckets',
    relay: 'holepunch ok',
    nat: 'cone',
    addrs: '/ip4/172.16…/tcp/4001',
  },
  {
    nodeId: 'AS-East-09',
    region: 'ap-northeast-1',
    swarm: 0,
    dhtRt: '—',
    relay: '—',
    nat: '—',
    addrs: 'maintenance',
  },
];

export const topCidStats: TopCidStat[] = [
  { cid: 'bafybei…ff9', label: 'dataset shard A', hits: '842k', egressGib: '190', sharePct: '18%' },
  { cid: 'bafybei…21a', label: 'container layers', hits: '612k', egressGib: '124', sharePct: '12%' },
  { cid: 'QmYjtig…91', label: 'static site tarball', hits: '404k', egressGib: '88', sharePct: '9%' },
  { cid: 'bafkrei…cc', label: 'wasm pack', hits: '301k', egressGib: '41', sharePct: '6%' },
  { cid: 'bafybei…d0', label: 'CRDT segment', hits: '288k', egressGib: '62', sharePct: '7%' },
];

export const providerRecordGrowth = [
  { day: 'Mo', records: 820 },
  { day: 'Tu', records: 890 },
  { day: 'We', records: 940 },
  { day: 'Th', records: 910 },
  { day: 'Fr', records: 980 },
  { day: 'Sa', records: 1020 },
  { day: 'Su', records: 994 },
];
