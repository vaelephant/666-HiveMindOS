'use client';

import { themeVars } from '@/lib/theme-vars';
import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
} from 'recharts';
import {
  Download,
  Filter,
  Calendar,
  TrendingDown,
  DollarSign,
  Clock,
  Activity,
  FileText,
  Truck,
  Route,
  Gauge,
  Fuel,
  Wrench,
  Package,
  MapPin,
} from 'lucide-react';

const performanceData = [
  { name: 'Mon', revenue: 4200, cost: 2100, efficiency: 94, fuel: 850, maintenance: 200, loads: 142, miles: 41800 },
  { name: 'Tue', revenue: 3800, cost: 2300, efficiency: 88, fuel: 920, maintenance: 450, loads: 128, miles: 39200 },
  { name: 'Wed', revenue: 5100, cost: 2400, efficiency: 97, fuel: 880, maintenance: 150, loads: 156, miles: 44500 },
  { name: 'Thu', revenue: 4600, cost: 1900, efficiency: 91, fuel: 950, maintenance: 1200, loads: 149, miles: 40100 },
  { name: 'Fri', revenue: 5900, cost: 2800, efficiency: 95, fuel: 1100, maintenance: 300, loads: 168, miles: 46800 },
  { name: 'Sat', revenue: 3200, cost: 1500, efficiency: 82, fuel: 600, maintenance: 100, loads: 95, miles: 28400 },
  { name: 'Sun', revenue: 2800, cost: 1200, efficiency: 79, fuel: 550, maintenance: 80, loads: 88, miles: 25100 },
];

const COLORS = [themeVars.shellText, themeVars.chart3, themeVars.chartAxis, themeVars.chart4];

/** Slimmer bars: cap width + spacing between categories */
const barChartMargin = { top: 8, right: 8, left: 0, bottom: 4 };

