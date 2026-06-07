'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Building2,
  CalendarClock,
  CircleDot,
  FileText,
  MapPin,
  PackageSearch,
  Scale,
  Search,
  Truck,
  User,
} from 'lucide-react';
import type { LogisticsOrderStatus } from '@/types';
import { MOCK_LOGISTICS_ORDERS, searchMockOrders } from '@/lib/orderLookupMock';
import LogisticsMapDynamic from './LogisticsMapDynamic';

function statusBadgeClass(s: LogisticsOrderStatus): string {
  switch (s) {
    case 'delivered':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'in_transit':
    case 'out_for_delivery':
    case 'picked_up':
      return 'bg-sky-50 text-sky-900 border-sky-200';
    case 'exception':
      return 'bg-status-warning/10 text-status-warning border-status-warning/30';
    default:
      return 'bg-shell-panel-hover text-shell-subtext border-shell-border';
  }
}

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function OrderLookupView() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(MOCK_LOGISTICS_ORDERS[0]!.id);
  const [mapFitNonce, setMapFitNonce] = useState(1);

  const results = useMemo(() => searchMockOrders(query), [query]);
  const selected = useMemo(
    () => results.find((o) => o.id === selectedId) ?? results[0] ?? null,
    [results, selectedId],
  );

  useEffect(() => {
    if (selected?.id) setMapFitNonce((n) => n + 1);
  }, [selected?.id]);

  const orderRoutePolylines = useMemo(() => {
    if (!selected) return undefined;
    const layers: {
      id: string;
      positions: [number, number][];
      selected: boolean;
      dashArray?: string;
    }[] = [];
    if (selected.remainingPath.length >= 2) {
      layers.push({
        id: 'remainder',
        positions: selected.remainingPath,
        selected: false,
        dashArray: '7 10',
      });
    }
    if (selected.traveledPath.length >= 2) {
      layers.push({
        id: 'traveled',
        positions: selected.traveledPath,
        selected: true,
      });
    }
    return layers.length ? layers : undefined;
  }, [selected]);

  const orderRouteStops = useMemo(() => {
    if (!selected?.mapStops.length) return undefined;
    return selected.mapStops.map((s) => ({
      seq: s.seq,
      lat: s.lat,
      lng: s.lng,
      name: s.name,
    }));
  }, [selected]);

  const showOrderMap = Boolean(
    selected && (orderRoutePolylines?.length || orderRouteStops?.length),
  );
  const truckLoops = Boolean(selected && selected.traveledPath.length >= 2);

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-4 bg-surface-base p-4 sm:p-6">
      <div className="shrink-0">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-shell-text">
              <PackageSearch className="h-6 w-6" />
              <h2 className="text-xl font-black tracking-tight">出库管理</h2>
            </div>
            <p className="mt-1 max-w-xl text-xs font-medium text-shell-muted">
              <span className="text-shell-subtext">订单出库、发运轨迹与复核状态</span>
              <span className="mx-1.5 text-shell-subtext">·</span>
              支持出库单号、承运单号、采购单号、容器号等检索（演示数据）。
            </p>
          </div>
          <div className="relative mt-3 w-full max-w-md sm:mt-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-shell-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId(null);
              }}
              placeholder="出库单号、BOL、PO、托盘号…"
              className="w-full rounded-xl border border-shell-border bg-shell-panel py-2.5 pl-10 pr-4 text-[13px] font-medium text-shell-text shadow-sm placeholder:text-shell-muted focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
        <section className="flex max-h-[40vh] shrink-0 flex-col overflow-hidden rounded-xl border border-surface-border bg-shell-panel shadow-sm lg:max-h-none lg:w-[340px] lg:shrink-0">
          <div className="border-b border-shell-border-dim px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-shell-muted">
              检索结果 · {results.length}
            </p>
          </div>
          <div className="custom-scrollbar flex-1 overflow-y-auto">
            {results.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-[13px] font-bold text-shell-subtext">无匹配出库单</p>
                <p className="mt-1 text-[11px] text-shell-muted">换一个关键字或清空搜索。</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {results.map((o) => {
                  const on = selected?.id === o.id;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(o.id)}
                        className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition-colors ${
                          on ? 'bg-shell-panel-hover' : 'hover:bg-shell-bg'
                        }`}
                      >
                        <span className="font-mono text-[12px] font-black text-shell-text">{o.id}</span>
                        <span className="text-[11px] font-medium text-shell-muted line-clamp-1">
                          {o.origin} → {o.destination}
                        </span>
                        <span
                          className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-tight ${statusBadgeClass(o.status)}`}
                        >
                          {o.statusLabel}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="custom-scrollbar flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto rounded-xl border border-surface-border bg-shell-panel shadow-sm">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
              <Box className="h-10 w-10 text-shell-subtext" />
              <p className="mt-3 text-sm font-bold text-shell-subtext">Select an order</p>
            </div>
          ) : (
            <>
              <div className="border-b border-shell-border-dim bg-shell-bg/60 px-6 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-black text-shell-text">{selected.id}</p>
                    <p className="mt-1 text-[11px] font-medium text-shell-muted">
                      Created {fmtWhen(selected.createdIso)}
                      {selected.etaIso ? (
                        <>
                          {' '}
                          · ETA {fmtWhen(selected.etaIso)}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-black uppercase tracking-tight ${statusBadgeClass(selected.status)}`}
                  >
                    {selected.status === 'exception' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5" />
                    )}
                    {selected.statusLabel}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-shell-border bg-shell-panel px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-shell-muted">
                      <FileText className="h-3 w-3" />
                      BOL
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] font-bold text-shell-text">{selected.bol}</p>
                  </div>
                  <div className="rounded-lg border border-shell-border bg-shell-panel px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-shell-muted">
                      <FileText className="h-3 w-3" />
                      Customer PO
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] font-bold text-shell-text">{selected.customerPo}</p>
                  </div>
                  <div className="rounded-lg border border-shell-border bg-shell-panel px-3 py-2">
                    <p className="text-[9px] font-black uppercase tracking-wider text-shell-muted">Container</p>
                    <p className="mt-0.5 font-mono text-[12px] font-bold text-shell-text">
                      {selected.containerId ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-shell-border bg-shell-panel px-3 py-2">
                    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-shell-muted">
                      <Scale className="h-3 w-3" />
                      Weight / pcs
                    </p>
                    <p className="mt-0.5 text-[12px] font-bold text-shell-text">
                      {selected.weightLbs.toLocaleString()} lb · {selected.pieces} pkgs
                    </p>
                  </div>
                </div>
              </div>

              {showOrderMap ? (
                <div className="border-b border-shell-border-dim px-6 pb-5 pt-0">
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-shell-muted">
                    <MapPin className="h-4 w-4" />
                    Route map
                    <span className="font-normal normal-case text-shell-muted">
                      · 实线已走 / 虚线未走（演示）
                    </span>
                  </h3>
                  <div className="h-[min(22rem,42vh)] min-h-[220px] w-full overflow-hidden rounded-xl border border-shell-border bg-shell-panel-hover shadow-inner">
                    <LogisticsMapDynamic
                      height="100%"
                      vehicles={[]}
                      routePolylines={orderRoutePolylines}
                      routeStops={orderRouteStops}
                      routeTruckLoop={truckLoops}
                      routeMapFitKey={mapFitNonce}
                      routeOptimizeTick={0}
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-6 p-6 lg:grid-cols-2">
                <div>
                  <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-shell-muted">
                    <Building2 className="h-4 w-4" />
                    Parties & lane
                  </h3>
                  <dl className="mt-3 space-y-3 text-[13px]">
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-shell-muted">Shipper</dt>
                      <dd className="mt-0.5 font-semibold text-shell-text">{selected.shipper}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-shell-muted">Consignee</dt>
                      <dd className="mt-0.5 font-semibold text-shell-text">{selected.consignee}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-shell-muted">Lane</dt>
                      <dd className="mt-0.5 font-semibold text-shell-text">
                        {selected.origin} → {selected.destination}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-shell-muted">Commodity</dt>
                      <dd className="mt-0.5 font-medium text-shell-subtext">{selected.commodity}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-shell-muted">
                    <Truck className="h-4 w-4" />
                    Assignment
                  </h3>
                  <dl className="mt-3 space-y-3 text-[13px]">
                    <div>
                      <dt className="text-[10px] font-bold uppercase text-shell-muted">Asset</dt>
                      <dd className="mt-0.5 font-mono font-bold text-shell-text">
                        {selected.assignedUnitId ?? '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="flex items-center gap-1 text-[10px] font-bold uppercase text-shell-muted">
                        <User className="h-3 w-3" />
                        Driver
                      </dt>
                      <dd className="mt-0.5 font-semibold text-shell-text">{selected.driverName ?? '—'}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="border-t border-shell-border-dim px-6 py-5">
                <h3 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-shell-muted">
                  <CalendarClock className="h-4 w-4" />
                  Milestones & events
                </h3>
                <ol className="relative mt-4 space-y-0 border-l-2 border-shell-border pl-6">
                  {[...selected.events]
                    .sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime())
                    .map((ev, idx, arr) => (
                      <li key={ev.id} className={`relative pb-6 ${idx === arr.length - 1 ? 'pb-0' : ''}`}>
                        <span className="absolute -left-[9px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-slate-900 shadow" />
                        <p className="text-[12px] font-black text-shell-text">{ev.label}</p>
                        <p className="mt-0.5 font-mono text-[10px] font-bold text-shell-muted">{fmtWhen(ev.atIso)}</p>
                        {ev.location ? (
                          <p className="mt-0.5 text-[11px] font-medium text-shell-subtext">{ev.location}</p>
                        ) : null}
                        {ev.detail ? (
                          <p className="mt-1 text-[11px] leading-relaxed text-shell-muted">{ev.detail}</p>
                        ) : null}
                      </li>
                    ))}
                </ol>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
