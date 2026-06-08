'use client';

import { Check, Circle, Loader2 } from 'lucide-react';
import type { PipelineStage } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const STATUS_STYLE = {
  idle: 'border-shell-border bg-shell-bg text-shell-muted',
  active: 'border-brand-primary/40 bg-brand-primary/8 text-brand-primary',
  done: 'border-brand-primary/25 bg-brand-primary/5 text-brand-primary',
} as const;

export function KnowledgePipelineSteps({
  stages,
  compact = false,
}: {
  stages: PipelineStage[];
  compact?: boolean;
}) {
  return (
    <div className={cn('flex', compact ? 'flex-col gap-2' : 'flex-wrap gap-2')}>
      {stages.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-2">
          <StageChip stage={stage} compact={compact} />
          {!compact && i < stages.length - 1 ? (
            <span className="hidden text-shell-muted sm:inline">→</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function StageChip({ stage, compact }: { stage: PipelineStage; compact?: boolean }) {
  const style = STATUS_STYLE[stage.status] ?? STATUS_STYLE.idle;
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-1.5',
        style,
        compact ? 'w-full' : 'min-w-0',
      )}
      title={stage.description}
    >
      <div className="flex items-center gap-1.5">
        <StageIcon status={stage.status} />
        <span className="text-[11px] font-medium">{stage.label}</span>
      </div>
      {stage.hint ? (
        <p className={cn('text-[10px] opacity-80', compact ? 'mt-0.5' : 'mt-0.5 truncate max-w-[140px]')}>
          {stage.hint}
        </p>
      ) : null}
    </div>
  );
}

function StageIcon({ status }: { status: PipelineStage['status'] }) {
  if (status === 'active') {
    return <Loader2 className="size-3 shrink-0 animate-spin" />;
  }
  if (status === 'done') {
    return <Check className="size-3 shrink-0" strokeWidth={2.5} />;
  }
  return <Circle className="size-3 shrink-0 opacity-40" strokeWidth={2} />;
}
