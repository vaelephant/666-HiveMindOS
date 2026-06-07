import type { GraphSnapshotEdge, GraphSnapshotNode } from '@/lib/kb-types';

export type GraphTransform = { x: number; y: number; k: number };

export function buildAdjacency(edges: GraphSnapshotEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source_id)) adj.set(e.source_id, new Set());
    if (!adj.has(e.target_id)) adj.set(e.target_id, new Set());
    adj.get(e.source_id)!.add(e.target_id);
    adj.get(e.target_id)!.add(e.source_id);
  }
  return adj;
}

/** Nodes within `hops` edges from centerId (inclusive). */
export function computeHopNeighborhood(
  centerId: string,
  edges: GraphSnapshotEdge[],
  hops: number,
): Set<string> {
  const adj = buildAdjacency(edges);
  const visited = new Set<string>([centerId]);
  let frontier = new Set<string>([centerId]);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visited.has(nb)) {
          visited.add(nb);
          next.add(nb);
        }
      }
    }
    frontier = next;
  }
  return visited;
}

export function filterGraph(
  snapshot: { nodes: GraphSnapshotNode[]; edges: GraphSnapshotEdge[] },
  ids: Set<string>,
) {
  const nodes = snapshot.nodes.filter((n) => ids.has(n.id));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges = snapshot.edges.filter(
    (e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id),
  );
  return { nodes, edges };
}

export function collectRelationTypes(edges: GraphSnapshotEdge[]): string[] {
  const types = new Set<string>();
  for (const e of edges) types.add(e.relation_type);
  return Array.from(types).sort();
}

export function filterEdgesByRelationTypes(
  edges: GraphSnapshotEdge[],
  activeTypes: Set<string>,
  allTypes: string[],
) {
  if (activeTypes.size === 0 || activeTypes.size >= allTypes.length) return edges;
  return edges.filter((e) => activeTypes.has(e.relation_type));
}

export function findShortestPath(
  fromId: string,
  toId: string,
  edges: GraphSnapshotEdge[],
): { nodeIds: string[]; edgeIds: string[] } {
  if (fromId === toId) return { nodeIds: [fromId], edgeIds: [] };

  const adj = new Map<string, Array<{ neighborId: string; edgeId: string }>>();
  for (const e of edges) {
    if (!adj.has(e.source_id)) adj.set(e.source_id, []);
    if (!adj.has(e.target_id)) adj.set(e.target_id, []);
    adj.get(e.source_id)!.push({ neighborId: e.target_id, edgeId: e.id });
    adj.get(e.target_id)!.push({ neighborId: e.source_id, edgeId: e.id });
  }

  const queue = [fromId];
  const visited = new Set<string>([fromId]);
  const parent = new Map<string, { from: string; edgeId: string }>();

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const { neighborId, edgeId } of adj.get(cur) ?? []) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parent.set(neighborId, { from: cur, edgeId });
      queue.push(neighborId);
    }
  }

  if (!visited.has(toId)) return { nodeIds: [], edgeIds: [] };

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let cur: string | undefined = toId;
  while (cur) {
    nodeIds.unshift(cur);
    const p = parent.get(cur);
    if (p) {
      edgeIds.unshift(p.edgeId);
      cur = p.from;
    } else {
      break;
    }
  }
  return { nodeIds, edgeIds };
}

type Point = { x: number; y: number };

export function computeCenterTransform(
  point: Point,
  width: number,
  height: number,
  scale = 1.25,
): GraphTransform {
  const k = Math.min(2.5, Math.max(0.5, scale));
  return {
    x: width / 2 - point.x * k,
    y: height / 2 - point.y * k,
    k,
  };
}

export function computeFitTransform(
  points: Point[],
  width: number,
  height: number,
  padding = 48,
): GraphTransform {
  if (points.length === 0) return { x: 0, y: 0, k: 1 };

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x - 40);
    maxX = Math.max(maxX, p.x + 40);
    minY = Math.min(minY, p.y - 40);
    maxY = Math.max(maxY, p.y + 52);
  }

  const gw = Math.max(maxX - minX, 1);
  const gh = Math.max(maxY - minY, 1);
  const k = Math.min(
    (width - padding * 2) / gw,
    (height - padding * 2) / gh,
    2.5,
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: width / 2 - cx * k,
    y: height / 2 - cy * k,
    k: Math.max(0.25, k),
  };
}
