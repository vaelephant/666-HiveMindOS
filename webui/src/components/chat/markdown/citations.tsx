'use client';

import { createContext, useContext } from 'react';
import type { ChatSource } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

export const CITE_LINK_PREFIX = '#chat-cite-';

export type ChatCitationContextValue = {
  sources: ChatSource[];
  highlightedCitation: number | null;
  onCitationClick?: (index: number) => void;
};

export const ChatCitationContext = createContext<ChatCitationContextValue>({
  sources: [],
  highlightedCitation: null,
});

export function preprocessChatCitations(text: string): string {
  return text.replace(/\[(\d+)\](?!\()/g, (_, n: string) => `[${n}](${CITE_LINK_PREFIX}${n})`);
}

function CitationPill({
  index,
  source,
  isHighlighted,
  onClick,
}: {
  index: number;
  source?: ChatSource;
  isHighlighted: boolean;
  onClick?: () => void;
}) {
  const indexStr = String(index);
  const pill = (
    <span
      className={cn(
        'inline-flex h-[15px] min-w-[15px] items-center justify-center rounded px-[3px] text-[9px] font-bold leading-none',
        'bg-brand-primary/15 text-brand-primary',
        onClick && 'cursor-pointer transition-colors hover:bg-brand-primary/30',
        isHighlighted && 'bg-brand-primary text-brand-on-primary ring-2 ring-brand-primary/30',
      )}
    >
      {indexStr}
    </span>
  );

  if (!onClick) {
    return (
      <sup className="mx-0.5 not-italic" title={source?.excerpt}>
        {pill}
      </sup>
    );
  }

  return (
    <sup className="relative z-10 mx-0.5 not-italic">
      <button
        type="button"
        title={source?.excerpt || source?.name || `查看引用 ${indexStr}`}
        aria-label={
          source ? `查看来源 ${indexStr}：${source.name}` : `查看引用 ${indexStr}`
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        className="inline-flex align-baseline border-0 bg-transparent p-0"
      >
        {pill}
      </button>
    </sup>
  );
}

export function ChatCitationLink({
  href,
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'a'> & { node?: unknown }) {
  const { sources, highlightedCitation, onCitationClick } = useContext(ChatCitationContext);

  if (href?.startsWith(CITE_LINK_PREFIX)) {
    const index = Number.parseInt(href.slice(CITE_LINK_PREFIX.length), 10);
    if (Number.isFinite(index)) {
      return (
        <CitationPill
          index={index}
          source={sources[index - 1]}
          isHighlighted={highlightedCitation === index}
          onClick={onCitationClick ? () => onCitationClick(index) : undefined}
        />
      );
    }
  }

  return (
    <a
      {...props}
      href={href}
      className={cn(
        'font-medium text-brand-primary underline-offset-2 hover:underline',
        className,
      )}
    >
      {children}
    </a>
  );
}
