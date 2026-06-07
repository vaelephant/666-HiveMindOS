'use client';

import React from 'react';
import {
  Boxes,
  Search,
  Filter,
  MoreVertical,
  Download,
  Printer,
  QrCode,
  Layers,
  MapPin,
} from 'lucide-react';

export default function MasterDataView() {
  const rows = [
    {
      name: '华东中心仓',
      zone: 'A 区 · 重型货架',
      bins: '1,248 库位',
      pallets: '312 托盘在架',
      codes: '条码/二维码 OK',
      health: 'success' as const,
    },
    {
      name: '华东中心仓',
      zone: 'B 区 · 流利架',
      bins: '860 库位',
      pallets: '198 托盘在架',
      codes: '2 托盘待补码',
      health: 'warning' as const,
    },
    {
      name: '华东中心仓',
      zone: 'C 区 · 冷藏',
      bins: '420 库位',
      pallets: '76 托盘在架',
      codes: '箱码同步中',
      health: 'success' as const,
    },
    {
      name: '前置仓 · 浦东',
      zone: '拣货区',
      bins: '186 库位',
      pallets: '44 托盘在架',
      codes: '电子标签在线',
      health: 'success' as const,
    },
  ];

  return (
    <div className="flex h-full w-full bg-surface-base p-6 gap-6 overflow-hidden">
      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-shell-text tracking-tight">仓库基础管理</h2>
            <p className="text-xs text-shell-muted font-medium mt-0.5">
              仓库、库区、货架、库位、托盘与条码/二维码主数据。
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select className="text-xs border-shell-border rounded-lg px-3 py-2 bg-shell-panel font-bold text-shell-text focus:ring-1 focus:ring-slate-300">
              <option>全部仓库</option>
              <option>华东中心仓</option>
              <option>前置仓 · 浦东</option>
            </select>
            <button className="flex items-center space-x-2 px-3 py-2 bg-shell-panel border border-shell-border rounded-lg text-xs font-bold text-shell-text hover:bg-shell-bg shadow-sm transition-all">
              <Filter className="w-4 h-4" />
              <span>筛选</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '已启用库位', value: '2,714', trend: '+38 本周', trendType: 'positive' as const },
            { label: '托盘主数据', value: '4,902', trend: '同步正常', trendType: 'positive' as const },
            { label: '条码异常', value: '07', trend: '待复核', trendType: 'negative' as const, color: 'text-status-error' },
            { label: '二维码覆盖率', value: '99.1%', trendType: 'positive' as const, progress: 99 },
          ].map((stat, idx) => (
            <div key={idx} className="bg-shell-panel p-5 rounded-xl border border-surface-border shadow-sm">
              <p className="text-[10px] font-black uppercase text-shell-muted tracking-widest mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${stat.color || 'text-shell-text'}`}>{stat.value}</span>
                {stat.trend && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                      stat.trendType === 'positive'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {stat.trend}
                  </span>
                )}
                {stat.progress != null ? (
                  <div className="w-16 h-1.5 bg-shell-panel-hover rounded-full overflow-hidden mb-1.5">
                    <div className="bg-slate-900 h-full" style={{ width: `${stat.progress}%` }} />
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-shell-panel rounded-xl border border-surface-border shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-shell-bg/50">
            <h3 className="text-xs font-black uppercase tracking-wider text-shell-text">
              库区 / 货架 / 库位一览
            </h3>
            <div className="flex space-x-2">
              <button type="button" className="p-1.5 hover:bg-shell-border rounded-lg transition-colors">
                <Download className="w-4 h-4 text-shell-muted" />
              </button>
              <button type="button" className="p-1.5 hover:bg-shell-border rounded-lg transition-colors">
                <Printer className="w-4 h-4 text-shell-muted" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-shell-bg/30 text-shell-muted text-[10px] font-black uppercase tracking-widest border-b border-surface-border">
                  <th className="px-6 py-4">仓库</th>
                  <th className="px-6 py-4">库区 / 货架</th>
                  <th className="px-6 py-4">库位</th>
                  <th className="px-6 py-4">在库托盘</th>
                  <th className="px-6 py-4">码制状态</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-shell-bg transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                          <Boxes className="w-4 h-4" />
                        </div>
                        <span className="text-[13px] font-black text-shell-text">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-[13px] font-bold text-shell-subtext">{row.zone}</td>
                    <td className="px-6 py-5 text-[13px] font-mono text-shell-subtext">{row.bins}</td>
                    <td className="px-6 py-5 text-[13px] text-shell-subtext">{row.pallets}</td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                          row.health === 'warning' ? 'text-status-warning' : 'text-emerald-700'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        {row.codes}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button type="button" className="text-shell-muted hover:text-shell-text transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-shell-bg border-t border-shell-border-dim flex justify-between items-center text-[11px] font-bold text-shell-muted">
            <span>主数据 · 演示数据</span>
            <div className="flex space-x-2">
              <button
                type="button"
                className="px-4 py-1.5 border border-shell-border rounded-lg hover:bg-shell-panel transition-all shadow-sm"
              >
                上一页
              </button>
              <button
                type="button"
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-black transition-all shadow-md"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="w-80 flex flex-col space-y-6 shrink-0">
        <div className="bg-shell-panel rounded-xl border border-surface-border flex flex-col h-full shadow-sm">
          <div className="px-5 py-4 border-b border-shell-border-dim bg-shell-bg/50 flex items-center space-x-3">
            <Layers className="w-5 h-5 text-shell-text" />
            <h3 className="font-black text-shell-text text-xs uppercase tracking-widest">主数据任务</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-shell-muted" />
              <input
                type="text"
                placeholder="搜索库位 / 托盘号…"
                className="w-full rounded-lg border border-shell-border bg-shell-panel py-2 pl-10 pr-3 text-xs font-medium"
              />
            </div>
            <section>
              <h4 className="text-[10px] font-black text-shell-muted uppercase tracking-widest mb-3">待办</h4>
              <div className="space-y-3">
                <div className="p-3 rounded-xl border border-shell-border-dim bg-shell-bg/50">
                  <div className="flex items-center gap-2 text-[11px] font-black text-shell-text">
                    <MapPin className="w-4 h-4 text-shell-muted" />
                    新建 C 区流利架 40 库位
                  </div>
                  <p className="text-[10px] text-shell-muted mt-1">与 WMS 主数据模板对齐后发布</p>
                </div>
                <div className="p-3 rounded-xl border border-status-warning/20 bg-status-warning/5">
                  <div className="text-[11px] font-black text-status-warning">箱码映射 · 供应商批次</div>
                  <p className="text-[10px] text-shell-subtext mt-1">12 条待人工确认</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  );
}
