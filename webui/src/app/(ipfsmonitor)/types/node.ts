export type NodeStatus = 'ACTIVE' | 'MAINTENANCE';

export type IpfsNode = {
  id: string;
  ip: string;
  status: NodeStatus;
  location: string;
  usage: number;
  capacity: string;
  cpu: number;
  memory: number;
  maxMemory: number;
  network: number;
  uptime: string;
  storageType: string;
  region: string;
};

export type BandwidthDatum = {
  name: string;
  inbound: number;
  outbound: number;
};

export type RepoSwarmPoint = {
  t: string;
  repoGiB: number;
  swarm: number;
};

export type ProtocolTraffic = {
  name: string;
  inbound: number;
  outbound: number;
};

export type RecentPinRow = {
  cid: string;
  label: string;
  size: string;
  node: string;
  ago: string;
};

export type ClusterAlert = {
  level: 'info' | 'warn' | 'crit';
  msg: string;
  ago: string;
};

export type HourlyTrafficPoint = {
  h: string;
  ingress: number;
  egress: number;
};

export type TopCidStat = {
  cid: string;
  label: string;
  hits: string;
  egressGib: string;
  sharePct: string;
};

export type NodeSwarmBrief = {
  nodeId: string;
  region: string;
  swarm: number;
  dhtRt: string;
  relay: string;
  nat: string;
  addrs: string;
};

export type RegionPeerCount = {
  region: string;
  peers: number;
};
