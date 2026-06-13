import type { Components } from 'streamdown';
import { ChatCitationLink } from '@/components/chat/markdown/citations';
import { cn } from '@/lib/utils';

export const CHAT_MARKDOWN_COMPONENTS: Components = {
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
  a: ChatCitationLink as Components['a'],
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
