'use client';

import React, { useMemo } from 'react';
import { 
  Truck, 
  AlertTriangle, 
  CheckCircle2, 
  CircleDollarSign, 
  Map as MapIcon,
  Plus,
  Minus,
  Download,
  Snowflake,
  Wrench,
  Info,
  History
} from 'lucide-react';
import { motion } from 'motion/react';
import LogisticsMap from './LogisticsMapDynamic';
import { useFleetSnapshot } from '@/hooks/useFleetSnapshot';
import type { FleetVehicle } from '@/types';

export default function DashboardView() {
  const { snapshot, vehicles, loading, error } = useFleetSnapshot(96, {
    mode: 'sse',
    streamIntervalMs: 2000,
  });
  const summary = snapshot?.summary;

  const kpis = useMemo(
    () => [
      { label: '在库 SKU', value: snapshot ? String(snapshot.count) : '—', trend: '+3.1%', trendType: 'positive' as const, icon: Truck },
      {
        label: '预警 / 异常行',
        value: summary ? String(summary.warning + summary.error) : '—',
        trend: summary && summary.warning + summary.error > 6 ? '关注' : '平稳',
        trendType: summary && summary.warning + summary.error > 6 ? ('negative' as const) : ('positive' as const),
        icon: AlertTriangle,
        color: 'text-status-error',
      },
      { label: '准时出库率', value: '94.2%', trend: '目标 ≥93%', trendType: 'positive' as const, icon: CheckCircle2, color: 'text-emerald-500' },
      { label: '库容利用率', value: '81%', trend: '+2.1%', trendType: 'positive' as const, icon: CircleDollarSign },
      { label: '拣货人效', value: '118/h', trend: '+6', trendType: 'positive' as const, icon: MapIcon },
    ],
    [snapshot, summary],
  );

  const legend = useMemo(() => {
    if (!summary) {
      return { idle: '—', inMotion: '—', delayed: '—' };
    }
    return {
      idle: String(summary.idle),
      inMotion: String(summary.inMotion),
      delayed: String(summary.warning + summary.error),
    };
  }, [summary]);

  const highlightTruck = useMemo(() => {
    const trouble = vehicles.find(
      (v) => v.telemetryStatus === 'warning' || v.telemetryStatus === 'error',
    );
    return trouble ?? vehicles[0];
  }, [vehicles]);

  const tableRows = useMemo(() => {
    if (!snapshot || vehicles.length === 0) return [];
    const rank = (v: FleetVehicle) =>
      v.telemetryStatus === 'error' ? 0 : v.telemetryStatus === 'warning' ? 1 : 2;
    return [...vehicles].sort((a, b) => rank(a) - rank(b)).slice(0, 5).map((v) => {
      const ordSuffix = v.id.replace(/\D/g, '').slice(-5).padStart(5, '0');
      let eta = '已排程';
      let etaColor = '';
        if (v.telemetryStatus === 'error') {
        eta = '数据中断';
        etaColor = 'text-status-error';
      } else if (v.motionLabel === 'Delayed') {
        eta = '延迟 +波动';
        etaColor = 'text-status-error';
      }
      let risk = 'LOW (12)';
      let riskColor = 'bg-emerald-100 text-emerald-800';
      if (v.telemetryStatus === 'error') {
        risk = 'CRIT (91)';
        riskColor = 'bg-red-100 text-red-800';
      } else if (v.telemetryStatus === 'warning') {
        risk = 'HIGH (76)';
        riskColor = 'bg-orange-100 text-orange-800';
      } else if (v.speedMph > 62) {
        risk = 'MEDIUM (44)';
        riskColor = 'bg-orange-100 text-orange-800';
      }
      return {
        id: `ORD-${ordSuffix}`,
        name: v.driverName,
        truck: v.makeModel,
        route: `${v.corridorLabel}`,
        eta,
        etaColor,
        risk,
        riskColor,
      };
    });
  }, [snapshot, vehicles]);

  return (
    <div className="flex h-full w-full">
      {/* Left Area Scrollable Content */}
      <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto custom-scrollbar bg-shell-bg/30">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-shell-panel p-4 rounded-xl border border-surface-border shadow-sm hover:border-slate-300 transition-all group">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-shell-muted">{kpi.label}</span>
                <kpi.icon className={`w-4 h-4 ${kpi.color || 'text-shell-muted'}`} />
              </div>
              <div className={`text-2xl font-bold ${kpi.color || 'text-shell-text'}`}>{kpi.value}</div>
              <div className="text-[10px] mt-1 flex items-center space-x-1">
                <span className={`${kpi.trendType === 'positive' ? 'text-emerald-600' : 'text-status-error'} font-bold`}>{kpi.trend}</span>
                <span className="text-shell-muted">vs 昨日</span>
              </div>
            </div>
          ))}
        </div>
        {loading && !snapshot ? (
          <p className="text-xs text-shell-muted -mt-4">正在加载模拟库内状态…</p>
        ) : null}

        {/* Central Map Area */}
        <div className="flex-1 min-h-[450px] relative rounded-xl border border-surface-border bg-shell-border overflow-hidden group shadow-lg">
          {error ? (
            <div className="absolute inset-0 z-[500] flex items-center justify-center bg-shell-panel/90 text-sm text-red-700 px-6 text-center">
              无法加载库内数据：{error.message}
            </div>
          ) : null}
          <LogisticsMap vehicles={vehicles} />

          {/* Legend Overlay */}
          <div className="absolute bottom-4 left-4 bg-shell-panel/95 backdrop-blur-sm p-4 border border-surface-border rounded-lg shadow-xl">
            <p className="text-[10px] font-bold uppercase text-shell-muted mb-3 tracking-widest">
              库内动态图例
              {snapshot ? (
                <span className="block normal-case font-medium text-shell-muted mt-1 tracking-normal">
                  模拟实时状态（服务端）·{' '}
                  {snapshot.serverTimeMs != null
                    ? new Date(snapshot.serverTimeMs).toLocaleTimeString()
                    : new Date(snapshot.generatedAt).toLocaleTimeString()}
                </span>
              ) : null}
            </p>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-900 shadow-[0_0_8px_rgba(0,0,0,0.2)]" />
                <span className="text-[11px] font-semibold text-shell-subtext">
                  空闲库位 / 待命 ({legend.idle})
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                <span className="text-[11px] font-semibold text-shell-subtext">
                  作业中 ({legend.inMotion})
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-status-error shadow-[0_0_8px_rgba(186,26,26,0.3)]" />
                <span className="text-[11px] font-semibold text-shell-subtext">
                  需关注 ({legend.delayed})
                </span>
              </div>
            </div>
          </div>

          {/* Floating Tooltip Example */}
          {highlightTruck ? (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 bg-shell-panel/90 backdrop-blur p-2.5 rounded-lg shadow-2xl border border-shell-border flex items-center space-x-3"
            >
              <div
                className={`w-2 h-2 rounded-full animate-pulse ${
                  highlightTruck.telemetryStatus === 'error'
                    ? 'bg-status-error'
                    : highlightTruck.telemetryStatus === 'warning'
                      ? 'bg-status-warning'
                      : 'bg-emerald-500'
                }`}
              />
              <span className="text-[11px] font-black text-shell-text">
                {highlightTruck.id}: {highlightTruck.corridorLabel} · {highlightTruck.motionLabel}
              </span>
            </motion.div>
          ) : null}
        </div>

        {/* Active Transmissions Table */}
        <div className="bg-shell-panel border border-surface-border rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-shell-bg/50">
            <h3 className="text-sm font-black text-shell-text flex items-center space-x-2">
              <span>在途出库 / 波次</span>
              <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[10px] rounded">实时</span>
            </h3>
            <button className="text-[10px] font-bold text-shell-text flex items-center space-x-1.5 hover:underline uppercase tracking-tight">
              <span>导出 CSV</span>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-shell-bg/50 border-b border-surface-border">
                  <th className="px-6 py-3 text-[10px] font-bold text-shell-muted uppercase tracking-widest">出库单</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-shell-muted uppercase tracking-widest">拣货员</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-shell-muted uppercase tracking-widest">载具</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-shell-muted uppercase tracking-widest">动线</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-shell-muted uppercase tracking-widest">截单/发运</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-shell-muted uppercase tracking-widest text-right">积压风险</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-shell-bg/80 transition-colors">
                    <td className="px-6 py-4 text-[13px] font-bold font-mono text-shell-text">{row.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-shell-panel-hover flex items-center justify-center text-[9px] font-black border border-shell-border">
                          {row.name.split(' ').map(n=>n[0]).join('')}
                        </div>
                        <span className="text-[13px] font-medium text-shell-subtext">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[13px] text-shell-subtext">{row.truck}</td>
                    <td className="px-6 py-4 text-[13px] text-shell-subtext">{row.route}</td>
                    <td className={`px-6 py-4 text-[13px] font-bold ${row.etaColor || 'text-shell-text'}`}>{row.eta}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-tight ${row.riskColor}`}>{row.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Right Sidebar: Alert Center */}
      <aside className="hidden lg:flex w-80 bg-shell-panel border-l border-surface-border flex-col shrink-0">
        <div className="p-6 border-b border-surface-border flex justify-between items-center bg-shell-bg/30">
          <h2 className="text-xs font-black uppercase tracking-widest text-shell-text">预警中心</h2>
          <span className="bg-status-error text-white text-[10px] font-black px-2 py-0.5 rounded-full">3 条新</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* Compliance Alert */}
          <div className="bg-red-50/50 border-l-4 border-status-error p-4 rounded-r-lg shadow-sm border border-shell-border-dim transition-transform hover:translate-x-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-status-error">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">效期 / 合规风险</span>
              </div>
              <span className="text-[10px] text-shell-muted">2 分钟前</span>
            </div>
            <p className="text-[13px] font-bold text-shell-text">批次 B-8821 将在 48h 内到期（库位 C-04-12）</p>
            <p className="text-[11px] text-shell-muted mt-1 leading-relaxed">建议冻结该批次出库并触发退供应商或降价处理工单。</p>
            <button className="mt-3 w-full py-2 bg-status-error text-white text-[11px] font-bold rounded-lg hover:bg-red-700 transition-all shadow-md active:scale-[0.98]">
              一键生成移库指令
            </button>
          </div>

          {/* Weather Alert */}
          <div className="bg-status-warning/10 border-l-4 border-status-warning p-4 rounded-r-lg shadow-sm border border-shell-border-dim transition-transform hover:translate-x-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-status-warning">
                <Snowflake className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">库区拥堵</span>
              </div>
              <span className="text-[10px] text-shell-muted">14 分钟前</span>
            </div>
            <p className="text-[13px] font-bold text-shell-text">A 区出库道口排队 &gt; 25 分钟</p>
            <p className="text-[11px] text-shell-muted mt-1 leading-relaxed">波次 #W-12 可能影响截单窗口，可向 B 道口分流两车。</p>
            <div className="mt-3 flex space-x-2">
              <button className="flex-1 py-1.5 bg-status-warning text-white text-[11px] font-bold rounded-lg hover:opacity-90">热力图</button>
              <button className="p-1.5 border border-status-warning/30 text-status-warning rounded-lg hover:bg-status-warning/15 transition-colors">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
          </div>

          {/* Maintenance Alert */}
          <div className="bg-shell-bg/80 border-l-4 border-slate-500 p-4 rounded-r-lg shadow-sm border border-shell-border-dim">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-shell-subtext">
                <Wrench className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider">设备维保</span>
              </div>
              <span className="text-[10px] text-shell-muted">1 小时前</span>
            </div>
            <p className="text-[13px] font-bold text-shell-text">2# AGV 电池健康度偏低</p>
            <button className="mt-3 w-full py-2 border border-slate-300 text-shell-subtext text-[11px] font-bold rounded-lg hover:bg-shell-panel transition-colors">
              预约检修窗口
            </button>
          </div>

          {/* Fleet Update */}
          <div className="p-4 border border-shell-border-dim rounded-xl bg-shell-bg/30 flex items-start space-x-3">
            <Info className="w-4 h-4 text-shell-muted shrink-0 mt-0.5" />
            <p className="text-[11px] text-shell-subtext">昨夜 34 台 PDA / 扫码枪已成功推送固件与安全补丁。</p>
          </div>
        </div>

        <div className="p-4 bg-shell-bg border-t border-surface-border">
          <button className="w-full py-2.5 bg-shell-panel border border-surface-border text-[12px] font-bold text-shell-subtext hover:bg-shell-panel-hover transition-all rounded-lg flex items-center justify-center space-x-2 shadow-sm">
            <span>全部标记已读</span>
            <History className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </div>
  );
}
