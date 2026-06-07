'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Zap,
  Layers,
  TrafficCone,
  CloudSun,
  AlertTriangle,
  CircleDollarSign,
  X,
  User,
  Truck,
  FlaskConical,
  Send,
  MoreVertical,
  CheckCircle2,
  Clock,
  GripVertical,
  Loader2,
} from 'lucide-react';
import LogisticsMap from './LogisticsMapDynamic';
import type {
  RoutePlanConstraint,
  RoutePlanOptimizeResponse,
  RoutePlanProfile,
  RoutePlanProfileId,
  RoutePlanStop,
  RoutePlanStopType,
} from '@/types';

function formatStopType(t: RoutePlanStopType): string {
  switch (t) {
    case 'pickup':
      return '取货';
    case 'rest':
      return '暂存';
    case 'dropoff':
      return '复核/投放';
    case 'fuel':
      return '补给';
    case 'relay':
      return '接力点';
  }
}

function stopBadgeClass(t: RoutePlanStopType): string {
  switch (t) {
    case 'pickup':
      return 'bg-emerald-500';
    case 'rest':
      return 'bg-blue-500';
    case 'dropoff':
      return 'bg-orange-500';
    case 'fuel':
      return 'bg-brand-bright';
    case 'relay':
      return 'bg-violet-500';
  }
}

function constraintIcon(kind: RoutePlanConstraint['kind']) {
  switch (kind) {
    case 'driver':
      return User;
    case 'vehicle':
      return Truck;
    case 'hazmat':
      return FlaskConical;
  }
}

function constraintStatusIcon(c: RoutePlanConstraint) {
  if (c.status === 'ok') return CheckCircle2;
  if (c.status === 'warn') return Clock;
  return AlertTriangle;
}

