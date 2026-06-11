'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Eye, Loader2, RotateCcw, Save } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { WikiMarkdown } from '@/components/knowledge-base/wiki-markdown';
import {
  getOrgPlaybook,
  previewOrgPlaybook,
  resetOrgPlaybook,
  saveOrgPlaybook,
} from '@/lib/kb-api';
import type { OrgPlaybookPreview } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

export function PlaybookEditor() {
  const { ready: orgReady, orgId } = useOrgReady();
  const [content, setContent] = useState('');
  const [source, setSource] = useState<'default' | 'override'>('default');
  const [defaultTitle, setDefaultTitle] = useState('HiveMind');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<OrgPlaybookPreview | null>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!orgReady) return;
    setLoading(true);
    try {
      const pb = await getOrgPlaybook(orgId);
      setContent(pb.content);
      setSource(pb.source);
      setDefaultTitle(pb.default_title);
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [orgReady, orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgReady || loading) return;
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const p = await previewOrgPlaybook(content, orgId);
        setPreview(p);
      } catch {
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [content, orgReady, orgId, loading]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const pb = await saveOrgPlaybook(content, orgId);
      setSource(pb.source);
      const cleared = pb.pinned_sessions_cleared ?? 0;
      setMessage({
        tone: 'ok',
        text:
          cleared > 0
            ? `Playbook 已保存，已刷新 ${cleared} 个活跃会话；下一条消息将使用新内容`
            : 'Playbook 已保存，下一条 Chat 消息将使用更新内容',
      });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!window.confirm('恢复为系统默认 Playbook？组织自定义内容将被删除。')) return;
    setSaving(true);
    setMessage(null);
    try {
      const pb = await resetOrgPlaybook(orgId);
      setContent(pb.content);
      setSource(pb.source);
      const cleared = pb.pinned_sessions_cleared ?? 0;
      setMessage({
        tone: 'ok',
        text:
          cleared > 0
            ? `已恢复默认 Playbook，并刷新 ${cleared} 个活跃会话`
            : '已恢复默认 Playbook',
      });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '重置失败' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full py-6 md:py-8">
      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <BookOpen className="size-6 text-brand-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">集成 · 组织上下文</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                Org Playbook
              </h2>
              <p className="mt-1 max-w-xl text-[13px] text-shell-muted">
                会话开始时冻结注入 Chat，塑造组织语气与操作守则（类似 Hermes SOUL.md / AGENTS.md）。
                当前来源：
                <span
                  className={cn(
                    'ml-1 font-medium',
                    source === 'override' ? 'text-brand-primary' : 'text-shell-text',
                  )}
                >
                  {source === 'override' ? '组织自定义' : `系统默认 · ${defaultTitle}`}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-3 py-2 text-[12px] font-medium text-shell-muted hover:text-brand-primary disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" />
              恢复默认
            </button>
            <button
              type="button"
              disabled={saving || loading || !content.trim()}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              保存
            </button>
          </div>
        </div>
      </header>

      {message && (
        <p
          className={cn(
            'mt-4 rounded-xl px-4 py-2.5 text-[13px]',
            message.tone === 'ok' ? 'bg-brand-primary/8 text-brand-primary' : 'bg-red-500/8 text-red-600',
          )}
        >
          {message.text}
        </p>
      )}

      {loading ? (
        <section className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-shell-border bg-shell-panel py-16 text-[13px] text-shell-muted">
          <Loader2 className="size-4 animate-spin" />
          加载 Playbook…
        </section>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-shell-border bg-shell-panel p-5">
            <label className="block">
              <span className="text-[11px] font-medium text-shell-muted">Markdown 内容</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={22}
                spellCheck={false}
                className="mt-2 w-full resize-y rounded-xl border border-shell-border bg-shell-bg px-4 py-3 font-mono text-[13px] leading-relaxed text-shell-text outline-none focus:border-brand-primary/40"
                placeholder="## 组织守则&#10;- 回答简洁专业&#10;- 引用 Wiki 时注明来源"
              />
            </label>
            <p className="mt-3 text-[12px] text-shell-muted">
              也可在服务器直接编辑
              <code className="mx-1 rounded bg-shell-bg px-1.5 py-0.5 text-[11px]">
                storage/orgs/&#123;org_id&#125;/playbook.md
              </code>
              。企微通道共用同一 Playbook，见
              <Link href="/integrations/wechat-work" className="ml-1 text-brand-primary hover:underline">
                企业微信集成
              </Link>
              。
            </p>
          </section>

          <section className="flex flex-col rounded-2xl border border-shell-border bg-shell-panel p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-brand-primary" />
                <span className="text-[13px] font-semibold text-shell-text">Chat 常驻上下文预览</span>
              </div>
              {previewLoading ? (
                <Loader2 className="size-3.5 animate-spin text-shell-muted" />
              ) : preview ? (
                <span className="text-[11px] text-shell-muted">
                  {preview.char_count}/{preview.char_limit} 字
                  {preview.truncated && ' · 将截断'}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[12px] text-shell-muted">
              新会话首条消息时冻结；右侧为 Playbook + 高价值智慧的实际注入效果。
            </p>

            <div className="mt-4 min-h-[280px] flex-1 overflow-y-auto rounded-xl border border-shell-border bg-shell-bg p-4">
              {preview?.block ? (
                <WikiMarkdown md={preview.block} />
              ) : (
                <p className="text-[13px] text-shell-muted">输入内容以生成预览…</p>
              )}
            </div>

            {preview && preview.memories_count > 0 && (
              <div className="mt-3 rounded-xl bg-violet-500/5 px-3 py-2.5">
                <p className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
                  附带 {preview.memories_count} 条常驻智慧
                </p>
                <ul className="mt-1.5 space-y-1">
                  {preview.memories.slice(0, 5).map((m) => (
                    <li key={m.id} className="truncate text-[11px] text-shell-muted">
                      [{m.memory_type_label}] {m.title}
                    </li>
                  ))}
                  {preview.memories_count > 5 && (
                    <li className="text-[11px] text-shell-muted">…还有 {preview.memories_count - 5} 条</li>
                  )}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
