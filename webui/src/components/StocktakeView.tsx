'use client';

import React from 'react';
import {
  ClipboardCheck,
  Search,
  Filter,
  TrendingUp,
  MoreVertical,
  Download,
  Printer,
  AlertTriangle,
  Gauge,
  CheckCircle2,
  History,
  FileText,
  Calendar,
  ScanLine,
} from 'lucide-react';

export default function StocktakeView() {
  const rows = [
    {
      batch: 'STK-D-240501',
      type: '日常盘点 · A 区',
      owner: '班组 A · 王明',
      progress: '62%',
      variance: '+12 SKU 差异待核',
      varianceType: 'warning' as const,
      sync: ['已扫码', '电子标签'],
    },
    {
      batch: 'STK-C-240428',
      type: '周期盘点 · 冷藏',
      owner: '班组 C · 李倩',
      progress: '100%',
      variance: '无差异',
      varianceType: 'ok' as const,
      sync: ['已关闭', '锁定释放'],
    },
    {
      batch: 'STK-B-240502',
      type: '动碰盘点 · 流利架',
      owner: '班组 B · 赵磊',
      progress: '18%',
      variance: '3 货位账实不符',
      varianceType: 'error' as const,
      sync: ['扫码中', '待复盘'],
    },
    {
      batch: 'STK-A-240503',
      type: '抽盘 · 高值',
      owner: '班组 A · 陈晨',
      progress: '40%',
      variance: '待计算',
      varianceType: 'neutral' as const,
      sync: ['任务中'],
    },
  ];

  return (
    <div className="flex h-full w-full bg-surface-base p-6 gap-6 overflow-hidden">
      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-shell-text tracking-tight">盘点管理</h2>
            <p className="text-xs text-shell-muted font-medium mt-0.5">
              日常/周期盘点、扫码盘点、差异分析与库存修正（演示数据）。
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <select className="text-xs border-shell-border rounded-lg px-3 py-2 bg-shell-panel font-bold text-shell-text focus:ring-1 focus:ring-slate-300">
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
            { label: '未关闭差异单行', value: '23', trend: '需复盘', trendType: 'negative' as const, color: 'text-status-error' },
            { label: '本周完成任务', value: '48', trend: '+6', trendType: 'positive' as const, icon: FileText },
            { label: '扫码覆盖率', value: '99.0%', trend: '健康', trendType: 'positive' as const, icon: Gauge },
            { label: '库存修正准确率', value: '97.4%', trendType: 'positive' as const, progress: 97 },
          ].map((stat, idx) => (
            <div key={idx} className="bg-shell-panel p-5 rounded-xl border border-surface-border shadow-sm">
              <p className="text-[10px] font-black uppercase text-shell-muted tracking-widest mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${stat.color || 'text-shell-text'}`}>{stat.value}</span>
                {stat.trend && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                      stat.trendType === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                    }`}
                  >
                    {stat.trendType === 'negative' ? <TrendingUp className="w-3 h-3 inline mr-1" /> : null}
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
            <h3 className="text-xs font-black uppercase tracking-wider text-shell-text">实盘任务与差异</h3>
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
                  <th className="px-6 py-4">盘点批次</th>
                  <th className="px-6 py-4">类型</th>
                  <th className="px-6 py-4">责任人</th>
                  <th className="px-6 py-4">进度</th>
                  <th className="px-6 py-4">差异摘要</th>
                  <th className="px-6 py-4">状态标签</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-shell-bg transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center text-[10px] font-black">
                          #
                        </div>
                        <div>
                          <div className="text-[13px] font-black text-shell-text font-mono">{row.batch}</div>
                          <div className="text-[10px] text-shell-muted font-bold uppercase mt-0.5">WareFlow</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-[13px] font-bold text-shell-subtext">{row.type}</td>
                    <td className="px-6 py-5 text-[13px] text-shell-subtext">{row.owner}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-24 h-1.5 bg-shell-panel-hover rounded-full overflow-hidden">
                          <div
                            className="bg-slate-900 h-full rounded-full"
                            style={{ width: row.progress }}
                          />
                        </div>
                        <span className="text-[13px] font-black font-mono">{row.progress}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {row.varianceType === 'ok' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {row.variance}
                        </span>
                      ) : row.varianceType === 'neutral' ? (
                        <span className="text-[11px] text-shell-muted">{row.variance}</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${
                            row.varianceType === 'error' ? 'text-status-error' : 'text-status-warning'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {row.variance}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-1">
                        {row.sync.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded text-[10px] font-black border border-shell-border bg-shell-bg text-shell-subtext"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
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
            <span>演示 · 共 186 条历史任务</span>
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
            <ClipboardCheck className="w-5 h-5 text-shell-text" />
            <h3 className="font-black text-shell-text text-xs uppercase tracking-widest">差异工作台</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-shell-muted" />
              <input
                type="text"
                placeholder="搜索 SKU / 库位…"
                className="w-full rounded-lg border border-shell-border py-2 pl-10 pr-3 text-xs"
              />
            </div>

            <section>
              <h4 className="text-[10px] font-black text-shell-muted uppercase tracking-widest mb-4">紧急复核</h4>
              <div className="space-y-4">
                <div className="p-4 bg-red-50/50 border-l-4 border-status-error rounded-r-xl border border-shell-border-dim shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-status-error">高值差异锁定</span>
                    <span className="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">4 条</span>
                  </div>
                  <p className="text-[11px] text-shell-subtext leading-relaxed font-medium">
                    账面与实物差异超过阈值，冻结出库直至复盘完成。
                  </p>
                  <button
                    type="button"
                    className="mt-3 text-[11px] font-black text-status-error hover:underline uppercase tracking-widest italic"
                  >
                    打开复盘
                  </button>
                </div>

                <div className="p-4 bg-shell-bg/80 border-l-4 border-brand-primary rounded-r-xl border border-shell-border-dim shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-shell-text">待审批库存修正</span>
                    <span className="text-[9px] font-black bg-shell-border text-shell-subtext px-1.5 py-0.5 rounded-full">7 待办</span>
                  </div>
                  <p className="text-[11px] text-shell-subtext font-medium">差异原因已填写，等待主管确认过账。</p>
                  <button
                    type="button"
                    className="mt-3 text-[11px] font-black text-shell-text hover:underline uppercase tracking-widest italic"
                  >
                    批量审批
                  </button>
                </div>
              </div>
            </section>

            <section>
              <h4 className="text-[10px] font-black text-shell-muted uppercase tracking-widest mb-4">计划与校准</h4>
              <div className="space-y-1">
                {[
                  { label: '周期复盘 · D 区重型架', sub: '明日 08:00 · 班组 D', icon: ScanLine },
                  { label: 'AGV 库位校准', sub: '进度 75%', icon: History },
                ].map((task, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="w-full flex items-center space-x-4 p-3 hover:bg-shell-bg rounded-xl transition-all group border border-transparent hover:border-shell-border-dim"
                  >
                    <div className="p-2 bg-shell-bg rounded-lg group-hover:bg-shell-panel border border-transparent group-hover:border-shell-border-dim">
                      <task.icon className="w-4 h-4 text-shell-muted group-hover:text-shell-text" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="text-[11px] font-bold text-shell-text">{task.label}</div>
                      <div className="text-[10px] text-shell-muted font-medium">{task.sub}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="pt-6 border-t border-shell-border-dim">
              <h4 className="text-[10px] font-black text-shell-muted uppercase tracking-widest mb-4">效期预警关联</h4>
              <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-4 shadow-sm border-l-4 border-orange-400">
                <div className="flex items-center space-x-3 mb-3">
                  <Calendar className="w-4 h-4 text-orange-600" />
                  <span className="text-[11px] font-black text-orange-800 uppercase tracking-tight">批次 WH-8821</span>
                </div>
                <div className="w-full bg-orange-200 h-1.5 rounded-full mb-2">
                  <div className="bg-orange-600 h-full rounded-full" style={{ width: '55%' }} />
                </div>
                <div className="flex justify-between text-[10px] font-black text-orange-600 uppercase tracking-widest">
                  <span>建议优先盘点</span>
                  <span>剩余 9 天</span>
                </div>
              </div>
            </section>
          </div>
          <div className="p-4 border-t border-shell-border-dim bg-shell-panel">
            <button
              type="button"
              className="w-full py-2.5 bg-shell-bg text-shell-subtext text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-shell-panel-hover transition-all shadow-sm flex items-center justify-center space-x-2 border border-shell-border-dim"
            >
              <History className="w-3.5 h-3.5" />
              <span>归档差异日志</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
