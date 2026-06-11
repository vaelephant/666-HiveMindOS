'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coins, Loader2, RefreshCw } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { getLlmUsageStats } from '@/lib/kb-api';
import type { LlmUsageStats } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [7, 30, 90] as const;

const SOURCE_LABELS: Record<string, string> = {
  chat: '对话',
  memory: '智慧提取',
  ingest: '资料编译',
  agent: '自主任务',
  embed: '向量嵌入',
  automation: '定时运维',
  unknown: '其他',
};

function formatTokens(n: number): string {
  return n.toLocaleString('zh-CN');
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
  const [days, setDays] = useState<(typeof PERIOD_OPTIONS)[number]>(30);
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

  const maxDayTokens = useMemo(
    () => Math.max(1, ...(stats?.by_day.map((d) => d.total_tokens) ?? [1])),
    [stats],
  );

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
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                  days === option
                    ? 'bg-brand-primary text-brand-on-primary shadow-sm shadow-brand-primary/20'
                    : 'text-shell-muted hover:text-shell-text',
                )}
              >
                {option} 天
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
          <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="总 Token"
              value={formatTokens(stats.summary.total_tokens)}
              hint={`近 ${stats.period_days} 天`}
            />
            <StatCard label="输入 Token" value={formatTokens(stats.summary.prompt_tokens)} />
            <StatCard label="输出 Token" value={formatTokens(stats.summary.completion_tokens)} />
            <StatCard label="调用次数" value={formatTokens(stats.summary.request_count)} />
          </section>

          <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <Coins className="size-4 text-brand-primary" />
              <div>
                <p className="text-[14px] font-semibold text-shell-text">每日趋势</p>
                <p className="text-[12px] text-shell-muted">按自然日汇总 Token 消耗</p>
              </div>
            </div>
            {stats.by_day.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[14px] font-medium text-shell-text">暂无用量记录</p>
                <p className="mt-1 text-[13px] text-shell-muted">
                  发起 Chat 对话后，数据会自动累计到此页。
                </p>
              </div>
            ) : (
              <div className="flex h-36 items-end gap-1 overflow-x-auto pb-1">
                {stats.by_day.map((day) => {
                  const height = Math.max(6, Math.round((day.total_tokens / maxDayTokens) * 128));
                  return (
                    <div
                      key={day.date}
                      className="group flex min-w-[32px] flex-1 flex-col items-center gap-1.5"
                      title={`${day.date}: ${formatTokens(day.total_tokens)} tokens`}
                    >
                      <div
                        className="w-full max-w-[40px] rounded-t-md bg-brand-primary/75 transition-colors group-hover:bg-brand-primary"
                        style={{ height }}
                      />
                      <span className="text-[10px] tabular-nums text-shell-muted">{day.date.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            )}
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
                      <span className="shrink-0 tabular-nums text-[13px] text-shell-muted">
                        {formatTokens(row.total_tokens)}
                      </span>
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
