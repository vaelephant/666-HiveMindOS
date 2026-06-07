'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Crosshair, ExternalLink, Loader2, Maximize2, Route, Search, X } from 'lucide-react';
import {
  EntityGraphCanvas,
  type EntityGraphCanvasHandle,
  wikiUrlFromPath,
} from '@/components/knowledge-base/entity-graph-canvas';
import { getEntityDetail, getGraphSnapshot, listEntities } from '@/lib/kb-api';
import { relationLabel } from '@/lib/graph-links';
import {
  collectRelationTypes,
  computeHopNeighborhood,
  filterEdgesByRelationTypes,
  filterGraph,
  findShortestPath,
} from '@/lib/graph-utils';
import type { Entity, EntityDetail, GraphSnapshot } from '@/lib/kb-types';

type FilterType = string | 'all';
type FocusHops = 0 | 1 | 2;

const TYPE_LABEL: Record<string, string> = {
  customer: '客户',
  company: '公司',
  product: '产品',
  process: '流程',
  rule: '规则',
  person: '人员',
  contract: '合同',
  department: '部门',
};

function typeLabel(t: string) {
  return TYPE_LABEL[t] ?? t;
}

export default function GraphPage() {
  return (
    <Suspense fallback={<div className="p-8 text-shell-muted">加载图谱…</div>}>
      <GraphPageContent />
    </Suspense>
  );
}

function GraphPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityParam = searchParams.get('entity');
  const viaParam = searchParams.get('via');
  const graphRef = useRef<EntityGraphCanvasHandle>(null);

  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');
  const [focusHops, setFocusHops] = useState<FocusHops>(0);
  const [activeRelationTypes, setActiveRelationTypes] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<EntityDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const types = ['all', ...Array.from(new Set(entities.map((e) => e.entity_type)))];

  const allRelationTypes = useMemo(
    () => (snapshot ? collectRelationTypes(snapshot.edges) : []),
    [snapshot],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getGraphSnapshot(), listEntities()])
      .then(([snap, list]) => {
        setSnapshot(snap);
        setEntities(list);
        setActiveRelationTypes(new Set(collectRelationTypes(snap.edges)));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const replaceGraphUrl = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      router.replace(`/knowledge-base/graph?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  useEffect(() => {
    if (!entityParam || entities.length === 0) return;
    const match = entities.find((e) => e.name === entityParam);
    if (match && match.id !== selectedId) {
      setSelectedId(match.id);
      setLoadingDetail(true);
      getEntityDetail(match.name)
        .then(setDetail)
        .catch(() => setDetail({ entity: match, neighbors: [], relations: [] }))
        .finally(() => setLoadingDetail(false));
    }
  }, [entityParam, entities, selectedId]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entities.filter((e) => {
      if (filter !== 'all' && e.entity_type !== filter) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q);
    });
  }, [entities, filter, query]);

  const typeFilteredSnapshot = useMemo(() => {
    if (!snapshot) return { nodes: [], edges: [] };
    if (filter === 'all' && !query.trim()) return snapshot;
    const ids = new Set(filteredList.map((e) => e.id));
    return filterGraph(snapshot, ids);
  }, [snapshot, filter, query, filteredList]);

  const pathHighlight = useMemo(() => {
    const empty = {
      nodeIds: new Set<string>(),
      edgeIds: new Set<string>(),
      order: { nodeIds: [] as string[], edgeIds: [] as string[] },
    };
    if (!selectedId || !viaParam || !snapshot) return empty;
    const viaEntity = entities.find((e) => e.name === viaParam);
    if (!viaEntity) return empty;
    const path = findShortestPath(selectedId, viaEntity.id, snapshot.edges);
    return {
      nodeIds: new Set(path.nodeIds),
      edgeIds: new Set(path.edgeIds),
      order: path,
    };
  }, [selectedId, viaParam, snapshot, entities]);

  const relationFilteredSnapshot = useMemo(() => {
    const edges = filterEdgesByRelationTypes(
      typeFilteredSnapshot.edges,
      activeRelationTypes,
      allRelationTypes,
    );
    const filtering =
      activeRelationTypes.size > 0 && activeRelationTypes.size < allRelationTypes.length;
    if (!filtering) return typeFilteredSnapshot;

    const keepIds = new Set<string>();
    for (const e of edges) {
      keepIds.add(e.source_id);
      keepIds.add(e.target_id);
    }
    if (selectedId) keepIds.add(selectedId);
    for (const id of pathHighlight.nodeIds) keepIds.add(id);

    return {
      nodes: typeFilteredSnapshot.nodes.filter((n) => keepIds.has(n.id)),
      edges,
    };
  }, [
    typeFilteredSnapshot,
    activeRelationTypes,
    allRelationTypes,
    selectedId,
    pathHighlight.nodeIds,
  ]);

  const focusIds = useMemo(() => {
    if (!selectedId || focusHops === 0 || !snapshot) return null;
    return computeHopNeighborhood(selectedId, relationFilteredSnapshot.edges, focusHops);
  }, [selectedId, focusHops, snapshot, relationFilteredSnapshot.edges]);

  const { graphNodes, graphEdges } = useMemo(() => {
    let base = relationFilteredSnapshot;
    if (focusIds) base = filterGraph(relationFilteredSnapshot, focusIds);

    if (pathHighlight.nodeIds.size === 0) {
      return { graphNodes: base.nodes, graphEdges: base.edges };
    }

    const nodeIds = new Set(base.nodes.map((n) => n.id));
    const edgeIds = new Set(base.edges.map((e) => e.id));
    for (const id of pathHighlight.nodeIds) nodeIds.add(id);
    for (const id of pathHighlight.edgeIds) edgeIds.add(id);

    if (!snapshot) return { graphNodes: base.nodes, graphEdges: base.edges };

    return {
      graphNodes: snapshot.nodes.filter((n) => nodeIds.has(n.id)),
      graphEdges: snapshot.edges.filter((e) => edgeIds.has(e.id)),
    };
  }, [relationFilteredSnapshot, focusIds, pathHighlight, snapshot]);

  const highlightIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<string>();
    return new Set(
      entities.filter((e) => e.name.toLowerCase().includes(q)).map((e) => e.id),
    );
  }, [entities, query]);

  useEffect(() => {
    if (focusHops > 0 && selectedId && graphNodes.length > 0) {
      const t = window.setTimeout(() => graphRef.current?.fitView(), 350);
      return () => window.clearTimeout(t);
    }
  }, [focusHops, selectedId, graphNodes.length, graphEdges.length]);

  useEffect(() => {
    if (pathHighlight.edgeIds.size > 0) {
      const t = window.setTimeout(() => graphRef.current?.fitView(), 400);
      return () => window.clearTimeout(t);
    }
  }, [pathHighlight.edgeIds.size, viaParam, selectedId]);

  useEffect(() => {
    if (loading || !snapshot || viaParam || focusHops > 0) return;
    const t = window.setTimeout(() => graphRef.current?.fitView(), 650);
    return () => window.clearTimeout(t);
  }, [loading, snapshot, viaParam, focusHops]);

  function selectEntity(entity: Entity, options?: { keepVia?: boolean }) {
    setSelectedId(entity.id);
    replaceGraphUrl((params) => {
      params.set('entity', entity.name);
      if (!options?.keepVia) params.delete('via');
    });
    setLoadingDetail(true);
    setDetail(null);
    getEntityDetail(entity.name)
      .then(setDetail)
      .catch(() => setDetail({ entity, neighbors: [], relations: [] }))
      .finally(() => setLoadingDetail(false));
  }

  function selectByNodeId(nodeId: string | null) {
    if (!nodeId) {
      setSelectedId(null);
      setDetail(null);
      replaceGraphUrl((params) => {
        params.delete('entity');
        params.delete('via');
      });
      return;
    }
    const entity = entities.find((e) => e.id === nodeId);
    if (entity) selectEntity(entity);
  }

  function highlightPathTo(neighborName: string) {
    if (!detail) return;
    replaceGraphUrl((params) => {
      params.set('entity', detail.entity.name);
      params.set('via', neighborName);
    });
  }

  function clearPathHighlight() {
    replaceGraphUrl((params) => {
      params.delete('via');
    });
  }

  function toggleRelationType(type: string) {
    setActiveRelationTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      if (next.size === 0) return new Set(allRelationTypes);
      return next;
    });
  }

  function setFocusHopsAndUrl(hops: FocusHops) {
    setFocusHops(hops);
    replaceGraphUrl((params) => {
      if (hops === 0) params.delete('focus');
      else params.set('focus', String(hops));
    });
  }

  const wikiUrl = detail?.entity.wiki_path
    ? wikiUrlFromPath(detail.entity.wiki_path)
    : null;

  const focusLabel =
    focusHops === 0 ? '全图' : focusHops === 1 ? '1 跳子图' : '2 跳子图';

  const pathSteps = pathHighlight.nodeIds.size;

  return (
    <div className="flex h-[calc(100dvh-3.25rem)] min-h-0 overflow-hidden">
      <aside className="flex w-52 shrink-0 flex-col overflow-hidden border-r border-shell-border">
        <div className="border-b border-shell-border px-3 py-4">
          <p className="text-[11px] font-medium tracking-wide text-shell-muted">实体列表</p>
          {snapshot ? (
            <p className="mt-1 text-[10px] text-shell-muted">
              {snapshot.stats.node_count} 节点 · {snapshot.stats.edge_count} 关系
            </p>
          ) : null}
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-shell-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索实体…"
              className="w-full rounded-lg border border-shell-border bg-shell-bg py-1.5 pl-8 pr-2 text-[12px] text-shell-text outline-none focus:border-brand-primary/40"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-2 gap-y-1 border-b border-shell-border px-3 py-3">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                filter === t
                  ? 'bg-brand-primary/10 font-medium text-brand-primary'
                  : 'text-shell-muted hover:text-shell-subtext'
              }`}
            >
              {t === 'all' ? '全部' : typeLabel(t)}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-4 animate-spin text-shell-muted" />
            </div>
          ) : error ? (
            <p className="px-3 py-6 text-[12px] text-status-error">{error}</p>
          ) : filteredList.length === 0 ? (
            <p className="px-3 py-6 text-[12px] text-shell-muted">无匹配实体</p>
          ) : (
            <ul className="divide-y divide-shell-border">
              {filteredList.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => selectEntity(e)}
                    className={`w-full px-3 py-3 text-left transition-colors ${
                      selectedId === e.id
                        ? 'bg-brand-primary/5 text-brand-primary'
                        : 'text-shell-subtext hover:bg-shell-bg hover:text-shell-text'
                    }`}
                  >
                    <span className="text-[10px] text-shell-muted">{typeLabel(e.entity_type)}</span>
                    <p className="mt-0.5 truncate text-[13px] font-medium">{e.name}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col border-r border-shell-border">
        <div className="shrink-0 border-b border-shell-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="flex items-center gap-1">
              {([0, 1, 2] as FocusHops[]).map((h) => (
                <button
                  key={h}
                  type="button"
                  disabled={h > 0 && !selectedId}
                  onClick={() => setFocusHopsAndUrl(h)}
                  className={`rounded-md px-2.5 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    focusHops === h
                      ? 'bg-brand-primary/10 font-medium text-brand-primary'
                      : 'text-shell-muted hover:bg-shell-bg hover:text-shell-text'
                  }`}
                >
                  {h === 0 ? '全图' : `${h} 跳`}
                </button>
              ))}
            </div>

            <p className="truncate text-[11px] text-shell-muted">
              {focusHops > 0 && selectedId
                ? `${focusLabel} · ${graphNodes.length} 节点 · ${graphEdges.length} 边`
                : `${graphNodes.length} 节点 · ${graphEdges.length} 边`}
            </p>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => graphRef.current?.fitView()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-shell-muted hover:bg-shell-bg hover:text-shell-text"
              >
                <Maximize2 className="size-3.5" />
                适应
              </button>
              <button
                type="button"
                disabled={!selectedId}
                onClick={() => graphRef.current?.centerOnSelected()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-shell-muted hover:bg-shell-bg hover:text-shell-text disabled:opacity-40"
              >
                <Crosshair className="size-3.5" />
                居中
              </button>
            </div>
          </div>

          {allRelationTypes.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-shell-border px-3 py-2">
              <span className="text-[10px] text-shell-muted">关系类型</span>
              {allRelationTypes.map((type) => {
                const active =
                  activeRelationTypes.size === 0 ||
                  activeRelationTypes.size === allRelationTypes.length ||
                  activeRelationTypes.has(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleRelationType(type)}
                    className={`rounded-full px-2 py-0.5 text-[10px] transition-colors ${
                      active
                        ? 'bg-brand-primary/10 text-brand-primary'
                        : 'bg-shell-bg text-shell-muted line-through'
                    }`}
                  >
                    {relationLabel(type)}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {viaParam && detail ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-status-warning/30 bg-status-warning/8 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-shell-text">
              <Route className="size-3.5 shrink-0 text-status-warning" />
              <span className="truncate">
                {pathSteps > 1
                  ? `路径高亮：${detail.entity.name} → ${viaParam}（${pathSteps} 个节点）`
                  : pathSteps === 1
                    ? `${detail.entity.name} 与 ${viaParam} 为同一实体`
                    : `未找到 ${detail.entity.name} 到 ${viaParam} 的路径`}
              </span>
            </div>
            <button
              type="button"
              onClick={clearPathHighlight}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] text-shell-muted hover:bg-shell-bg"
            >
              <X className="size-3" />
              清除
            </button>
          </div>
        ) : null}

        <div className="relative min-h-0 flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="size-5 animate-spin text-shell-muted" />
            </div>
          ) : (
            <EntityGraphCanvas
              ref={graphRef}
              nodes={graphNodes}
              edges={graphEdges}
              selectedId={selectedId}
              highlightIds={highlightIds}
              pathNodeIds={pathHighlight.nodeIds}
              pathEdgeIds={pathHighlight.edgeIds}
              pathOrder={
                pathHighlight.order.edgeIds.length > 0 ? pathHighlight.order : undefined
              }
              autoFitOnLoad={focusHops === 0 && pathHighlight.edgeIds.size === 0}
              onSelect={(node) => selectByNodeId(node?.id ?? null)}
            />
          )}
        </div>
      </div>

      <aside className="flex w-72 shrink-0 flex-col overflow-y-auto">
        {loadingDetail ? (
          <div className="flex items-center gap-2 p-6 text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-[13px]">加载详情…</span>
          </div>
        ) : detail ? (
          <div className="space-y-6 p-5">
            <header>
              <p className="text-[11px] text-shell-muted">{typeLabel(detail.entity.entity_type)}</p>
              <h1 className="mt-1 text-[18px] font-semibold tracking-tight text-shell-text">
                {detail.entity.name}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {wikiUrl ? (
                  <Link
                    href={wikiUrl}
                    className="inline-flex items-center gap-1.5 text-[12px] text-brand-primary hover:underline"
                  >
                    Wiki 编译页
                    <ExternalLink className="size-3" />
                  </Link>
                ) : null}
              </div>
            </header>

            {Object.keys(detail.entity.attributes).length > 0 && (
              <section>
                <p className="text-[10px] font-medium tracking-wide text-shell-muted">属性</p>
                <dl className="mt-2 space-y-2">
                  {Object.entries(detail.entity.attributes).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 text-[12px]">
                      <dt className="text-shell-muted">{k}</dt>
                      <dd className="text-right font-medium text-shell-text">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {(detail.relations?.length ?? 0) > 0 ? (
              <section>
                <p className="text-[10px] font-medium tracking-wide text-shell-muted">
                  关系 · {detail.relations!.length}
                </p>
                <ul className="mt-2 space-y-2">
                  {detail.relations!.map((rel) => {
                    const neighborWiki = rel.neighbor_wiki_path
                      ? wikiUrlFromPath(rel.neighbor_wiki_path)
                      : null;
                    const isPathTarget = viaParam === rel.neighbor_name;
                    return (
                      <li
                        key={rel.id}
                        className={`rounded-lg border px-3 py-2 text-[12px] ${
                          isPathTarget
                            ? 'border-status-warning/40 bg-status-warning/8'
                            : 'border-shell-border'
                        }`}
                      >
                        <p className="font-medium text-shell-text">
                          {rel.direction === 'outgoing' ? '→' : '←'} {rel.neighbor_name}
                        </p>
                        <p className="mt-0.5 text-shell-muted">
                          {relationLabel(rel.relation_type)} · {typeLabel(rel.neighbor_type)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const neighbor = entities.find((e) => e.name === rel.neighbor_name);
                              if (neighbor) selectEntity(neighbor);
                            }}
                            className="text-brand-primary hover:underline"
                          >
                            聚焦
                          </button>
                          <button
                            type="button"
                            onClick={() => highlightPathTo(rel.neighbor_name)}
                            className="text-status-warning hover:underline"
                          >
                            路径
                          </button>
                          {neighborWiki ? (
                            <Link href={neighborWiki} className="text-shell-muted hover:underline">
                              Wiki
                            </Link>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : detail.neighbors.length > 0 ? (
              <section>
                <p className="text-[10px] font-medium tracking-wide text-shell-muted">
                  关联实体 · {detail.neighbors.length}
                </p>
                <ul className="mt-2 space-y-1">
                  {detail.neighbors.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => selectEntity(n)}
                        className="w-full rounded-lg px-2 py-2 text-left text-[12px] hover:bg-shell-bg"
                      >
                        <span className="text-shell-text">{n.name}</span>
                        <span className="ml-2 text-shell-muted">{typeLabel(n.entity_type)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="text-[14px] text-shell-muted">点击图谱节点或左侧列表</p>
            <p className="mt-2 text-[12px] text-shell-muted">
              Wiki 页可带 ?via= 跳转并高亮路径
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