function parseRevenueUsd(raw: string): number {
  const n = Number.parseFloat(raw.replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function fmtUsd(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

export default function RoutePlanningView() {
  const [plan, setPlan] = useState<RoutePlanOptimizeResponse | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<RoutePlanProfileId>('fastest');
  const [optimizing, setOptimizing] = useState(false);
  const [freightRevenueRaw, setFreightRevenueRaw] = useState('3500');
  const [layerUi, setLayerUi] = useState({
    traffic: true,
    weather: true,
    restrictions: true,
    tolls: true,
  });
  const [toast, setToast] = useState<string | null>(null);
  const [optimizeTick, setOptimizeTick] = useState(0);

  const fetchPlan = useCallback(async (): Promise<RoutePlanOptimizeResponse> => {
    const res = await fetch('/api/route-plan/optimize', { method: 'POST' });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json() as Promise<RoutePlanOptimizeResponse>;
  }, []);

  /** Initial load: sidebar data only — map stays empty until user clicks AI Optimize. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPlan();
        if (cancelled) return;
        setPlan(data);
        setSelectedProfileId(data.defaultProfileId);
      } catch {
        if (!cancelled) setToast('Could not load route plan. Retry.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPlan]);

  const runAiOptimize = useCallback(async () => {
    setOptimizing(true);
    try {
      const data = await fetchPlan();
      setPlan(data);
      setSelectedProfileId(data.defaultProfileId);
      setOptimizeTick((n) => n + 1);
    } catch {
      setToast('Could not load route plan. Retry.');
    } finally {
      setOptimizing(false);
    }
  }, [fetchPlan]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const activeProfile: RoutePlanProfile | null = useMemo(() => {
    if (!plan?.profiles.length) return null;
    return plan.profiles.find((p) => p.id === selectedProfileId) ?? plan.profiles[0] ?? null;
  }, [plan, selectedProfileId]);

  const freightUsd = parseRevenueUsd(freightRevenueRaw);

  const netProfitUsd = useMemo(() => {
    if (!activeProfile) return 0;
    return (
      freightUsd - activeProfile.tollUsd - activeProfile.fuelUsd - activeProfile.timeCostUsd
    );
  }, [freightUsd, activeProfile]);

  const dispatchBlocked = plan?.constraints.some((c) => c.status === 'block') ?? false;

  const routePolylines = useMemo(() => {
    if (!plan?.profiles.length) return undefined;
    return plan.profiles.map((p) => ({
      id: p.id,
      positions: p.polyline as [number, number][],
      selected: p.id === selectedProfileId,
    }));
  }, [plan, selectedProfileId]);

  const routeStops = useMemo(() => {
    if (!plan?.stops.length) return undefined;
    return plan.stops.map((s: RoutePlanStop) => ({
      seq: s.sequence,
      lat: s.lat,
      lng: s.lng,
      name: s.name,
    }));
  }, [plan]);

  const profileCard = (p: RoutePlanProfile, highlight: boolean) => {
    const Icon = p.id === 'fastest' ? Zap : CircleDollarSign;
    const estOp = p.tollUsd + p.fuelUsd + p.timeCostUsd;
    return (
      <button
        key={p.id}
        type="button"
        onClick={() => setSelectedProfileId(p.id)}
        className={`rounded-xl p-4 text-left shadow-xl transition-all w-48 ${
          highlight
            ? 'border-2 border-brand-primary bg-shell-panel ring-2 ring-slate-900/10'
            : 'border border-shell-border bg-shell-panel/90 opacity-80 hover:opacity-100'
        }`}
      >
        <div className="mb-2 flex items-start justify-between">
          <span
            className={`text-[10px] font-black uppercase tracking-widest ${highlight ? 'text-shell-text' : 'text-shell-muted'}`}
          >
            {p.id === 'fastest' ? '最短动线' : '最低成本'}
          </span>
          <Icon className={`h-4 w-4 ${highlight ? 'text-shell-text' : 'text-shell-muted'}`} />
        </div>
        <div className={`text-xl font-black ${highlight ? 'text-shell-text' : 'text-shell-subtext'}`}>
          {p.durationLabel}
        </div>
        <div className="text-[10px] font-bold text-shell-muted">{fmtUsd(estOp)} operating · mock</div>
      </button>
    );
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-shell-bg">
      <div className="relative flex-1 bg-shell-border">
        <LogisticsMap
          vehicles={[]}
          routePolylines={routePolylines}
          routeStops={routeStops}
          routeOptimizeLoading={optimizing}
          routeOptimizeTick={optimizeTick}
        />
        {optimizing ? (
          <div
            className="pointer-events-none absolute inset-0 z-[440] bg-gradient-to-b from-slate-900/[0.045] via-transparent to-blue-900/[0.06]"
            aria-hidden
          />
        ) : null}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent" />

        <div className="absolute left-4 top-4 z-10 flex flex-col space-y-2">
          <button
            type="button"
            title="Map layers (mock)"
            className="rounded border border-shell-border bg-shell-panel/95 p-2 shadow-lg backdrop-blur transition-colors hover:bg-shell-panel"
          >
            <Layers className="h-4 w-4 text-shell-subtext" />
          </button>
        </div>

        <div className="absolute left-16 top-4 z-10 flex flex-wrap gap-2">
              {(
            [
              { key: 'traffic' as const, icon: TrafficCone, label: '动线', color: 'text-blue-600' },
              { key: 'weather' as const, icon: CloudSun, label: '环境', color: 'text-sky-400' },
              {
                key: 'restrictions' as const,
                icon: AlertTriangle,
                label: '限制',
                color: 'text-status-error',
              },
              { key: 'tolls' as const, icon: CircleDollarSign, label: '成本', color: 'text-status-warning' },
            ] as const
          ).map((item) => {
            const on = layerUi[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setLayerUi((s) => ({ ...s, [item.key]: !s[item.key] }))}
                className={`flex items-center space-x-2 rounded-lg border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest shadow-sm transition-all ${
                  on
                    ? 'border-brand-primary bg-shell-panel text-shell-text'
                    : 'border-shell-border bg-shell-panel/80 text-shell-muted opacity-70'
                }`}
              >
                <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="absolute bottom-6 left-6 z-10 flex flex-wrap gap-4">
          {plan?.profiles.map((p) => profileCard(p, p.id === selectedProfileId))}
        </div>
      </div>

      <aside className="z-10 flex w-[400px] shrink-0 flex-col overflow-hidden border-l border-surface-border bg-shell-panel shadow-2xl">
        <div className="border-b border-shell-border-dim p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-[20px] font-black text-shell-text">智能库位 · 任务编排</h2>
            <button
              type="button"
              className="rounded-full p-1.5 text-shell-muted transition-colors hover:bg-shell-panel-hover"
              aria-label="More"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            disabled={optimizing}
            onClick={() => void runAiOptimize()}
            className="flex w-full items-center justify-center space-x-3 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-black active:scale-[0.98] disabled:opacity-60"
          >
            {optimizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            <span>AI 重新推荐方案</span>
          </button>
        </div>

        <div className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-6">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-shell-muted">
                推荐拣货 / 上架顺序
              </h3>
              <button
                type="button"
                disabled
                title="即将推出"
                className="cursor-not-allowed text-[10px] font-black uppercase text-shell-subtext"
              >
                + 添加节点
              </button>
            </div>
            <div className="space-y-3">
              {plan?.stops.map((stop: RoutePlanStop) => (
                <div
                  key={stop.id}
                  className="group flex items-center space-x-4 rounded-xl border border-shell-border bg-shell-bg/80 p-3 transition-all hover:border-slate-300"
                >
                  <div className="cursor-grab text-shell-subtext" aria-hidden>
                    <GripVertical className="h-4 w-4" />
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white shadow-md">
                    {stop.sequence}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-shell-text">{stop.name}</div>
                    <div className="mt-1 flex items-center space-x-1.5 text-[10px] font-bold text-shell-muted">
                      <span className={`h-1.5 w-1.5 rounded-full ${stopBadgeClass(stop.type)}`} />
                      <span className="uppercase tracking-tight">
                        {formatStopType(stop.type)} · 预估 {stop.estTimeLabel}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="pr-1 text-slate-200"
                    aria-label="Remove stop"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!plan?.stops.length && !optimizing ? (
                <p className="text-xs text-shell-muted">暂无推荐节点，请先运行 AI。</p>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-shell-muted">
              约束检查（周转 / 温控 / 货类）
            </h3>
            <div className="space-y-3">
              {plan?.constraints.map((c) => {
                const RowIcon = constraintIcon(c.kind);
                const StatusIcon = constraintStatusIcon(c);
                const warn = c.status === 'warn';
                const bad = c.status === 'block';
                return (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
                      bad
                        ? 'border-red-200 bg-red-50/40'
                        : warn
                          ? 'border-orange-200 bg-orange-50/30'
                          : 'border-shell-border hover:border-emerald-200 hover:bg-emerald-50/10'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <RowIcon
                        className={`h-5 w-5 ${warn ? 'text-orange-600' : bad ? 'text-red-600' : 'text-shell-muted'}`}
                      />
                      <div>
                        <div className="text-xs font-bold text-shell-text">{c.title}</div>
                        <div
                          className={`text-[10px] font-black uppercase tracking-tighter ${
                            warn ? 'text-orange-600' : bad ? 'text-red-600' : 'text-emerald-600'
                          }`}
                        >
                          {c.subtitle}
                        </div>
                      </div>
                    </div>
                    <StatusIcon
                      className={`h-5 w-5 shrink-0 ${
                        c.status === 'ok'
                          ? 'text-emerald-500'
                          : c.status === 'warn'
                            ? 'text-orange-400'
                            : 'text-red-500'
                      }`}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-widest text-shell-muted">
              成本与效率预估
            </h3>
            <div className="mb-3">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-shell-muted">
                单波次货值（演示）
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-shell-muted">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={freightRevenueRaw}
                  onChange={(e) => setFreightRevenueRaw(e.target.value)}
                  className="w-full rounded-xl border border-shell-border bg-shell-panel py-2.5 pl-8 pr-3 text-sm font-bold text-shell-text shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
                  placeholder="3500"
                />
              </div>
              <p className="mt-1 text-[9px] text-shell-muted">
                净效 = 货值 − 堆叠/路径惩罚 − 设备能耗 − 人时（示意，随所选方案变化）
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex h-28 flex-col justify-between rounded-xl bg-slate-900 p-5 text-white shadow-xl">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-shell-muted">
                  预估净收益
                </div>
                <div className="text-3xl font-black">{fmtUsd(netProfitUsd)}</div>
              </div>
              <div className="rounded-xl border border-shell-border bg-shell-bg p-4 shadow-sm">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-shell-muted">
                  堆叠 / 路径惩罚
                </div>
                <div className="text-lg font-black text-shell-text">
                  {activeProfile ? fmtUsd(activeProfile.tollUsd) : '—'}
                </div>
              </div>
              <div className="rounded-xl border border-shell-border bg-shell-bg p-4 shadow-sm">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-shell-muted">
                  设备能耗（估）
                </div>
                <div className="text-lg font-black text-shell-text">
                  {activeProfile ? fmtUsd(activeProfile.fuelUsd) : '—'}
                </div>
              </div>
              <div className="col-span-2 rounded-xl border border-shell-border bg-shell-bg p-4 shadow-sm">
                <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-shell-muted">
                  拣选人时成本
                </div>
                <div className="text-lg font-black text-shell-text">
                  {activeProfile ? fmtUsd(activeProfile.timeCostUsd) : '—'}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-2 border-t border-shell-border bg-shell-bg p-6">
          {toast ? (
            <p className="rounded-lg border border-shell-border bg-shell-panel px-3 py-2 text-center text-[11px] text-shell-subtext">
              {toast}
            </p>
          ) : null}
          <button
            type="button"
            disabled={dispatchBlocked || !plan}
            onClick={() => setToast('已下发至 WMS / PDA（演示）。')}
            className="flex w-full items-center justify-center space-x-3 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-xl transition-all hover:bg-black active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>下发执行方案</span>
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setToast('方案已本地保存（演示）。')}
              className="rounded-xl border border-slate-300 bg-shell-panel py-3 text-[11px] font-bold uppercase tracking-widest text-shell-text shadow-sm transition-all hover:bg-shell-bg"
            >
              保存方案
            </button>
            <button
              type="button"
              onClick={() => setToast('已排队通知班组（演示）。')}
              className="rounded-xl border border-slate-300 bg-shell-panel py-3 text-[11px] font-bold uppercase tracking-widest text-shell-text shadow-sm transition-all hover:bg-shell-bg"
            >
              通知班组
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