export default function ReportsView() {
  return (
    <div className="flex flex-col h-full w-full bg-surface-base p-6 gap-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-shell-text tracking-tight">数据分析与预测</h2>
          <p className="text-xs text-shell-muted font-medium mt-0.5">
            库存周转、滞销品、缺货风险、订单波峰、库容利用率与人效。
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 px-3 py-2 bg-shell-panel border border-shell-border rounded-lg text-xs font-bold text-shell-text hover:bg-shell-bg shadow-sm transition-all">
            <Calendar className="w-4 h-4" />
            <span>近 30 天</span>
          </button>
          <button className="flex items-center space-x-2 px-3 py-2 bg-slate-900 text-white border border-brand-primary rounded-lg text-xs font-bold hover:bg-black transition-all shadow-md">
            <Download className="w-4 h-4" />
            <span>导出报表</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '库存周转天数', value: '36.8', trend: '-1.8', icon: DollarSign, trendType: 'positive' as const },
          { label: '库容利用率', value: '81.4%', trend: '+2.0%', icon: Activity, trendType: 'positive' as const },
          { label: '滞销 SKU 占比', value: '3.9%', trend: '-0.3%', icon: TrendingDown, trendType: 'positive' as const },
          { label: '综合人效指数', value: '112%', trend: '+4%', icon: Clock, trendType: 'positive' as const },
        ].map((stat, idx) => (
          <div key={idx} className="bg-shell-panel p-5 rounded-xl border border-surface-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase text-shell-muted tracking-widest">{stat.label}</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/[0.04] text-shell-subtext">
                <stat.icon className="h-4 w-4" strokeWidth={2.25} />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-black text-shell-text">{stat.value}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded tracking-tighter ${
                  stat.trendType === 'positive' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}
              >
                {stat.trend}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Secondary metrics — icons + operational context */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Loads (7d)', value: '926', sub: 'avg 132/day', icon: Package },
          { label: 'Loaded mi', value: '246k', sub: 'TL + partial', icon: Route },
          { label: 'Active assets', value: '184', sub: '142 in motion', icon: Truck },
          { label: 'Fuel / load', value: '6.2 gal', sub: 'rolling avg', icon: Fuel },
          { label: 'Detention hrs', value: '38', sub: '−12% vs LY', icon: Clock },
          { label: 'Unassigned', value: '7', sub: 'regional pool', icon: MapPin },
        ].map((m) => (
          <div
            key={m.label}
            className="flex items-start gap-3 rounded-xl border border-surface-border bg-shell-panel px-3 py-3 shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <m.icon className="h-[18px] w-[18px]" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-wider text-shell-muted">{m.label}</p>
              <p className="text-lg font-black tabular-nums text-shell-text leading-tight">{m.value}</p>
              <p className="text-[10px] font-medium text-shell-muted truncate">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Stats Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm h-[350px] flex flex-col">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest">Revenue vs Operating Cost</h3>
              <p className="mt-1 text-[10px] font-medium text-shell-muted">7-day trend · $1k scale</p>
            </div>
            <div className="flex items-center gap-3 text-[10px] font-bold text-shell-subtext">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-slate-900" />
                Revenue
              </span>
              <span className="flex items-center gap-1">
                <span className="h-0.5 w-4 bg-shell-bg0" />
                Cost
              </span>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={barChartMargin}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={themeVars.shellText} stopOpacity={0.12} />
                    <stop offset="95%" stopColor={themeVars.shellText} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: `1px solid ${themeVars.chartTooltipBorder}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    fontSize: '12px',
                  }}
                  formatter={(value, name) => {
                    const v = Number(value ?? 0);
                    return [`$${v.toLocaleString()}`, name === 'revenue' ? 'Revenue' : 'Cost'];
                  }}
                />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke={themeVars.shellText} fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="cost" name="cost" stroke={themeVars.chartAxis} fillOpacity={0} strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Efficiency Chart */}
        <div className="bg-slate-900 p-6 rounded-xl shadow-2xl h-[350px] flex flex-col border border-slate-800">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-shell-muted uppercase tracking-widest">Daily Operational Efficiency</h3>
              <p className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-shell-muted">
                <Gauge className="h-3 w-3 shrink-0 text-shell-muted" />
                Utilization index · target band 90–100%
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={barChartMargin} barCategoryGap="28%" maxBarSize={22}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chart4 }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chart4 }} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: themeVars.chartGrid, opacity: 0.35 }}
                  contentStyle={{
                    backgroundColor: themeVars.shellText,
                    borderRadius: '8px',
                    border: `1px solid ${themeVars.chartTooltipBorder}`,
                    fontSize: '12px',
                    color: '#fff',
                  }}
                  formatter={(value) => [`${Number(value ?? 0)}%`, 'Efficiency']}
                />
                <Bar dataKey="efficiency" name="Efficiency" fill={themeVars.shellText} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Secondary Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fuel Consumption */}
        <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm h-[300px] flex flex-col">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest">Fuel Consumption</h3>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-shell-muted">
                <Fuel className="h-3 w-3 text-orange-500" />
                Gallons · 7-day series
              </p>
            </div>
            <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-700">Σ 5.95k gal</span>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={performanceData} margin={barChartMargin}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} />
                <Tooltip formatter={(value) => [`${Number(value ?? 0)} gal`, 'Fuel']} />
                <Line
                  type="monotone"
                  dataKey="fuel"
                  stroke={themeVars.statusWarning}
                  strokeWidth={2}
                  dot={{ r: 3, fill: themeVars.statusWarning, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Maintenance Spending */}
        <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm h-[300px] flex flex-col">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest">Maintenance Outlay</h3>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-shell-muted">
                <Wrench className="h-3 w-3 text-shell-muted" />
                Unplanned vs PM (mock)
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData} margin={barChartMargin} barCategoryGap="28%" maxBarSize={20}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} tickFormatter={(v) => `$${v}`} />
                <Tooltip formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, 'Maintenance']} />
                <Bar dataKey="maintenance" fill={themeVars.chart3} radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Region Distribution (Donut) */}
        <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm h-[300px] flex flex-col">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest">Volume by Region</h3>
              <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-shell-muted">
                <MapPin className="h-3 w-3" />
                Load count share
              </p>
            </div>
          </div>
          <div className="flex flex-1 min-h-0 flex-row items-center gap-2">
            <div className="h-full min-h-[160px] min-w-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'North', value: 45 },
                      { name: 'South', value: 25 },
                      { name: 'East', value: 20 },
                      { name: 'West', value: 10 },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={68}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} stroke="#fff" strokeWidth={1} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, n) => [`${Number(value ?? 0)}%`, String(n)]} />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    wrapperStyle={{ fontSize: '10px', fontWeight: 700, paddingLeft: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-3 border-t border-shell-border-dim pt-3">
            {['North', 'South', 'East', 'West'].map((reg, i) => (
              <div key={reg} className="flex items-center gap-1.5">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-[10px] font-black uppercase tracking-tight text-shell-subtext">{reg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loads vs loaded miles — slim bars + line */}
      <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm h-[290px] flex flex-col">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest">Loads &amp; loaded miles</h3>
            <p className="mt-1 flex items-center gap-2 text-[10px] font-medium text-shell-muted">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3 text-shell-subtext" />
                Completed loads
              </span>
              <span className="text-shell-subtext">·</span>
              <span className="flex items-center gap-1">
                <Route className="h-3 w-3 text-sky-600" />
                Line = miles
              </span>
            </p>
          </div>
          <div className="flex gap-3 text-[10px] font-black text-shell-subtext">
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-900" />
              Loads
            </span>
            <span className="flex items-center gap-1">
              <span className="h-0.5 w-6 bg-sky-500" />
              Miles
            </span>
          </div>
        </div>
        <div className="min-h-0 flex-1 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={performanceData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: themeVars.chartAxis }} />
              <YAxis
                yAxisId="loads"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: themeVars.chartAxis }}
                label={{ value: 'Loads', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 9, fill: themeVars.chart4 } }}
              />
              <YAxis
                yAxisId="miles"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: themeVars.chartAxis }}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                label={{ value: 'Miles', angle: 90, position: 'insideRight', offset: 10, style: { fontSize: 9, fill: themeVars.chart4 } }}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === 'miles'
                    ? [`${Number(value ?? 0).toLocaleString()} mi`, 'Miles']
                    : [Number(value ?? 0), 'Loads']
                }
              />
              <Bar yAxisId="loads" dataKey="loads" fill={themeVars.shellText} radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Line
                yAxisId="miles"
                type="monotone"
                dataKey="miles"
                stroke={themeVars.statusInfo}
                strokeWidth={2}
                dot={{ r: 2.5, fill: themeVars.statusInfo, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
         {/* Detailed Logs Card */}
         <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest">Recent Activity Logs</h3>
            <button className="text-shell-muted hover:text-shell-text transition-colors"><Filter className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 px-1">
            {[
              { id: 'REP-001', title: 'Q2 Compliance Audit', user: 'Marcus T.', date: '2h ago', status: 'Completed' },
              { id: 'REP-002', title: 'Fuel Efficiency Drilldown', user: 'Sarah K.', date: '4h ago', status: 'Draft' },
              { id: 'REP-003', title: 'Route Optimization Summary', user: 'System', date: 'Yesterday', status: 'Completed' },
              { id: 'REP-004', title: 'Maintenance Cost Analysis', user: 'David M.', date: 'Yesterday', status: 'Action Required' },
            ].map((log, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-shell-bg/50 rounded-lg border border-shell-border-dim hover:border-shell-border transition-all cursor-pointer group">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-shell-panel rounded-lg border border-shell-border-dim group-hover:scale-110 transition-transform">
                    <FileText className="w-4 h-4 text-shell-muted" />
                  </div>
                  <div>
                    <div className="text-[12px] font-bold text-shell-text">{log.title}</div>
                    <div className="text-[10px] text-shell-muted font-medium">{log.id} • {log.user}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    log.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' : 
                    log.status === 'Draft' ? 'bg-shell-border text-shell-subtext' : 'bg-red-50 text-red-600'
                  }`}>
                    {log.status}
                  </div>
                  <div className="text-[10px] text-shell-muted font-bold mt-1">{log.date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Health / Status */}
        <div className="bg-shell-panel p-6 rounded-xl border border-surface-border shadow-sm flex flex-col justify-between">
           <div>
             <h3 className="text-xs font-bold text-shell-text uppercase tracking-widest mb-6">库内遥测健康度</h3>
             <div className="space-y-6">
                {[
                  { label: 'Active Sensors', value: '99.9%', color: 'bg-emerald-500' },
                  { label: 'GPS Connectivity', value: '98.2%', color: 'bg-emerald-500' },
                  { label: 'Latency (Avg)', value: '112ms', color: 'bg-slate-900' },
                  { label: 'Offline Assets', value: '02', color: 'bg-status-error' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span className="text-xs font-bold text-shell-subtext">{item.label}</span>
                    </div>
                    <span className="text-xs font-black text-shell-text font-mono">{item.value}</span>
                  </div>
                ))}
             </div>
           </div>
           <button className="w-full mt-8 py-3 bg-shell-bg text-shell-muted text-[10px] font-black uppercase tracking-widest rounded-xl border border-shell-border-dim hover:bg-shell-panel hover:text-shell-text transition-all italic">
             Review Connectivity Audit
           </button>
        </div>
      </div>
    </div>
  );
}
