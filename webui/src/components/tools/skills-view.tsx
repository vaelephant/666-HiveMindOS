'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronRight, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { createAgentSkill, listAgentSkills } from '@/lib/kb-api';
import { skillDetailHref } from '@/lib/skill-links';
import type { AgentSkillSummary } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

function skillBlurb(preview: string): string {
  return preview.replace(/^---[\s\S]*?---\n?/, '').trim().slice(0, 160);
}

function CreateSkillDialog({
  saving,
  onClose,
  onSubmit,
}: {
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    steps: string[];
    scenario: string[];
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [scenarioText, setScenarioText] = useState('');

  function handleSubmit() {
    const steps = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const scenario = scenarioText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    onSubmit({ title: title.trim(), description: description.trim(), steps, scenario });
  }

  const canSubmit = title.trim() && description.trim() && stepsText.trim().split('\n').some((s) => s.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-shell-border bg-shell-panel shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-shell-border px-5 py-4">
          <h3 className="text-[15px] font-semibold text-shell-text">新建 Skill</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-shell-muted hover:bg-shell-bg">
            <X className="size-4" />
          </button>
        </div>

        <div className="custom-scrollbar space-y-3 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">做什么（标题）</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：整理竞品报价对比表"
              className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">一句话说明</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Chat 召回时展示的摘要"
              className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">推荐步骤（每行一条）</span>
            <textarea
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={4}
              placeholder={'检索 Wiki 竞品档案\n补充公开报价线索\n输出 Markdown 对比表'}
              className="mt-1 w-full resize-y rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] leading-relaxed text-shell-text outline-none focus:border-brand-primary/40"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-shell-muted">适用场景（可选，每行一条）</span>
            <textarea
              value={scenarioText}
              onChange={(e) => setScenarioText(e.target.value)}
              rows={2}
              placeholder="销售需要快速产出竞品对比"
              className="mt-1 w-full resize-y rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] leading-relaxed text-shell-text outline-none focus:border-brand-primary/40"
            />
          </label>
          <p className="text-[11px] text-shell-muted">
            保存后 Chat 会按问题自动召回；也可在
            <Link href="/tasks/agent" className="mx-1 text-brand-primary hover:underline">
              自主任务
            </Link>
            高分完成后自动生成。
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-shell-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-shell-border px-4 py-2 text-[13px] text-shell-muted hover:bg-shell-bg"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || !canSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {saving && <Loader2 className="size-3.5 animate-spin" />}
            创建
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkillsView() {
  const router = useRouter();
  const { ready: orgReady, orgId } = useOrgReady();
  const [skills, setSkills] = useState<AgentSkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async () => {
    if (!orgReady) return;
    setLoading(true);
    try {
      setSkills(await listAgentSkills(orgId));
    } finally {
      setLoading(false);
    }
  }, [orgReady, orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(payload: {
    title: string;
    description: string;
    steps: string[];
    scenario: string[];
  }) {
    setCreating(true);
    setMessage(null);
    try {
      const skill = await createAgentSkill(
        {
          title: payload.title,
          description: payload.description,
          steps: payload.steps,
          scenario: payload.scenario.length > 0 ? payload.scenario : undefined,
        },
        orgId,
      );
      setShowCreate(false);
      await refresh();
      router.push(skillDetailHref(skill.name));
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '创建失败' });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="w-full pb-6 md:pb-8">
      {showCreate && orgReady && (
        <CreateSkillDialog
          saving={creating}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}

      <header className="rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-primary/8">
              <Sparkles className="size-6 text-brand-primary" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-[11px] font-medium tracking-wide text-shell-muted">工具箱</p>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-shell-text md:text-[24px]">
                Agent Skills
              </h2>
              <p className="mt-1 max-w-xl text-[13px] text-shell-muted">
                可复用的任务做法；手动新建或自主任务高分自动沉淀，Chat 会按问题自动召回。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/tools/registry"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-shell-border bg-shell-bg px-4 py-2 text-[12px] font-medium text-shell-muted hover:text-brand-primary"
            >
              工具注册表 →
            </Link>
            <button
              type="button"
              disabled={!orgReady || loading}
              onClick={() => setShowCreate(true)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              新建 Skill
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

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
            加载 Skills…
          </div>
        ) : skills.length === 0 ? (
          <div className="py-12 text-center">
            <BookOpen className="mx-auto size-8 text-shell-muted/50" />
            <p className="mt-3 text-[14px] font-medium text-shell-text">暂无 Skill</p>
            <p className="mt-1 text-[13px] text-shell-muted">
              点右上角「新建 Skill」，或完成
              <Link href="/tasks/agent" className="mx-1 text-brand-primary hover:underline">
                自主任务
              </Link>
              后自动生成。
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-4 py-2 text-[13px] font-medium text-brand-primary hover:bg-brand-primary/5"
            >
              <Plus className="size-3.5" />
              新建第一个 Skill
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-shell-border">
            {skills.map((skill) => (
              <li key={skill.name}>
                <Link
                  href={skillDetailHref(skill.name)}
                  className={cn(
                    'flex w-full items-start gap-3 py-4 text-left transition-colors',
                    'hover:bg-shell-bg/60 rounded-lg px-2 -mx-2',
                  )}
                >
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/8">
                    <Sparkles className="size-4 text-brand-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold text-shell-text">{skill.name}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-shell-muted">
                      {skillBlurb(skill.preview)}
                    </p>
                  </div>
                  <ChevronRight className="mt-2 size-4 shrink-0 text-shell-muted" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
