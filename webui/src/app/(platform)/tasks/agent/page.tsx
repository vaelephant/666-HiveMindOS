'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AgentTasksView } from '@/components/knowledge-base/agent-tasks-view';

function TasksAgentContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  return <AgentTasksView initialTaskId={taskId} />;
}

export default function TasksAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center gap-2 py-20 text-shell-muted">
          <Loader2 className="size-5 animate-spin text-brand-primary" />
          <span className="text-[13px]">加载任务…</span>
        </div>
      }
    >
      <TasksAgentContent />
    </Suspense>
  );
}
