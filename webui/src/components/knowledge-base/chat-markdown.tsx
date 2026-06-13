'use client';

import { createContext, useContext, useMemo } from 'react';
import { Streamdown, defaultUrlTransform, type Components } from 'streamdown';
import { code } from '@streamdown/code';
import { cjk } from '@streamdown/cjk';
import type { ChatSource } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

const CHAT_PLUGINS = { code, cjk };
const CITE_LINK_PREFIX = '#chat-cite-';

type ChatCitationContextValue = {
  sources: ChatSource[];
  highlightedCitation: number | null;
  onCitationClick?: (index: number) => void;
};

const ChatCitationContext = createContext<ChatCitationContextValue>({
  sources: [],
  highlightedCitation: null,
});

/** Turn inline citation markers like [1] into internal markdown links Streamdown always routes through `a`. */
function preprocessChatMarkdown(text: string): string {
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

function ChatAnchor({
  href,
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<'a'> & { node?: unknown }) {
  const { sources, highlightedCitation, onCitationClick } = useContext(ChatCitationContext);

  if (href?.startsWith(CITE_LINK_PREFIX)) {
    const index = Number.parseInt(href.slice(CITE_LINK_PREFIX.length), 10);
    if (Number.isFinite(index)) {
      const source = sources[index - 1];
      return (
        <CitationPill
          index={index}
          source={source}
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

/** Stable component map — citation interactivity reads from ChatCitationContext via ChatAnchor. */
const CHAT_COMPONENTS: Components = {
  h2: ({ children, className, ...props }) => (
    <h2
      {...props}
      className={cn(
        'mt-4 mb-1.5 text-[15px] font-semibold text-shell-text first:mt-0 [&:first-child]:mt-0',
        className,
      )}
    >
      {children}
    </h2>
  ),
  h3: ({ children, className, ...props }) => (
    <h3
      {...props}
      className={cn('mt-3 mb-1 text-[14px] font-semibold text-shell-text first:mt-0', className)}
    >
      {children}
    </h3>
  ),
  p: ({ children, className, ...props }) => (
    <p {...props} className={cn('text-[14px] leading-7 text-shell-subtext', className)}>
      {children}
    </p>
  ),
  ul: ({ children, className, ...props }) => (
    <ul {...props} className={cn('my-2.5 list-disc space-y-1.5 pl-5', className)}>
      {children}
    </ul>
  ),
  ol: ({ children, className, ...props }) => (
    <ol {...props} className={cn('my-2.5 list-decimal space-y-1.5 pl-5', className)}>
      {children}
    </ol>
  ),
  li: ({ children, className, ...props }) => (
    <li
      {...props}
      className={cn('text-[14px] leading-7 text-shell-subtext marker:text-shell-muted', className)}
    >
      {children}
    </li>
  ),
  strong: ({ children, className, ...props }) => (
    <strong {...props} className={cn('font-semibold text-shell-text', className)}>
      {children}
    </strong>
  ),
  blockquote: ({ children, className, ...props }) => (
    <blockquote
      {...props}
      className={cn(
        'my-3 rounded-r-lg border-l-[3px] border-brand-primary/45 bg-shell-bg/80 py-2 pl-3.5 pr-3 text-[13px] leading-7 text-shell-subtext',
        className,
      )}
    >
      {children}
    </blockquote>
  ),
  inlineCode: ({ children, className, ...props }) => (
    <code
      {...props}
      className={cn(
        'rounded-md bg-shell-bg px-1.5 py-0.5 font-mono text-[12px] text-shell-text ring-1 ring-shell-border/80',
        className,
      )}
    >
      {children}
    </code>
  ),
  a: ChatAnchor as Components['a'],
  table: ({ children, className, ...props }) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-shell-border">
      <table {...props} className={cn('w-full text-[13px]', className)}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, className, ...props }) => (
    <th
      {...props}
      className={cn(
        'border-b border-shell-border bg-shell-bg px-3 py-2 text-left font-semibold text-shell-text',
        className,
      )}
    >
      {children}
    </th>
  ),
  td: ({ children, className, ...props }) => (
    <td
      {...props}
      className={cn('border-b border-shell-border/60 px-3 py-2 text-shell-subtext', className)}
    >
      {children}
    </td>
  ),
};

export function ChatMarkdown({
  text,
  isAnimating = false,
  sources = [],
  highlightedCitation = null,
  onCitationClick,
  variant = 'default',
}: {
  text: string;
  isAnimating?: boolean;
  sources?: ChatSource[];
  highlightedCitation?: number | null;
  onCitationClick?: (index: number) => void;
  variant?: 'default' | 'error';
}) {
  const content = useMemo(() => preprocessChatMarkdown(text), [text]);
  const citationContext = useMemo(
    () => ({ sources, highlightedCitation, onCitationClick }),
    [sources, highlightedCitation, onCitationClick],
  );

  return (
    <ChatCitationContext.Provider value={citationContext}>
      <Streamdown
        className={cn(
          'space-y-1.5 [&>*:first-child]:mt-0',
          variant === 'error' && 'text-status-error [&_p]:text-status-error',
          highlightedCitation != null && `cite-highlight-${highlightedCitation}`,
        )}
        plugins={CHAT_PLUGINS}
        components={CHAT_COMPONENTS}
        urlTransform={(url, key, node) => {
          if (url.startsWith(CITE_LINK_PREFIX)) return url;
          return defaultUrlTransform(url, key, node);
        }}
        isAnimating={isAnimating}
        animated={isAnimating}
        parseIncompleteMarkdown={isAnimating}
        lineNumbers={false}
        shikiTheme={['github-light', 'github-dark']}
        controls={{ code: { copy: true, download: false }, table: { copy: true, download: false } }}
      >
        {content}
      </Streamdown>
    </ChatCitationContext.Provider>
  );
}

export function isChatErrorAnswer(text: string): boolean {
  return text.startsWith('请求失败：');
}
