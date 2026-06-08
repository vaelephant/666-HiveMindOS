'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { GraphSnapshotEdge, GraphSnapshotNode } from '@/lib/kb-types';
import { computeCenterTransform, type GraphTransform } from '@/lib/graph-utils';

type SimNode = GraphSnapshotNode &
  SimulationNodeDatum & {
    x?: number;
    y?: number;
  };

type SimLink = SimulationLinkDatum<SimNode> & {
  id: string;
  relation_type: string;
};

const TYPE_COLOR: Record<string, string> = {
  customer: '#6366f1',
  company: '#6366f1',
  product: '#8b5cf6',
  process: '#06b6d4',
  rule: '#f59e0b',
  person: '#22c55e',
  contract: '#ef4444',
  department: '#64748b',
};

const DEFAULT_COLOR = '#94a3b8';
const LABEL_THRESHOLD = 120;

function nodeColor(type: string) {
  return TYPE_COLOR[type] ?? DEFAULT_COLOR;
}

/**
 * Rescales node positions in-place so the whole layout fits centered inside the
 * given viewport (with padding). Deterministic and independent of canvas transform.
 */
function fitNodesIntoViewport(
  simNodes: Array<{ x?: number; y?: number }>,
  width: number,
  height: number,
  padding = 60,
) {
  const pts = simNodes.filter((n) => n.x != null && n.y != null);
  if (pts.length === 0 || width <= 0 || height <= 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of pts) {
    minX = Math.min(minX, n.x as number);
    maxX = Math.max(maxX, n.x as number);
    minY = Math.min(minY, n.y as number);
    maxY = Math.max(maxY, n.y as number);
  }

  const boxW = Math.max(maxX - minX, 1);
  const boxH = Math.max(maxY - minY, 1);
  const availW = Math.max(width - padding * 2, 50);
  const availH = Math.max(height - padding * 2, 50);
  const scale = Math.min(availW / boxW, availH / boxH, 1.6);

  const boxCx = (minX + maxX) / 2;
  const boxCy = (minY + maxY) / 2;
  const targetCx = width / 2;
  const targetCy = height / 2;

  for (const n of pts) {
    n.x = ((n.x as number) - boxCx) * scale + targetCx;
    n.y = ((n.y as number) - boxCy) * scale + targetCy;
  }
}

function nodeRadius(name: string, selected: boolean) {
  const base = Math.min(28, 10 + name.length * 0.6);
  return selected ? base + 4 : base;
}

type Point = { x: number; y: number };

function pointOnPolyline(points: Point[], t: number): Point | null {
  if (points.length === 0) return null;
  if (points.length === 1) return points[0];

  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const l = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    segLens.push(l);
    total += l;
  }
  if (total === 0) return points[0];

  let dist = ((t % 1) + 1) % 1 * total;
  for (let i = 0; i < segLens.length; i++) {
    if (dist <= segLens[i]) {
      const r = segLens[i] === 0 ? 0 : dist / segLens[i];
      return {
        x: points[i].x + (points[i + 1].x - points[i].x) * r,
        y: points[i].y + (points[i + 1].y - points[i].y) * r,
      };
    }
    dist -= segLens[i];
  }
  return points[points.length - 1];
}

function drawAnimatedPathEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  k: number,
  phase: number,
  segmentIndex: number,
  segmentCount: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const segOffset = segmentIndex / Math.max(segmentCount, 1);

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 4 / k;
  ctx.globalAlpha = 0.28;
  ctx.stroke();

  ctx.setLineDash([10 / k, 7 / k]);
  ctx.lineDashOffset = -(phase + segOffset) * len * 1.8;
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 2.5 / k;
  ctx.globalAlpha = 0.95;
  ctx.stroke();
  ctx.setLineDash([]);

  const localPhase = (phase + segOffset) % 1;
  const px = x1 + dx * localPhase;
  const py = y1 + dy * localPhase;
  ctx.beginPath();
  ctx.arc(px, py, 3.5 / k, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 1.5 / k;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export type EntityGraphCanvasHandle = {
  fitView: () => void;
  centerOnSelected: () => void;
  resetView: () => void;
};

export type PathOrder = { nodeIds: string[]; edgeIds: string[] };

type Props = {
  nodes: GraphSnapshotNode[];
  edges: GraphSnapshotEdge[];
  selectedId: string | null;
  highlightIds: Set<string>;
  pathNodeIds?: Set<string>;
  pathEdgeIds?: Set<string>;
  pathOrder?: PathOrder;
  dimOutsideIds?: Set<string> | null;
  autoCenterOnSelect?: boolean;
  autoFitOnLoad?: boolean;
  onSelect: (node: GraphSnapshotNode | null) => void;
};

export const EntityGraphCanvas = forwardRef<EntityGraphCanvasHandle, Props>(
  function EntityGraphCanvas(
    {
      nodes,
      edges,
      selectedId,
      highlightIds,
      pathNodeIds,
      pathEdgeIds,
      pathOrder,
      dimOutsideIds,
      autoCenterOnSelect = false,
      autoFitOnLoad = true,
      onSelect,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const sizeRef = useRef(size);
    const [sizeReady, setSizeReady] = useState(false);
    const [transform, setTransform] = useState<GraphTransform>({ x: 0, y: 0, k: 1 });
    const transformRef = useRef(transform);
    const simRef = useRef<{ nodes: SimNode[]; links: SimLink[] }>({ nodes: [], links: [] });
    const simRunningRef = useRef(false);
    const rafRef = useRef<number>(0);
    const dragRef = useRef<{
      id: string;
      pointerId: number;
    } | null>(null);
    const panRef = useRef<{
      startX: number;
      startY: number;
      tx: number;
      ty: number;
      pointerId: number;
    } | null>(null);
    const selectedIdRef = useRef(selectedId);
    const highlightIdsRef = useRef(highlightIds);
    const pathNodeIdsRef = useRef(pathNodeIds);
    const pathEdgeIdsRef = useRef(pathEdgeIds);
    const pathOrderRef = useRef(pathOrder);
    const pathAnimPhaseRef = useRef(0);
    const pathAnimLoopRef = useRef(0);
    const fitViewRef = useRef<() => void>(() => {});
    const scheduleDrawRef = useRef<() => void>(() => {});
    const autoFitOnLoadRef = useRef(autoFitOnLoad);
    const dimOutsideIdsRef = useRef(dimOutsideIds);
    const onSelectRef = useRef(onSelect);

    useEffect(() => {
      transformRef.current = transform;
    }, [transform]);

    useEffect(() => {
      selectedIdRef.current = selectedId;
    }, [selectedId]);

    useEffect(() => {
      highlightIdsRef.current = highlightIds;
    }, [highlightIds]);

    useEffect(() => {
      pathNodeIdsRef.current = pathNodeIds;
    }, [pathNodeIds]);

    useEffect(() => {
      pathEdgeIdsRef.current = pathEdgeIds;
    }, [pathEdgeIds]);

    useEffect(() => {
      pathOrderRef.current = pathOrder;
    }, [pathOrder]);

    useEffect(() => {
      dimOutsideIdsRef.current = dimOutsideIds;
    }, [dimOutsideIds]);

    useEffect(() => {
      onSelectRef.current = onSelect;
    }, [onSelect]);

    useEffect(() => {
      autoFitOnLoadRef.current = autoFitOnLoad;
    }, [autoFitOnLoad]);

    const applyTransform = useCallback((next: GraphTransform) => {
      transformRef.current = next;
      setTransform(next);
    }, []);

    const fitView = useCallback(() => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;
      fitNodesIntoViewport(simRef.current.nodes, width, height, 60);
      transformRef.current = { x: 0, y: 0, k: 1 };
      setTransform({ x: 0, y: 0, k: 1 });
      scheduleDrawRef.current();
    }, []);

    useEffect(() => {
      fitViewRef.current = fitView;
    }, [fitView]);

    const scheduleFit = useCallback((delayMs = 0) => {
      window.setTimeout(() => {
        if (autoFitOnLoadRef.current) fitViewRef.current();
      }, delayMs);
    }, []);

    const measureSize = useCallback(() => {
      const el = containerRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      sizeRef.current = { width, height };
      setSize({ width, height });
      setSizeReady(true);
    }, []);

    useLayoutEffect(() => {
      measureSize();
    }, [measureSize]);

    const neighborSet = useMemo(() => {
      if (!selectedId) return null;
      const set = new Set<string>([selectedId]);
      for (const e of edges) {
        if (e.source_id === selectedId) set.add(e.target_id);
        if (e.target_id === selectedId) set.add(e.source_id);
      }
      return set;
    }, [selectedId, edges]);

    const drawFrame = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const { width, height } = size;
      if (width <= 0 || height <= 0) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const { x: tx, y: ty, k } = transformRef.current;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.scale(k, k);

      const { nodes: simNodes, links: simLinks } = simRef.current;
      const sel = selectedIdRef.current;
      const highlights = highlightIdsRef.current;
      const pathNodes = pathNodeIdsRef.current ?? new Set<string>();
      const pathEdges = pathEdgeIdsRef.current ?? new Set<string>();
      const pathOrderData = pathOrderRef.current;
      const dimOutside = dimOutsideIdsRef.current;
      const showAllLabels = simNodes.length <= LABEL_THRESHOLD;
      const hasPath = pathEdges.size > 0;
      const animPhase = pathAnimPhaseRef.current;
      const pathEdgeIndex = new Map<string, number>();
      pathOrderData?.edgeIds.forEach((id, i) => pathEdgeIndex.set(id, i));
      const pathNodeIndex = new Map<string, number>();
      pathOrderData?.nodeIds.forEach((id, i) => pathNodeIndex.set(id, i));
      const pathSegCount = pathOrderData?.edgeIds.length ?? pathEdges.size;

      for (const link of simLinks) {
        const src = link.source as SimNode;
        const tgt = link.target as SimNode;
        if (src.x == null || tgt.x == null || src.y == null || tgt.y == null) continue;

        const onPath = pathEdges.has(link.id);
        const active = sel && (src.id === sel || tgt.id === sel);
        const inFocus =
          !dimOutside || dimOutside.has(src.id) || dimOutside.has(tgt.id);
        const dimmed =
          hasPath && !onPath
            ? true
            : (neighborSet && sel && !neighborSet.has(src.id) && !neighborSet.has(tgt.id) && !highlights.size) ||
              (dimOutside && !inFocus);

        if (onPath) {
          drawAnimatedPathEdge(
            ctx,
            src.x,
            src.y,
            tgt.x,
            tgt.y,
            k,
            animPhase,
            pathEdgeIndex.get(link.id) ?? 0,
            pathSegCount,
          );
        } else {
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.strokeStyle = active ? '#6366f1' : '#cbd5e1';
          ctx.lineWidth = (active ? 2 : 1) / k;
          ctx.globalAlpha = dimmed ? 0.1 : active ? 0.9 : 0.45;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        if ((onPath || active) && k >= 0.55) {
          ctx.font = `${10 / k}px system-ui, sans-serif`;
          ctx.fillStyle = onPath ? '#b45309' : '#64748b';
          ctx.textAlign = 'center';
          ctx.fillText(link.relation_type, (src.x + tgt.x) / 2, (src.y + tgt.y) / 2 - 4);
        }
      }

      if (hasPath && pathOrderData && pathOrderData.nodeIds.length > 1) {
        const polyline: Point[] = [];
        for (const id of pathOrderData.nodeIds) {
          const n = simNodes.find((node) => node.id === id);
          if (n?.x != null && n?.y != null) polyline.push({ x: n.x, y: n.y });
        }
        const traveler = pointOnPolyline(polyline, animPhase);
        if (traveler) {
          ctx.beginPath();
          ctx.arc(traveler.x, traveler.y, 7 / k, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(traveler.x, traveler.y, 4 / k, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#ea580c';
          ctx.lineWidth = 2 / k;
          ctx.stroke();
        }
      }

      for (const node of simNodes) {
        if (node.x == null || node.y == null) continue;
        const selected = node.id === sel;
        const highlighted = highlights.has(node.id);
        const onPath = pathNodes.has(node.id);
        const dimmed =
          hasPath && !onPath
            ? true
            : (neighborSet && sel && !neighborSet.has(node.id) && !highlights.size) ||
              (dimOutside && !dimOutside.has(node.id));
        const r = nodeRadius(node.name, selected);
        const pathIdx = pathNodeIndex.get(node.id);

        if (onPath && !selected) {
          const pulse =
            pathIdx != null
              ? 0.55 + 0.45 * Math.sin((animPhase + pathIdx * 0.18) * Math.PI * 2)
              : 0.85;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r + 4 + pulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = (1.5 + pulse) / k;
          ctx.globalAlpha = dimmed ? 0.25 : 0.35 + pulse * 0.45;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor(node.entity_type);
        ctx.globalAlpha = dimmed ? 0.18 : selected ? 1 : onPath ? 0.95 : 0.88;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = selected ? '#1e293b' : onPath ? '#b45309' : highlighted ? '#1e293b' : '#ffffff';
        ctx.lineWidth = (selected ? 2.5 : onPath ? 2 : 1.5) / k;
        ctx.stroke();

        const showLabel =
          showAllLabels ||
          selected ||
          highlighted ||
          onPath ||
          (neighborSet?.has(node.id) ?? false);
        if (showLabel) {
          const label =
            node.name.length > 14 ? `${node.name.slice(0, 13)}…` : node.name;
          ctx.font = `${selected ? 12 : 11}px system-ui, sans-serif`;
          ctx.fillStyle = dimmed ? 'rgba(15,23,42,0.35)' : '#0f172a';
          ctx.textAlign = 'center';
          ctx.fillText(label, node.x, node.y + r + 12);
        }
      }

      ctx.restore();
    }, [neighborSet, size, pathNodeIds, pathEdgeIds, selectedId, highlightIds]);

    const scheduleDraw = useCallback(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawFrame);
    }, [drawFrame]);

    useEffect(() => {
      scheduleDrawRef.current = scheduleDraw;
    }, [scheduleDraw]);

    useEffect(() => {
      const hasPath = (pathEdgeIds?.size ?? 0) > 0;
      if (!hasPath) {
        cancelAnimationFrame(pathAnimLoopRef.current);
        pathAnimPhaseRef.current = 0;
        scheduleDraw();
        return;
      }

      let running = true;
      const loop = (now: number) => {
        if (!running) return;
        pathAnimPhaseRef.current = (now / 2800) % 1;
        drawFrame();
        pathAnimLoopRef.current = requestAnimationFrame(loop);
      };
      pathAnimLoopRef.current = requestAnimationFrame(loop);
      return () => {
        running = false;
        cancelAnimationFrame(pathAnimLoopRef.current);
      };
    }, [pathEdgeIds, drawFrame, scheduleDraw]);

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      let resizeTimer: number | undefined;
      const ro = new ResizeObserver(() => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
          const prev = sizeRef.current;
          measureSize();
          const next = sizeRef.current;
          if (
            autoFitOnLoadRef.current &&
            simRef.current.nodes.length > 0 &&
            (Math.abs(next.width - prev.width) > 2 || Math.abs(next.height - prev.height) > 2)
          ) {
            scheduleFit(80);
          }
        }, 120);
      });
      ro.observe(el);
      return () => {
        window.clearTimeout(resizeTimer);
        ro.disconnect();
      };
    }, [measureSize, scheduleFit]);

    useEffect(() => {
      scheduleDraw();
    }, [transform, selectedId, highlightIds, pathNodeIds, pathEdgeIds, dimOutsideIds, scheduleDraw]);

    useEffect(() => {
      if (!sizeReady || nodes.length === 0) {
        if (nodes.length === 0) {
          simRef.current = { nodes: [], links: [] };
          scheduleDraw();
        }
        return;
      }

      const { width, height } = sizeRef.current;
      const prevPos = new Map(simRef.current.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
      const idSet = new Set(nodes.map((n) => n.id));
      const simNodeList: SimNode[] = nodes.map((n, i) => {
        const prev = prevPos.get(n.id);
        return {
          ...n,
          x: prev?.x ?? width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 80,
          y: prev?.y ?? height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 80,
        };
      });
      const nodeById = new Map(simNodeList.map((n) => [n.id, n]));
      const simLinkList: SimLink[] = edges
        .filter((e) => idSet.has(e.source_id) && idSet.has(e.target_id))
        .map((e) => ({
          id: e.id,
          relation_type: e.relation_type,
          source: nodeById.get(e.source_id)!,
          target: nodeById.get(e.target_id)!,
        }));

      const charge = nodes.length > 200 ? -320 : nodes.length > 80 ? -240 : nodes.length > 30 ? -180 : -120;
      const linkDist = nodes.length > 200 ? 70 : nodes.length > 80 ? 90 : 110;

      const sim = forceSimulation(simNodeList)
        .force(
          'link',
          forceLink<SimNode, SimLink>(simLinkList)
            .id((d) => d.id)
            .distance(linkDist)
            .strength(0.6),
        )
        .force('charge', forceManyBody().strength(charge))
        .force('center', forceCenter(width / 2, height / 2))
        .force(
          'collide',
          forceCollide<SimNode>().radius((d) => nodeRadius(d.name, false) + 8),
        )
        .stop();

      // Pre-warm the layout synchronously so nodes settle before first paint.
      const ticks = Math.min(400, Math.max(120, nodes.length * 6));
      for (let i = 0; i < ticks; i++) sim.tick();
      simRunningRef.current = false;

      // Center + scale the layout into the viewport by mutating node coords
      // directly. Deterministic, no transform/timing dependency.
      if (autoFitOnLoadRef.current) {
        fitNodesIntoViewport(simNodeList, width, height, 60);
        transformRef.current = { x: 0, y: 0, k: 1 };
        setTransform({ x: 0, y: 0, k: 1 });
      }

      simRef.current = { nodes: simNodeList, links: simLinkList };
      scheduleDraw();

      return () => {
        sim.stop();
      };
    }, [nodes, edges, sizeReady, scheduleDraw]);

    const screenToGraph = useCallback((clientX: number, clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const t = transformRef.current;
      return {
        x: (clientX - rect.left - t.x) / t.k,
        y: (clientY - rect.top - t.y) / t.k,
      };
    }, []);

    const hitTest = useCallback((clientX: number, clientY: number): SimNode | null => {
      const { x, y } = screenToGraph(clientX, clientY);
      const sel = selectedIdRef.current;
      for (const node of [...simRef.current.nodes].reverse()) {
        if (node.x == null || node.y == null) continue;
        const r = nodeRadius(node.name, node.id === sel);
        const dx = node.x - x;
        const dy = node.y - y;
        if (dx * dx + dy * dy <= r * r) return node;
      }
      return null;
    }, [screenToGraph]);

    const centerOnSelected = useCallback(() => {
      const sel = selectedIdRef.current;
      if (!sel) return;
      const node = simRef.current.nodes.find((n) => n.id === sel);
      if (!node || node.x == null || node.y == null) return;
      const { width, height } = sizeRef.current;
      applyTransform(computeCenterTransform({ x: node.x, y: node.y }, width, height));
    }, [applyTransform]);

    const resetView = useCallback(() => {
      applyTransform({ x: 0, y: 0, k: 1 });
    }, [applyTransform]);

    useImperativeHandle(ref, () => ({ fitView, centerOnSelected, resetView }), [
      fitView,
      centerOnSelected,
      resetView,
    ]);

    useEffect(() => {
      if (!autoCenterOnSelect || !selectedId) return;
      const timer = window.setTimeout(() => centerOnSelected(), simRunningRef.current ? 400 : 80);
      return () => window.clearTimeout(timer);
    }, [selectedId, autoCenterOnSelect, centerOnSelected]);

    const onWheel = useCallback((e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const t = transformRef.current;
      applyTransform({
        ...t,
        k: Math.min(3, Math.max(0.2, t.k * factor)),
      });
    }, [applyTransform]);

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        dragRef.current = { id: hit.id, pointerId: e.pointerId };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        return;
      }
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        tx: transformRef.current.x,
        ty: transformRef.current.y,
        pointerId: e.pointerId,
      };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent) => {
      if (dragRef.current) {
        const node = simRef.current.nodes.find((n) => n.id === dragRef.current!.id);
        if (node) {
          const { x, y } = screenToGraph(e.clientX, e.clientY);
          node.fx = x;
          node.fy = y;
          node.x = x;
          node.y = y;
          scheduleDraw();
        }
        return;
      }
      if (!panRef.current) return;
      applyTransform({
        ...transformRef.current,
        x: panRef.current.tx + (e.clientX - panRef.current.startX),
        y: panRef.current.ty + (e.clientY - panRef.current.startY),
      });
    };

    const onPointerUp = (e: React.PointerEvent) => {
      if (dragRef.current) {
        const node = simRef.current.nodes.find((n) => n.id === dragRef.current!.id);
        if (node) {
          node.fx = undefined;
          node.fy = undefined;
        }
        dragRef.current = null;
      } else if (panRef.current) {
        const moved =
          Math.abs(e.clientX - panRef.current.startX) > 4 ||
          Math.abs(e.clientY - panRef.current.startY) > 4;
        if (!moved) {
          onSelectRef.current(null);
        }
        panRef.current = null;
      }
      try {
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };

    const onClick = (e: React.MouseEvent) => {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) onSelectRef.current(hit);
    };

    const visibleRelationTypes = useMemo(() => {
      const types = new Set<string>();
      for (const e of edges) types.add(e.relation_type);
      return Array.from(types);
    }, [edges]);

    if (nodes.length === 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[14px] text-shell-muted">
          <p>暂无图谱数据</p>
          <p className="text-[12px] text-shell-subtext">上传资料并完成编译后，实体将出现在此</p>
        </div>
      );
    }

    if (!sizeReady || size.width <= 0 || size.height <= 0) {
      return (
        <div
          ref={containerRef}
          className="relative h-full min-h-0 w-full overflow-hidden bg-shell-bg"
        />
      );
    }

    return (
      <div
        ref={containerRef}
        className="relative h-full min-h-0 w-full overflow-hidden bg-shell-bg"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={onClick}
        />

        <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 rounded-lg border border-shell-border bg-shell-panel/95 px-3 py-2 shadow-sm backdrop-blur-sm">
          {Object.entries(TYPE_COLOR).slice(0, 6).map(([type, color]) => (
            <span key={type} className="flex items-center gap-1 text-[10px] text-shell-muted">
              <span className="inline-block size-2 rounded-full" style={{ background: color }} />
              {type}
            </span>
          ))}
        </div>

        {visibleRelationTypes.length > 0 ? (
          <div className="pointer-events-none absolute bottom-3 right-3 max-w-[40%] truncate rounded-lg border border-shell-border bg-shell-panel/95 px-3 py-2 text-[10px] text-shell-muted shadow-sm backdrop-blur-sm">
            关系 · {visibleRelationTypes.join(' · ')}
          </div>
        ) : null}

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-shell-border bg-shell-panel/95 px-3 py-1.5 text-[10px] text-shell-muted shadow-sm backdrop-blur-sm">
          滚轮缩放 · 拖拽平移 · 点击空白取消选中
          {(pathEdgeIds?.size ?? 0) > 0 ? ' · 路径动画进行中' : ''}
          {nodes.length > LABEL_THRESHOLD ? ' · 大图仅显示选中/邻居标签' : ''}
        </div>
      </div>
    );
  },
);

export function wikiUrlFromPath(wikiPath: string): string | null {
  if (!wikiPath || !wikiPath.includes('/')) return null;
  const category = wikiPath.split('/')[0];
  const params = new URLSearchParams({ category, page: wikiPath });
  return `/knowledge-base/wiki?${params.toString()}`;
}
