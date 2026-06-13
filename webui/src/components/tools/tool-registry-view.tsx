'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Loader2,
  Plug,
  RefreshCw,
  Server,
  Wrench,
} from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { getToolCatalog, patchExternalTool } from '@/lib/kb-api';
import type { ExternalTool, ToolCatalog } from '@/lib/kb-api';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<string, string> = {
  mcp: 'MCP',
  http: 'HTTP',
  builtin: '内置',
};

function ExternalToolRow({
  tool,
  busy,
  onToggle,
  onSaveEndpoint,
}: {
  tool: ExternalTool;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onSaveEndpoint: (endpoint: string) => void;
}) {
  const [endpoint, setEndpoint] = useState(tool.endpoint ?? '');

  useEffect(() => {
    setEndpoint(tool.endpoint ?? '');
  }, [tool.endpoint]);

  return (
    <li className="px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-medium text-shell-text">{tool.label}</span>
            <code className="rounded bg-shell-bg px-1.5 py-0.5 text-[11px] text-shell-muted">{tool.tool_id}</code>
            <span className="rounded-md bg-brand-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase text-brand-primary">
              {KIND_LABEL[tool.kind] ?? tool.kind}
            </span>
          </div>
          {tool.description && (
            <p className="mt-1 text-[13px] text-shell-muted">{tool.description}</p>
          )}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="min-w-0 flex-1">
              <span className="text-[11px] font-medium text-shell-muted">Endpoint / URL</span>
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder={tool.kind === 'mcp' ? 'MCP SSE URL 或留空使用 config' : 'https://…'}
                className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 font-mono text-[12px] text-shell-text outline-none focus:border-brand-primary/40"
              />
            </label>
            <button
              type="button"
              disabled={busy || endpoint === (tool.endpoint ?? '')}
              onClick={() => onSaveEndpoint(endpoint.trim())}
              className="shrink-0 rounded-lg border border-shell-border px-3 py-2 text-[12px] font-medium text-shell-text hover:bg-shell-bg disabled:opacity-40 sm:mt-5"
            >
              保存地址
            </button>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(!tool.enabled)}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-50',
            tool.enabled
              ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/25'
              : 'border border-shell-border bg-shell-panel text-shell-muted hover:text-shell-text',
          )}
        >
          {tool.enabled ? (
            <>
              <CheckCircle2 className="size-3.5" aria-hidden />
              已启用
            </>
          ) : (
            <>
              <Circle className="size-3.5" aria-hidden />
              未启用
            </>
          )}
        </button>
      </div>
    </li>
  );
}

export function ToolRegistryView() {
  const { orgId, ready } = useOrgReady();
  const [catalog, setCatalog] = useState<ToolCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ready || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getToolCatalog(orgId);
      setCatalog(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [ready, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggle(tool: ExternalTool, enabled: boolean) {
    if (!orgId) return;
    setBusyId(tool.tool_id);
    setMessage(null);
    try {
      const updated = await patchExternalTool(tool.tool_id, { enabled }, orgId);
      setCatalog((prev) => {
        if (!prev) return prev;
        const external = prev.external.map((t) => (t.tool_id === updated.tool_id ? updated : t));
        return {
          ...prev,
          external,
          enabled_external: external.filter((t) => t.enabled).length,
        };
      });
      setMessage(enabled ? `「${tool.label}」已启用` : `「${tool.label}」已关闭`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新失败');
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEndpoint(tool: ExternalTool, endpoint: string) {
    if (!orgId) return;
    setBusyId(tool.tool_id);
    setMessage(null);
    try {
      const updated = await patchExternalTool(tool.tool_id, { endpoint: endpoint || undefined }, orgId);
      setCatalog((prev) =>
        prev
          ? { ...prev, external: prev.external.map((t) => (t.tool_id === updated.tool_id ? updated : t)) }
          : prev,
      );
      setMessage(`「${tool.label}」地址已保存`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full space-y-4 pb-8 md:space-y-5">
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <Plug className="size-6 text-brand-primary" strokeWidth={1.5} aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">工具箱</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                工具注册表 / MCP
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-shell-muted">
                管理 Agent 可调用的内置 action 与外部 MCP / HTTP 工具。启用后可在工作流{' '}
                <code className="text-brand-primary">tool.*</code> 步骤中引用（运行时 invoke 后续接入）。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-3.5 py-2 text-[13px] font-medium text-shell-text transition-colors hover:border-brand-primary/30 hover:text-brand-primary disabled:opacity-50"
          >
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            刷新
          </button>
        </div>
      </header>

      {catalog && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: '内置 Action', value: catalog.builtin_count, hint: 'task_tools.yaml' },
            { label: '外部工具', value: catalog.external_count, hint: 'MCP / HTTP' },
            { label: '已启用外部', value: catalog.enabled_external, hint: '对 Agent 可见', accent: true },
            { label: '目录合计', value: catalog.builtin_count + catalog.external_count, hint: 'builtin + external' },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-shell-border bg-shell-panel px-4 py-3.5">
              <p className="text-[12px] text-shell-muted">{card.label}</p>
              <p
                className={cn(
                  'mt-1.5 text-[26px] font-semibold tabular-nums leading-none',
                  card.accent ? 'text-brand-primary' : 'text-shell-text',
                )}
              >
                {card.value}
              </p>
              {card.hint ? <p className="mt-2 text-[11px] text-shell-subtext">{card.hint}</p> : null}
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-4 py-2.5 text-[13px] text-brand-primary">
          {message}
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-shell-border bg-shell-panel">
        <div className="flex items-center gap-2 border-b border-shell-border px-4 py-3">
          <Wrench className="size-4 text-brand-primary" aria-hidden />
          <h2 className="text-[14px] font-semibold text-shell-text">内置 Action</h2>
          <span className="text-[12px] text-shell-muted">只读 · 来自 task_tools.yaml</span>
        </div>
        {loading && !catalog ? (
          <div className="flex items-center justify-center gap-2 py-12 text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
            加载目录…
          </div>
        ) : (
          <ul className="divide-y divide-shell-border">
            {(catalog?.builtin ?? []).map((tool) => (
              <li key={tool.tool_id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-shell-text">{tool.label}</span>
                    <code className="rounded bg-shell-bg px-1.5 py-0.5 text-[11px] text-shell-muted">
                      {tool.tool_id}
                    </code>
                    {tool.domain && (
                      <span className="text-[11px] text-shell-muted">{tool.domain}</span>
                    )}
                  </div>
                  {tool.description && (
                    <p className="mt-0.5 text-[12px] text-shell-muted">{tool.description}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  始终可用
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-shell-border bg-shell-panel">
        <div className="flex items-center gap-2 border-b border-shell-border px-4 py-3">
          <Server className="size-4 text-brand-primary" aria-hidden />
          <h2 className="text-[14px] font-semibold text-shell-text">外部工具 / MCP</h2>
          <span className="text-[12px] text-shell-muted">可启用并配置 endpoint</span>
        </div>
        {loading && !catalog ? (
          <div className="flex items-center justify-center gap-2 py-12 text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : (catalog?.external.length ?? 0) === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-shell-muted">
            暂无外部工具模板。请确认数据库迁移 013_external_tools 已执行。
          </p>
        ) : (
          <ul className="divide-y divide-shell-border">
            {catalog!.external.map((tool) => (
              <ExternalToolRow
                key={tool.tool_id}
                tool={tool}
                busy={busyId === tool.tool_id}
                onToggle={(enabled) => void handleToggle(tool, enabled)}
                onSaveEndpoint={(endpoint) => void handleSaveEndpoint(tool, endpoint)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
