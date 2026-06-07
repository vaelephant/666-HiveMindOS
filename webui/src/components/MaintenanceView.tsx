'use client';

import React, { useState } from 'react';
import { 
  Wrench, 
  AlertOctagon, 
  Calendar, 
  CircleDollarSign, 
  Filter, 
  Download, 
  TrendingUp, 
  User, 
  Settings, 
  MoreVertical,
  Plus,
  Truck,
  Heart,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

export default function MaintenanceView() {
  const roster = [
    { id: '扫码枪 · 12 台', status: '告警', last: '2026-04-02', next: '待检修', mileage: '4.2 万小时', health: 'error' },
    { id: 'AGV #118', status: '维保中', last: '2026-04-28', next: '2026-05-12', mileage: '1.8 万 km', health: 'warning' },
    { id: '电子标签 · A 区', status: '运行中', last: '2026-03-15', next: '2026-06-01', mileage: '在线 312 面', health: 'success' },
    { id: '称重台 #3', status: '运行中', last: '2026-04-01', next: '2026-07-08', mileage: '日均可过 840 单', health: 'success' },
    { id: '摄像头道口 #2', status: '注意', last: '2026-02-21', next: '2026-05-08', mileage: 'NVR · 冗余 OK', health: 'warning' },
  ];

  const groupedRoster = roster.reduce((acc, item) => {
    if (!acc[item.status]) {
      acc[item.status] = [];
    }
    acc[item.status].push(item);
    return acc;
  }, {} as Record<string, typeof roster>);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    告警: true,
    注意: true,
    运行中: true,
    维保中: true,
  });

  const toggleGroup = (status: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [status]: !prev[status]
    }));
  };

  return (
    <div className="flex h-full w-full bg-surface-base p-6 gap-6 overflow-hidden">
      <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar">
        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: '设备可用率（OTIF）', value: '94.8%', trend: '+0.4%', trendType: 'positive', icon: Heart },
            { label: '活跃告警', value: '06', trend: '需现场确认', trendType: 'negative', icon: AlertOctagon, color: 'text-status-error' },
            { label: '计划维保', value: '14', trend: '本周', trendType: 'neutral', icon: Calendar },
            { label: '设备维保成本（本月）', value: '¥12.8 万', trend: '预算内', trendType: 'neutral', icon: CircleDollarSign },
          ].map((stat, idx) => (
            <div key={idx} className="bg-shell-panel p-5 rounded-xl border border-surface-border shadow-sm group hover:border-slate-300 transition-all">
              <p className="text-[10px] font-black uppercase text-shell-muted tracking-widest mb-2 flex items-center space-x-2">
                <stat.icon className="w-3 h-3" />
                <span>{stat.label}</span>
              </p>
              <div className="flex items-end justify-between">
                <span className={`text-2xl font-black ${stat.color || 'text-shell-text'}`}>{stat.value}</span>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter shadow-sm ${
                  stat.trendType === 'positive' ? 'bg-emerald-50 text-emerald-600' : 
                  stat.trendType === 'negative' ? 'bg-red-50 text-red-600' : 'bg-shell-bg text-shell-muted'
                }`}>
                  {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Maintenance Roster */}
        <div className="bg-shell-panel rounded-xl border border-surface-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-shell-bg/50">
            <h3 className="text-sm font-black text-shell-text uppercase tracking-tight">设备与健康度台账</h3>
            <div className="flex space-x-2">
              <button className="flex items-center space-x-2 px-3 py-2 border border-shell-border text-shell-text bg-shell-panel hover:bg-shell-bg text-[11px] font-black uppercase tracking-widest rounded-lg shadow-sm transition-all focus:ring-1 focus:ring-slate-300">
                <Filter className="w-3.5 h-3.5" />
                <span>Filter</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 bg-slate-900 text-white hover:bg-black text-[11px] font-black uppercase tracking-widest rounded-lg shadow-md transition-all active:scale-[0.98]">
                <Download className="w-3.5 h-3.5" />
                <span>Export Log</span>
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-shell-panel/95 backdrop-blur z-10">
                <tr className="border-b border-surface-border text-[10px] font-black text-shell-muted uppercase tracking-widest">
                  <th className="px-6 py-4">设备</th>
                  <th className="px-6 py-4">状态</th>
                  <th className="px-6 py-4">上次维保</th>
                  <th className="px-6 py-4">下次计划</th>
                  <th className="px-6 py-4 text-right">运行指标</th>
                  <th className="px-6 py-4 text-center">健康</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(groupedRoster).map(([status, items]) => (
                  <React.Fragment key={status}>
                    <tr 
                      className="bg-shell-bg/80 cursor-pointer hover:bg-shell-panel-hover transition-colors"
                      onClick={() => toggleGroup(status)}
                    >
                      <td colSpan={6} className="px-6 py-2">
                        <div className="flex items-center space-x-2">
                          {expandedGroups[status] ? (
                            <ChevronDown className="w-4 h-4 text-shell-muted" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-shell-muted" />
                          )}
                          <span className="text-[10px] font-black uppercase tracking-widest text-shell-subtext">
                            {status}（{items.length}）
                          </span>
                        </div>
                      </td>
                    </tr>
                    {expandedGroups[status] && items.map((row, idx) => (
                      <tr key={`${status}-${idx}`} className="hover:bg-shell-bg transition-colors group">
                        <td className="px-6 py-4 font-mono font-black text-[13px] text-shell-text">{row.id}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${
                            row.health === 'error' ? 'bg-red-50 border-red-100 text-red-600' :
                            row.health === 'warning' ? 'bg-orange-50 border-orange-100 text-orange-600' :
                            'bg-emerald-50 border-emerald-100 text-emerald-600'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[13px] text-shell-subtext font-medium">{row.last}</td>
                        <td className="px-6 py-4 text-[13px] text-shell-subtext font-medium">
                          <span className={row.next === '待检修' ? 'text-status-error font-black' : ''}>{row.next}</span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-[13px] text-shell-text">{row.mileage}</td>
                        <td className="px-6 py-4 text-center">
                          <div className={`w-2.5 h-2.5 rounded-full mx-auto shadow-sm ${
                            row.health === 'error' ? 'bg-status-error animate-pulse' :
                            row.health === 'warning' ? 'bg-status-warning' : 'bg-status-success'
                          }`}></div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Maintenance Sidebar */}
      <aside className="w-80 flex flex-col space-y-6 shrink-0 h-full overflow-hidden">
        {/* Critical Diagnostic Alerts */}
        <div className="bg-shell-panel border border-surface-border rounded-xl shadow-sm overflow-hidden flex flex-col shrink-0">
          <div className="px-4 py-3 bg-red-50/50 border-b border-red-100 flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 text-status-error" />
            <h3 className="text-[10px] font-black text-red-700 uppercase tracking-widest">严重诊断</h3>
          </div>
          <div className="p-4 space-y-6">
            <div className="border-l-4 border-status-error pl-4 py-1">
              <div className="text-[13px] font-black text-shell-text">输送线 #402 驱动器</div>
              <div className="text-[11px] text-status-error font-black mt-0.5 uppercase tracking-tighter">
                代码 E-2048 · 过热
              </div>
              <div className="text-[11px] text-shell-muted mt-2 leading-relaxed font-medium">
                建议降速并安排 2h 内现场确认，避免分拣波次堆积。
              </div>
            </div>
            <div className="border-l-4 border-status-error pl-4 py-1">
              <div className="text-[13px] font-black text-shell-text">RFID 天线 #12</div>
              <div className="text-[11px] text-status-error font-black mt-0.5 uppercase tracking-tighter">
                误读率 &gt; 3.5%
              </div>
              <div className="text-[11px] text-shell-muted mt-2 leading-relaxed font-medium">
                检查线缆与标签安装角度，必要时更换天线模块。
              </div>
            </div>
          </div>
        </div>

        {/* Service Requests */}
        <div className="bg-shell-panel border border-surface-border rounded-xl shadow-sm flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-shell-border-dim bg-shell-bg/50 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-shell-subtext uppercase tracking-widest">维保工单</h3>
            <span className="bg-shell-border text-shell-subtext text-[10px] font-black px-1.5 py-0.5 rounded-full">3 在处理</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
            {[
              { title: '分拣机毛刷更换', time: '2 小时前', id: '分拣 #2', manager: '维保组 A' },
              { title: '称重传感器标定', time: '4 小时前', id: '#118', manager: '李工' },
              { title: 'WMS ↔ AGV 通讯同步', time: '昨天', id: '#309', manager: '集成值班' },
            ].map((req, idx) => (
              <div key={idx} className="p-4 hover:bg-shell-bg/80 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-[13px] font-black text-shell-text group-hover:text-black">{req.title}</div>
                  <div className="text-[10px] font-bold text-shell-muted">{req.time}</div>
                </div>
                <div className="text-[11px] text-shell-muted font-medium">
                  {req.id} · {req.manager}
                </div>
                <div className="mt-4 flex space-x-2">
                  <button className="flex-1 bg-slate-900 text-white text-[10px] font-black py-2 rounded-lg uppercase tracking-widest shadow-sm hover:bg-black active:scale-[0.98] transition-all">
                    通过
                  </button>
                  <button className="flex-1 border border-shell-border text-shell-subtext text-[10px] font-black py-2 rounded-lg uppercase tracking-widest hover:bg-shell-panel hover:text-shell-text transition-all">
                    复核
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Parts Inventory */}
        <div className="bg-slate-900 text-white rounded-xl shadow-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-shell-muted">关键备件</h3>
            <Settings className="w-4 h-4 text-shell-muted" />
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[
              { label: 'Oil Filters (HD)', value: '14/25', progress: 56, color: 'bg-emerald-400' },
              { label: 'All-Season Tires', value: '04/12', progress: 33, color: 'bg-status-error' },
              { label: 'Brake Rotors', value: '06/10', progress: 60, color: 'bg-status-warning' }
            ].map((part, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-bold">
                  <span className="text-slate-100">{part.label}</span>
                  <span className={`${part.progress < 40 ? 'text-status-error' : 'text-white'} font-mono`}>{part.value}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden shadow-inner">
                  <div className={`${part.color} h-full rounded-full transition-all duration-500`} style={{ width: `${part.progress}%` }}></div>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 bg-shell-panel/10 hover:bg-shell-panel/20 border border-white/10 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all italic">
            Order Critical Parts
          </button>
        </div>
      </aside>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-8 right-8 flex flex-col space-y-4">
        <button className="w-14 h-14 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group" title="Schedule Maintenance">
          <Calendar className="w-6 h-6 group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]" />
        </button>
        <button className="w-14 h-14 bg-shell-panel border border-shell-border text-shell-text rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group" title="Emergency Logout">
          <Wrench className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
