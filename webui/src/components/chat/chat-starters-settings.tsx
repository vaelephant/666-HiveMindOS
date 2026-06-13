'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { getChatStarters, resetChatStarters, saveChatStarters } from '@/lib/kb-api';
import type { ChatStartersConfig } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<ChatStartersConfig['source'], string> = {
  user: '个人自定义',
  org: '组织默认',
  system: '系统默认',
};

export function ChatStartersSettings() {
  const { ready: orgReady, orgId } = useOrgReady();
  const [config, setConfig] = useState<ChatStartersConfig | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgReady) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getChatStarters(orgId);
      setConfig(data);
      setDraft(data.starters);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [orgId, orgReady]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxCount = config?.limits.max_count ?? 6;
  const maxLength = config?.limits.max_length ?? 120;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const data = await saveChatStarters(draft.filter((s) => s.trim()), orgId);
      setConfig(data);
      setDraft(data.starters);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    setError(null);
    try {
      const data = await resetChatStarters(orgId);
      setConfig(data);
      setDraft(data.starters);
      setSaved(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '重置失败');
    } finally {
      setSaving(false);
    }
  }

  function updateLine(index: number, value: string) {
    setDraft((prev) => prev.map((line, i) => (i === index ? value : line)));
  }

  function removeLine(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function addLine() {
    if (draft.length >= maxCount) return;
    setDraft((prev) => [...prev, '']);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载对话偏好…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-semibold text-shell-text">Chat 快捷问题</h2>
        <p className="mt-1 text-[13px] text-shell-muted">
          新建对话空状态下显示的建议问题，最多 {maxCount} 条，每条不超过 {maxLength} 字。
          {config ? (
            <span className="ml-1 text-shell-subtext">当前来源：{SOURCE_LABEL[config.source]}</span>
          ) : null}
        </p>
      </div>

      <div className="space-y-2">
        {draft.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={line}
              maxLength={maxLength}
              onChange={(e) => updateLine(i, e.target.value)}
              placeholder={`快捷问题 ${i + 1}`}
              className="flex-1 rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/10"
            />
            <button
              type="button"
              onClick={() => removeLine(i)}
              className="rounded-lg p-2 text-shell-muted transition-colors hover:bg-shell-bg hover:text-status-error"
              aria-label="删除"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      {draft.length < maxCount && (
        <button
          type="button"
          onClick={addLine}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-shell-border px-3 py-2 text-[12px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
        >
          <Plus className="size-3.5" />
          添加快捷问题
        </button>
      )}

      {error && <p className="text-[12px] text-status-error">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[12px] font-medium text-brand-on-primary transition-opacity hover:opacity-90 disabled:opacity-50',
            saved && 'bg-status-success',
          )}
        >
          {saving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : saved ? (
            <Check className="size-3.5" />
          ) : null}
          {saved ? '已保存' : '保存'}
        </button>
        <button
          type="button"
          onClick={() => void handleReset()}
          disabled={saving || config?.source !== 'user'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-4 py-2 text-[12px] text-shell-subtext transition-colors hover:text-shell-text disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" />
          恢复组织默认
        </button>
      </div>
    </div>
  );
}
