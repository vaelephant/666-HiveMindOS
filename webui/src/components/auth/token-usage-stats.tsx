'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, Coins, Loader2, RefreshCw } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { getLlmUsageStats } from '@/lib/kb-api';
import type { LlmUsageStats } from '@/lib/kb-types';
import { themeVars } from '@/lib/theme-vars';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [
  { days: 1, label: '今日' },
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: 90, label: '90 天' },
] as const;

type PeriodDays = (typeof PERIOD_OPTIONS)[number]['days'];

function periodHint(days: number): string {
  return days === 1 ? '今日' : `近 ${days} 天`;
}

const SOURCE_LABELS: Record<string, string> = {
  chat: '对话',
  memory: '智慧提取',
  ingest: '资料编译',
  agent: '自主任务',
  embed: '向量嵌入',
  automation: '定时运维',
  unknown: '其他',
};

const OPERATION_LABELS: Record<string, string> = {
  chat: '对话生成',
  embed: '向量嵌入',
  agentic: '工具调用',
};

function formatTokens(n: number): string {
  return n.toLocaleString('zh-CN');
}

function formatHitRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCost(usd: number | null | undefined): string {
  if (usd == null || usd <= 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
}

type ChartPoint = {
  label: string;
  tokens: number;
  requests: number;
};

function tzLabel(tz?: string): string {
  if (tz === 'Asia/Shanghai') return '北京时间 (UTC+8)';
  return tz ?? '本地时区';
}

function formatAxisTick(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

type UsageTooltipProps = {
  active?: boolean;
  payload?: readonly { payload?: ChartPoint; value?: number }[];
  label?: string | number;
};

function UsageChartTooltip({ active, payload, label }: UsageTooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as ChartPoint | undefined;
  if (!row) return null;
  return (
    <div className="rounded-lg border border-shell-border bg-shell-panel px-3 py-2 text-[12px] shadow-lg">
      <p className="font-medium text-shell-text">{label}</p>
      <p className="mt-1 tabular-nums text-shell-muted">
        Token <span className="font-semibold text-brand-primary">{formatTokens(row.tokens)}</span>
      </p>
      <p className="tabular-nums text-shell-subtext">{row.requests} 次调用</p>
    </div>
  );
}

function UsageAreaChart({
  data,
  gradientId,
  emptyTitle,
  emptyHint,
}: {
  data: ChartPoint[];
  gradientId: string;
  emptyTitle: string;
  emptyHint: string;
}) {
  const hasData = data.some((d) => d.tokens > 0);
  if (!hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-shell-border bg-shell-bg/40">
        <div className="text-center">
          <p className="text-[14px] font-medium text-shell-text">{emptyTitle}</p>
          <p className="mt-1 text-[13px] text-shell-muted">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={themeVars.brandPrimary} stopOpacity={0.35} />
              <stop offset="95%" stopColor={themeVars.brandPrimary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: themeVars.chartAxis }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: themeVars.chartAxis }}
            tickFormatter={formatAxisTick}
            width={44}
          />
          <Tooltip content={<UsageChartTooltip />} cursor={{ stroke: themeVars.brandPrimary, strokeOpacity: 0.2 }} />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke={themeVars.brandPrimary}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            dot={{ r: 3, fill: themeVars.brandPrimary, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: themeVars.brandPrimary, stroke: themeVars.chartTooltipBg, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function UsageBarChart({
  data,
  emptyTitle,
  emptyHint,
}: {
  data: ChartPoint[];
  emptyTitle: string;
  emptyHint: string;
}) {
  const hasData = data.some((d) => d.tokens > 0);
  if (!hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-shell-border bg-shell-bg/40">
        <div className="text-center">
          <p className="text-[14px] font-medium text-shell-text">{emptyTitle}</p>
          <p className="mt-1 text-[13px] text-shell-muted">{emptyHint}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="28%" maxBarSize={28}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={themeVars.chartGrid} />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: themeVars.chartAxis }}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: themeVars.chartAxis }}
            tickFormatter={formatAxisTick}
            width={44}
          />
          <Tooltip
            content={<UsageChartTooltip />}
            cursor={{ fill: themeVars.chartGrid, opacity: 0.35 }}
          />
          <Bar
            dataKey="tokens"
            fill={themeVars.brandPrimary}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-shell-border bg-shell-panel px-4 py-3.5">
      <p className="text-[12px] text-shell-muted">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-shell-text">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-shell-subtext">{hint}</p> : null}
    </div>
  );
}

