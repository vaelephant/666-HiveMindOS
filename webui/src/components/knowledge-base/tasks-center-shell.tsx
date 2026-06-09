'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TASK_CENTER_CHILDREN } from '@/config/navigation';

const TAB_HINT: Record<string, string> = {
  tasks_agent:
    '提交开放目标，由 Agent 自主规划、执行并反思；适合 Wiki 整理、方案撰写等一次性复杂任务。',
  tasks_ops:
    '按 Cron 周期运行的内置运维任务，如记忆提炼、候选池处理；无需每次手动提交。',
};

export function TasksCenterShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const activeKey =
    TASK_CENTER_CHILDREN.find(
      (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`),
    )?.navKey ?? 'tasks_agent';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-shell-border bg-shell-panel/80 px-4 py-3 backdrop-blur-sm md:px-6">
        <nav className="flex flex-wrap gap-1" aria-label="任务中心">
          {TASK_CENTER_CHILDREN.map((tab) => {
            const active = tab.navKey === activeKey;
            return (
              <Link
                key={tab.navKey}
                href={tab.href}
                className={[
                  'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/20'
                    : 'text-shell-muted hover:bg-shell-panel-hover hover:text-shell-text',
                ].join(' ')}
              >
                <tab.icon className="size-4 shrink-0 opacity-90" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-2 text-[12px] leading-relaxed text-shell-muted">
          {TAB_HINT[activeKey]}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 md:px-6">{children}</div>
    </div>
  );
}
