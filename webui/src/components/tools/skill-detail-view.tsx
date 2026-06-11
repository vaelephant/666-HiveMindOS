'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { WikiMarkdown } from '@/components/knowledge-base/wiki-markdown';
import { getAgentSkill } from '@/lib/kb-api';
import { parseSkillMarkdown, skillDetailHref } from '@/lib/skill-links';

export function SkillDetailView({ skillName }: { skillName: string }) {
  const { ready: orgReady, orgId } = useOrgReady();
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgReady || !skillName) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getAgentSkill(skillName, orgId)
      .then((d) => {
        if (!cancelled) setContent(d.content);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgReady, orgId, skillName]);

  const parsed = content ? parseSkillMarkdown(content) : null;
  const titleMatch = parsed?.body.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || skillName;

  return (
    <div className="w-full py-6 md:py-8">
      <Link
        href="/tools"
        className="inline-flex items-center gap-1.5 text-[13px] text-shell-muted transition-colors hover:text-brand-primary"
      >
        <ArrowLeft className="size-3.5" />
        返回 Agent Skills
      </Link>

      <header className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
            <Sparkles className="size-6 text-amber-600 dark:text-amber-400" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-shell-muted">Agent Skill</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-shell-text md:text-[22px]">
              {title}
            </h2>
            {parsed?.description && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-shell-muted">{parsed.description}</p>
            )}
            <p className="mt-2 font-mono text-[11px] text-shell-muted">{skillName}</p>
          </div>
        </div>
      </header>

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        {loading && (
          <div className="flex items-center gap-2 py-12 text-[13px] text-shell-muted">
            <Loader2 className="size-4 animate-spin" />
            加载 Skill…
          </div>
        )}
        {error && (
          <div className="py-8 text-center">
            <p className="text-[13px] text-red-600">{error}</p>
            <Link href="/tools" className="mt-3 inline-block text-[13px] text-brand-primary hover:underline">
              返回列表
            </Link>
          </div>
        )}
        {parsed && (
          <WikiMarkdown md={parsed.body} />
        )}
      </section>

      <p className="mt-4 text-center text-[12px] text-shell-muted">
        Chat 会根据你的问题自动召回相关 Skill；无需手动 @ 引用。
      </p>
    </div>
  );
}
