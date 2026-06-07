'use client';

import React from 'react';
import {
  Brain,
  RefreshCw,
  Route,
  AlertOctagon,
  TrendingUp,
  FileJson,
  MessageCircleQuestion,
  Zap,
  Play,
} from 'lucide-react';

export default function AIDecisionView() {
  const tiles = [
    {
      title: 'AI 预测补货',
      body: '结合销量、在途与季节因子生成补货建议与安全库存带。',
      icon: RefreshCw,
      tag: 'WareBrain',
    },
    {
      title: 'AI 优化拣货路径',
      body: '波次合并 + 动线最小化，输出可下发到 PDA 的逐步导航。',
      icon: Route,
      tag: 'WareBrain',
    },
    {
      title: 'AI 识别异常库存',
      body: '批次滞留、效期堆叠、循环盘点差异的聚类与根因提示。',
      icon: AlertOctagon,
      tag: 'WareBrain',
    },
    {
      title: 'AI 预测爆单压力',
      body: '活动/大促场景下的人效与道口拥堵概率估计。',
      icon: TrendingUp,
      tag: 'WareBrain',
    },
    {
      title: 'AI 生成运营日报',
      body: '自动汇总周转、缺货、人效与设备事件，邮件/企微推送。',
      icon: FileJson,
      tag: 'WareBrain',
    },
    {
      title: 'AI 客服查询',
      body: '自然语言查询订单与库存状态，对接库内知识库与权限。',
      icon: MessageCircleQuestion,
      tag: 'WareBrain',
    },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-surface-base p-6 gap-6 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-shell-text tracking-tight">AI 智能决策</h2>
          <p className="text-xs text-shell-muted font-medium mt-0.5">
            WareBrain：从「人工调度」到「AI 自动决策 + 智能执行」的决策层（演示占位）。
          </p>
        </div>
        <button
          type="button"
          className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-all shadow-md"
        >
          <Play className="w-4 h-4" />
          <span>运行诊断（Mock）</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: '今日模型调用', value: '1,284', icon: Zap },
          { label: '建议已采纳率', value: '72%', icon: Brain },
          { label: '平均响应时延', value: '420 ms', icon: RefreshCw },
        ].map((k, i) => (
          <div key={i} className="bg-shell-panel p-5 rounded-xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-shell-muted tracking-widest">{k.label}</span>
              <k.icon className="w-4 h-4 text-shell-muted" />
            </div>
            <span className="text-2xl font-black text-shell-text">{k.value}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiles.map((t) => (
          <div
            key={t.title}
            className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm hover:border-slate-300 transition-all flex flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900/[0.04] text-shell-text">
                <t.icon className="w-5 h-5" strokeWidth={2.25} />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-shell-muted">{t.tag}</span>
            </div>
            <h3 className="mt-4 text-sm font-black text-shell-text">{t.title}</h3>
            <p className="mt-2 flex-1 text-[12px] leading-relaxed text-shell-subtext">{t.body}</p>
            <button
              type="button"
              className="mt-4 text-left text-[11px] font-bold text-shell-text hover:underline"
            >
              查看配置 →
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