export function TokenUsageStats() {
  const { ready, orgId } = useOrgReady();
  const [days, setDays] = useState<PeriodDays>(7);
  const [stats, setStats] = useState<LlmUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getLlmUsageStats(days, orgId);
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [days, orgId, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  const hourChartData = useMemo<ChartPoint[]>(
    () =>
      (stats?.by_hour ?? []).map((b) => ({
        label: `${b.hour}:00`,
        tokens: b.total_tokens,
        requests: b.request_count,
      })),
    [stats?.by_hour],
  );

  const dayChartData = useMemo<ChartPoint[]>(
    () =>
      (stats?.by_day ?? []).map((d) => ({
        label: d.date.slice(5),
        tokens: d.total_tokens,
        requests: d.request_count,
      })),
    [stats?.by_day],
  );

  const isTodayView = days === 1;

  const todayUsage = useMemo(() => {
    const buckets = stats?.by_day ?? [];
    return buckets.length ? buckets[buckets.length - 1] : null;
  }, [stats?.by_day]);

  const peakHour = useMemo(() => {
    const buckets = stats?.by_hour ?? [];
    if (!buckets.length) return null;
    return buckets.reduce((best, b) => (b.total_tokens > best.total_tokens ? b : best), buckets[0]);
  }, [stats?.by_hour]);

  if (!ready) {
    return (
      <section className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-shell-border bg-shell-panel py-16 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        正在加载账户信息…
      </section>
    );
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-shell-text">大模型 Token 用量</p>
          <p className="mt-0.5 text-[12px] text-shell-muted">统计你在 HiveMind 中的模型调用消耗</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-shell-border bg-shell-bg p-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setDays(option.days)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  days === option.days
                    ? 'bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/20'
                    : 'text-shell-muted hover:text-shell-text',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-shell-border px-3 py-2 text-[12px] font-medium text-shell-muted transition-colors hover:border-brand-primary/40 hover:text-shell-text disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={cn('inline size-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
          {error}
        </p>
      ) : null}

      {loading && !stats ? (
        <section className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-shell-border bg-shell-panel py-16 text-[13px] text-shell-muted">
          <Loader2 className="size-4 animate-spin" />
          加载用量数据…
        </section>
      ) : null}

      {stats ? (
        <>
          <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
            <StatCard
              label="预估费用"
              value={formatCost(stats.summary.estimated_cost_usd)}
              hint={`${stats.currency ?? 'USD'} · 按模型单价估算`}
            />
            <StatCard
              label="总 Token"
              value={formatTokens(stats.summary.total_tokens)}
              hint={periodHint(stats.period_days)}
            />
            {!isTodayView ? (
              <StatCard
                label="今日 Token"
                value={formatTokens(todayUsage?.total_tokens ?? 0)}
                hint={
                  todayUsage && todayUsage.request_count > 0
                    ? `输入 ${formatTokens(todayUsage.prompt_tokens)} · 输出 ${formatTokens(todayUsage.completion_tokens)} · ${todayUsage.request_count} 次`
                    : '今日暂无调用'
                }
              />
            ) : null}
            <StatCard label="输入 Token" value={formatTokens(stats.summary.prompt_tokens)} />
            <StatCard label="输出 Token" value={formatTokens(stats.summary.completion_tokens)} />
            <StatCard label="调用次数" value={formatTokens(stats.summary.request_count)} />
            <StatCard
              label="KV 缓存命中"
              value={formatHitRate(stats.summary.cache_hit_rate)}
              hint={
                stats.summary.cached_prompt_tokens
                  ? `${formatTokens(stats.summary.cached_prompt_tokens)} tokens 来自缓存`
                  : '需 Provider 返回 cache 字段'
              }
            />
            <StatCard
              label="缓存写入"
              value={formatTokens(stats.summary.cache_creation_tokens ?? 0)}
              hint="Anthropic cache_creation"
            />
          </section>

          <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
            <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-brand-primary" />
                <div>
                  <p className="text-[14px] font-semibold text-shell-text">按时段分布</p>
                  <p className="text-[12px] text-shell-muted">
                    {isTodayView
                      ? `今日各时段用量 · ${tzLabel(stats.timezone)}`
                      : `统计周期内 24 小时累计 · ${tzLabel(stats.timezone)}`}
                  </p>
                </div>
              </div>
              {peakHour && peakHour.total_tokens > 0 ? (
                <span className="rounded-full bg-brand-primary/8 px-3 py-1 text-[11px] font-medium text-brand-primary">
                  高峰 {peakHour.hour}:00 · {formatTokens(peakHour.total_tokens)} tokens
                </span>
              ) : null}
            </div>
            <UsageAreaChart
              data={hourChartData}
              gradientId="usage-hour-gradient"
              emptyTitle="暂无时段数据"
              emptyHint={
                isTodayView
                  ? '今日发起对话后，将按小时展示用量曲线'
                  : '累计多次调用后将展示 24 小时用量曲线'
              }
            />
          </section>

          {!isTodayView ? (
            <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
              <div className="mb-1 flex items-center gap-2">
                <Coins className="size-4 text-brand-primary" />
                <div>
                  <p className="text-[14px] font-semibold text-shell-text">每日趋势</p>
                  <p className="text-[12px] text-shell-muted">按自然日汇总 Token 消耗</p>
                </div>
              </div>
              <UsageBarChart
                data={dayChartData}
                emptyTitle="暂无用量记录"
                emptyHint="发起 Chat 对话后，数据会自动累计到此页"
              />
            </section>
          ) : null}

          <section className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
              <p className="text-[14px] font-semibold text-shell-text">按调用类型</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">chat / embed / agentic</p>
              {stats.by_operation.length === 0 ? (
                <p className="mt-6 text-[13px] text-shell-muted">暂无数据</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {stats.by_operation.map((row) => (
                    <li
                      key={row.operation}
                      className="flex items-center justify-between gap-3 rounded-lg border border-shell-border bg-shell-bg/50 px-3 py-2.5 text-[13px]"
                    >
                      <span className="font-medium text-shell-text">
                        {OPERATION_LABELS[row.operation] ?? row.operation}
                      </span>
                      <span className="tabular-nums text-shell-muted">{formatTokens(row.total_tokens)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
              <p className="text-[14px] font-semibold text-shell-text">按 Profile</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">default / fast / 自定义等</p>
              {(stats.by_profile ?? []).length === 0 ? (
                <p className="mt-6 text-[13px] text-shell-muted">暂无数据</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {(stats.by_profile ?? []).map((row) => (
                    <li
                      key={row.profile_id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-shell-border bg-shell-bg/50 px-3 py-2.5 text-[13px]"
                    >
                      <span className="font-mono text-[12px] text-shell-text">{row.profile_id}</span>
                      <span className="tabular-nums text-shell-muted">{formatTokens(row.total_tokens)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
              <p className="text-[14px] font-semibold text-shell-text">按提供商</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">OpenAI / Anthropic 等</p>
              {(stats.by_provider ?? []).length === 0 ? (
                <p className="mt-6 text-[13px] text-shell-muted">暂无数据</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {(stats.by_provider ?? []).map((row) => (
                    <li
                      key={row.provider}
                      className="flex items-center justify-between gap-3 rounded-lg border border-shell-border bg-shell-bg/50 px-3 py-2.5 text-[13px]"
                    >
                      <span className="font-medium text-shell-text">{row.provider}</span>
                      <span className="tabular-nums text-shell-muted">{formatTokens(row.total_tokens)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
              <p className="text-[14px] font-semibold text-shell-text">按场景</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">对话、智慧提取等功能分布</p>
              {stats.by_source.length === 0 ? (
                <p className="mt-6 text-[13px] text-shell-muted">暂无数据</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {stats.by_source.map((row) => {
                    const pct =
                      stats.summary.total_tokens > 0
                        ? Math.round((row.total_tokens / stats.summary.total_tokens) * 100)
                        : 0;
                    return (
                      <li
                        key={row.source}
                        className="flex items-center justify-between gap-3 rounded-lg border border-shell-border bg-shell-bg/50 px-3 py-2.5 text-[13px]"
                      >
                        <span className="font-medium text-shell-text">
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </span>
                        <span className="tabular-nums text-shell-muted">
                          {formatTokens(row.total_tokens)}
                          <span className="ml-1.5 text-[11px] text-shell-subtext">({pct}%)</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-shell-border bg-shell-panel p-5">
              <p className="text-[14px] font-semibold text-shell-text">按模型</p>
              <p className="mt-0.5 text-[12px] text-shell-muted">各模型与提供商的消耗占比</p>
              {stats.by_model.length === 0 ? (
                <p className="mt-6 text-[13px] text-shell-muted">暂无数据</p>
              ) : (
                <ul className="mt-4 space-y-2.5">
                  {stats.by_model.map((row) => (
                    <li
                      key={`${row.provider}-${row.model}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-shell-border bg-shell-bg/50 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[12px] font-medium text-shell-text">{row.model}</p>
                        <p className="text-[11px] text-shell-muted">{row.provider}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="tabular-nums text-[13px] text-shell-muted">
                          {formatTokens(row.total_tokens)}
                        </span>
                        {row.estimated_cost_usd != null && row.estimated_cost_usd > 0 ? (
                          <p className="text-[11px] tabular-nums text-shell-subtext">
                            {formatCost(row.estimated_cost_usd)}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
