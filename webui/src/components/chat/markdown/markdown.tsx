'use client';

import { useMemo } from 'react';
import { Streamdown, defaultUrlTransform } from 'streamdown';
import type { ChatSource } from '@/lib/kb-types';
import { cn } from '@/lib/utils';
import {
  ChatCitationContext,
  CITE_LINK_PREFIX,
  preprocessChatCitations,
} from '@/components/chat/markdown/citations';
import { CHAT_MARKDOWN_COMPONENTS } from '@/components/chat/markdown/components';
import { chatMarkdownPlugins } from '@/components/chat/markdown/plugins';

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
  const content = useMemo(() => preprocessChatCitations(text), [text]);
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
        plugins={chatMarkdownPlugins}
        components={CHAT_MARKDOWN_COMPONENTS}
        urlTransform={(url, key, node) => {
          if (url.startsWith(CITE_LINK_PREFIX)) return url;
          return defaultUrlTransform(url, key, node);
        }}
        isAnimating={isAnimating}
        animated={isAnimating}
        parseIncompleteMarkdown={isAnimating}
        lineNumbers={false}
        shikiTheme={['github-light', 'github-dark']}
        controls={{
          code: { copy: true, download: false },
          table: { copy: true, download: false },
          mermaid: { copy: true, download: true, fullscreen: true },
        }}
      >
        {content}
      </Streamdown>
    </ChatCitationContext.Provider>
  );
}

export function isChatErrorAnswer(text: string): boolean {
  return text.startsWith('请求失败：');
}
