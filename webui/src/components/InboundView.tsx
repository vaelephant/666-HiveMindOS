'use client';

import React from 'react';
import {
  ArrowDownToLine,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ScanLine,
  Package,
} from 'lucide-react';

export default function InboundView() {
  const tasks = [
    {
      id: 'ASN-2026-0842',
      type: '采购入库',
      qty: '1,240 箱',
      slot: '待分配 → A-12-03',
      stage: '质检中',
      stageTone: 'warning' as const,
    },
    {
      id: 'RTN-7781',
      type: '退货入库',
      qty: '86 件',
      slot: 'B-04-18',
      stage: '已上架',
      stageTone: 'success' as const,
    },
    {
      id: 'QC-9920',
      type: '质检入库',
      qty: '320 托',
      slot: '自动推荐 C-02-11',
      stage: '扫码上架',
      stageTone: 'neutral' as const,
    },
  ];

  return (
    <div className="flex h-full w-full bg-surface-base p-6 gap-6 overflow-hidden">
      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-shell-text tracking-tight">入库管理</h2>
            <p className="text-xs text-shell-muted font-medium mt-0.5">
              采购/退货/质检入库、扫码上架与自动分配库位（演示数据）。
            </p>
          </div>
          <button className="flex items-center space-x-2 px-3 py-2 border border-shell-border bg-shell-panel rounded-lg text-xs font-bold hover:bg-shell-bg shadow-sm">
            <Filter className="w-4 h-4" />
            <span>筛选单据</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '今日到仓车次', value: '18', sub: '+3 vs 昨日', tone: 'positive' as const, icon: ArrowDownToLine },
            {
              label: '待上架任务',
              value: '42',
              sub: '8 优先级',
              tone: 'negative' as const,
              icon: Clock,
              color: 'text-status-error',
            },
            { label: '自动库位命中率', value: '96.8%', sub: '近 7 日均值', tone: 'positive' as const, icon: ScanLine },
            { label: '质检一次通过率', value: '98.2%', sub: '目标 ≥ 97%', tone: 'positive' as const, icon: CheckCircle2 },
          ].map((stat, idx) => (
            <div
              key={idx}
              className="bg-shell-panel p-5 rounded-xl border border-surface-border shadow-sm hover:border-slate-300 transition-all"
            >
              <p className="text-[10px] font-black uppercase text-shell-muted tracking-widest mb-2 flex items-center gap-2">
                <stat.icon className="w-3 h-3" />
                {stat.label}
              </p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${stat.color || 'text-shell-text'}`}>{stat.value}</span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${
                    stat.tone === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  }`}
                >
                  {stat.sub}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-shell-panel rounded-xl border border-surface-border shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-shell-bg/50">
            <h3 className="text-sm font-black text-shell-text uppercase tracking-tight">入库单工作台</h3>
            <button className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white text-[11px] font-black uppercase rounded-lg hover:bg-black">
              <Download className="w-3.5 h-3.5" />
              导出
            </button>
          </div>
          <div className="overflow-x-auto overflow-y-auto custom-scrollbar flex-1">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-shell-bg/30 border-b border-surface-border text-[10px] font-black uppercase text-shell-muted">
                  <th className="px-6 py-3">单号</th>
                  <th className="px-6 py-3">类型</th>
                  <th className="px-6 py-3">数量</th>
                  <th className="px-6 py-3">库位建议</th>
                  <th className="px-6 py-3">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => (
                  <tr key={t.id} className="hover:bg-shell-bg/80 transition-colors">
                    <td className="px-6 py-4 text-[13px] font-mono font-bold text-shell-text">{t.id}</td>
                    <td className="px-6 py-4 text-[13px] text-shell-subtext">{t.type}</td>
                    <td className="px-6 py-4 text-[13px] text-shell-subtext">{t.qty}</td>
                    <td className="px-6 py-4 text-[13px] text-shell-subtext">{t.slot}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                          t.stageTone === 'success'
                            ? 'bg-emerald-50 text-emerald-800'
                            : t.stageTone === 'warning'
                              ? 'bg-status-warning/10 text-status-warning'
                              : 'bg-shell-panel-hover text-shell-subtext'
                        }`}
                      >
                        {t.stage}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside className="w-72 shrink-0 space-y-4">
        <div className="bg-shell-panel rounded-xl border border-surface-border p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-black text-shell-text uppercase tracking-wider">
            <Package className="w-4 h-4" />
            快速指引
          </div>
          <ul className="mt-4 space-y-3 text-[12px] text-shell-subtext leading-relaxed">
            <li className="flex gap-2">
              <AlertTriangle className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
              退货入库可走独立质检策略，优先级默认低于采购 ASN。
            </li>
            <li className="flex gap-2">
              <ScanLine className="w-4 h-4 text-shell-muted shrink-0 mt-0.5" />
              扫码上架后触发库存流水与托盘绑定（演示）。
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
