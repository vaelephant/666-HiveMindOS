'use client';

import Link from 'next/link';
import { ArrowUp, Bot, Brain, ChevronDown, Loader2, Sparkles, User } from 'lucide-react';
import { useState } from 'react';
import { TurnEvolutionHint } from '@/components/knowledge-base/chat-evolution-panel';
import { ChatUpgradeSessionBanner, ChatUpgradeTurnHint } from '@/components/knowledge-base/chat-upgrade-hint';
import type { ChatTurn, MemoryUsed, SessionPipeline } from '@/lib/kb-types';
import type { UpgradeSuggestion } from '@/lib/chat-task-upgrade';
import { MEMORY_TYPE_LABEL } from '@/lib/kb-labels';
import { wikiHref } from '@/lib/wiki-links';
import { cn } from '@/lib/utils';

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|\[\d+\])/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-shell-text">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^\[\d+\]$/.test(part)) {
      return (
        <sup key={i} className="mx-0.5">
          <span className="inline-flex h-[15px] min-w-[15px] items-center justify-center rounded bg-brand-primary/15 px-[3px] text-[9px] font-bold leading-none text-brand-primary">
            {part.slice(1, -1)}
          </span>
        </sup>
      );
    }
    return part;
  });
}

function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={i} className="mt-4 mb-1.5 text-[15px] font-semibold text-shell-text first:mt-0">
          {renderInline(line.slice(3))}
        </h3>,
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="mt-3 mb-1 text-[14px] font-semibold text-shell-text first:mt-0">
          {renderInline(line.slice(4))}
        </h4>,
      );
      i++;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2.5 space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-[14px] leading-7 text-shell-subtext">
              <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-shell-muted" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2.5 space-y-1.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2 text-[14px] leading-7 text-shell-subtext">
              <span className="mt-0.5 shrink-0 text-[12px] font-semibold text-shell-muted">
                {j + 1}.
              </span>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    elements.push(
      <p key={i} className="text-[14px] leading-7 text-shell-subtext">
        {renderInline(line)}
      </p>,
    );
    i++;
  }

  return <div className="space-y-1.5">{elements}</div>;
}


function Avatar({ role }: { role: 'user' | 'assistant' }) {
  return (
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        role === 'user'
          ? 'bg-shell-border text-shell-subtext'
          : 'bg-brand-primary/12 text-brand-primary',
      )}
    >
      {role === 'user' ? (
        <User className="size-4" strokeWidth={1.75} />
      ) : (
        <Sparkles className="size-4" strokeWidth={1.75} />
      )}
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="group flex justify-end gap-2.5 py-3">
      <div className="max-w-[min(92%,52rem)] rounded-2xl rounded-tr-md bg-shell-panel px-3.5 py-2.5 text-[14px] leading-7 text-shell-text shadow-sm ring-1 ring-shell-border/80">
        {text}
      </div>
      <Avatar role="user" />
    </div>
  );
}

function SourcePill({ source, index }: { source: ChatTurn['sources'][number]; index: number }) {
  return (
    <Link
      href={wikiHref(source.path)}
      className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full border border-shell-border bg-shell-bg px-2.5 py-1 text-[11px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
      title={source.excerpt}
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-[9px] font-bold text-brand-primary">
        {index}
      </span>
      <span className="truncate">{source.name}</span>
    </Link>
  );
}

function MemoryPill({ memory }: { memory: MemoryUsed }) {
  return (
    <Link
      href="/memories"
      className="inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-violet-500/25 bg-violet-500/5 px-2.5 py-1 text-[11px] text-violet-700 transition-colors hover:border-violet-500/40 dark:text-violet-300"
      title={memory.content}
    >
      <Brain className="size-3 shrink-0" />
      <span className="truncate">{memory.title}</span>
      <span className="shrink-0 rounded bg-violet-500/10 px-1 text-[9px]">
        {MEMORY_TYPE_LABEL[memory.memory_type]}
      </span>
    </Link>
  );
}

function ContextChips({ turn }: { turn: ChatTurn }) {
  const [open, setOpen] = useState(false);
  const hasMemories = (turn.memories_used?.length ?? 0) > 0;
  const hasSources = turn.sources.length > 0;
  const count = (turn.memories_used?.length ?? 0) + turn.sources.length;

  if (!hasMemories && !hasSources) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[11px] text-shell-muted transition-colors hover:text-shell-subtext"
      >
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
        引用 {count} 条来源
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {turn.memories_used?.map((m) => (
            <MemoryPill key={m.id} memory={m} />
          ))}
          {turn.sources.map((s, i) => (
            <SourcePill key={s.path} source={s} index={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function FollowUpChips({ items, onSelect }: { items: string[]; onSelect: (q: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onSelect(q)}
          className="rounded-full border border-shell-border bg-shell-panel px-3 py-1.5 text-left text-[12px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

function AssistantMessage({
  turn,
  onFollowUp,
  showEvolutionHint,
  showUpgradeHint,
  upgradeSuggestion,
  onUpgrade,
  extracting,
  pipeline,
}: {
  turn: ChatTurn;
  onFollowUp: (q: string) => void;
  showEvolutionHint?: boolean;
  showUpgradeHint?: boolean;
  upgradeSuggestion?: UpgradeSuggestion | null;
  onUpgrade?: () => void;
  extracting?: boolean;
  pipeline?: SessionPipeline | null;
}) {
  return (
    <div className="flex gap-2.5 py-3">
      <Avatar role="assistant" />
      <div className="min-w-0 flex-1 pt-0.5 pr-1">
        <ChatMarkdown text={turn.answer} />
        <ContextChips turn={turn} />
        {showEvolutionHint && (
          <div className="mt-3">
            <TurnEvolutionHint extracting={!!extracting} pipeline={pipeline ?? null} />
          </div>
        )}
        {showUpgradeHint && upgradeSuggestion && onUpgrade && (
          <ChatUpgradeTurnHint suggestion={upgradeSuggestion} onUpgrade={onUpgrade} />
        )}
        <FollowUpChips items={turn.follow_ups} onSelect={onFollowUp} />
      </div>
    </div>
  );
}

function AssistantPending({
  streamText,
  streamPhase,
}: {
  streamText?: string;
  streamPhase?: 'gathering' | 'writing' | null;
}) {
  return (
    <div className="flex gap-2.5 py-3">
      <Avatar role="assistant" />
      <div className="min-w-0 flex-1 pt-0.5 pr-1">
        {streamText ? (
          <div>
            <ChatMarkdown text={streamText} />
            <span className="mt-1 inline-block h-4 w-0.5 animate-pulse bg-brand-primary" />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 text-[13px] text-shell-muted">
            <Loader2 className="size-3.5 animate-spin text-brand-primary" />
            {streamPhase === 'writing' ? '正在生成回答…' : '正在查阅知识库与智慧…'}
          </div>
        )}
      </div>
    </div>
  );
}

function TurnPair({
  turn,
  onFollowUp,
  showEvolutionHint,
  showUpgradeHint,
  upgradeSuggestion,
  onUpgrade,
  extracting,
  pipeline,
}: {
  turn: ChatTurn;
  onFollowUp: (q: string) => void;
  showEvolutionHint?: boolean;
  showUpgradeHint?: boolean;
  upgradeSuggestion?: UpgradeSuggestion | null;
  onUpgrade?: () => void;
  extracting?: boolean;
  pipeline?: SessionPipeline | null;
}) {
  return (
    <div className="border-b border-shell-border/60 last:border-b-0">
      <UserMessage text={turn.question} />
      <AssistantMessage
        turn={turn}
        onFollowUp={onFollowUp}
        showEvolutionHint={showEvolutionHint}
        showUpgradeHint={showUpgradeHint}
        upgradeSuggestion={upgradeSuggestion}
        onUpgrade={onUpgrade}
        extracting={extracting}
        pipeline={pipeline}
      />
    </div>
  );
}

export function ChatInputBar({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  large,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  large?: boolean;
}) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  return (
    <div
      className={cn(
        'flex items-end gap-2 rounded-[26px] border border-shell-border bg-shell-panel shadow-lg shadow-black/5 transition-colors focus-within:border-brand-primary/40 focus-within:ring-2 focus-within:ring-brand-primary/10',
        large ? 'px-5 py-3.5' : 'px-4 py-2.5',
      )}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={large ? 2 : 1}
        autoFocus={large}
        className={cn(
          'custom-scrollbar max-h-36 flex-1 resize-none bg-transparent text-shell-text outline-none placeholder:text-shell-muted',
          large ? 'text-[15px]' : 'text-[14px]',
        )}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim() || disabled}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-brand-primary text-brand-on-primary transition-opacity disabled:opacity-40 hover:opacity-90',
          large ? 'size-9' : 'size-8',
        )}
      >
        <ArrowUp className="size-4" />
      </button>
    </div>
  );
}

const SUGGESTIONS = [
  '报价超过多少金额需要审批？',
  '中康尚德的应收款情况是什么',
  '有哪些涉及税务合规的规则',
  '销售跟进的完整流程是什么？',
];

export function ChatEmptyState({
  input,
  onInputChange,
  onSend,
  disabled,
}: {
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-8">
      <div className="flex size-12 items-center justify-center rounded-full bg-brand-primary/10">
        <Bot className="size-6 text-brand-primary" strokeWidth={1.5} />
      </div>
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight text-shell-text">
        有什么可以帮你的？
      </h1>
      <p className="mt-2 text-[13px] text-shell-muted">
        检索企业知识库，召回你的长期智慧
      </p>

      <div className="mt-10 w-full max-w-5xl">
        <ChatInputBar
          value={input}
          onChange={onInputChange}
          onSend={() => onSend()}
          disabled={disabled}
          placeholder="输入问题，按 Enter 发送"
          large
        />
      </div>

      <div className="mt-5 flex w-full max-w-5xl flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSend(s)}
            className="rounded-full border border-shell-border bg-shell-panel px-4 py-2 text-[12px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatThread({
  turns,
  pending,
  input,
  onInputChange,
  onSend,
  bottomRef,
  extracting = false,
  pipeline = null,
  streamText = '',
  streamPhase = null,
  upgradeSuggestion = null,
  onUpgrade,
}: {
  turns: ChatTurn[];
  pending: string | null;
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  extracting?: boolean;
  pipeline?: SessionPipeline | null;
  streamText?: string;
  streamPhase?: 'gathering' | 'writing' | null;
  upgradeSuggestion?: UpgradeSuggestion | null;
  onUpgrade?: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-5 py-4">
          {turns.map((turn, i) => (
            <TurnPair
              key={i}
              turn={turn}
              onFollowUp={onSend}
              showEvolutionHint={i === turns.length - 1 && !pending}
              showUpgradeHint={i === turns.length - 1 && !pending && !!onUpgrade}
              upgradeSuggestion={upgradeSuggestion}
              onUpgrade={onUpgrade}
              extracting={extracting}
              pipeline={pipeline}
            />
          ))}
          {pending && (
            <div className="border-b border-shell-border/60 last:border-b-0">
              <UserMessage text={pending} />
              <AssistantPending streamText={streamText} streamPhase={streamPhase} />
            </div>
          )}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      <div className="shrink-0 bg-gradient-to-t from-shell-bg via-shell-bg to-transparent px-5 pb-4 pt-2">
        <div className="mx-auto w-full max-w-5xl">
          {upgradeSuggestion && onUpgrade && (
            <ChatUpgradeSessionBanner
              suggestion={upgradeSuggestion}
              turnCount={turns.length}
              onUpgrade={onUpgrade}
            />
          )}
          <ChatInputBar
            value={input}
            onChange={onInputChange}
            onSend={() => onSend()}
            disabled={pending !== null}
            placeholder="发送消息…"
          />
          <p className="mt-2 text-center text-[11px] text-shell-muted">
            回答基于知识库与智慧记忆，重要决策请核实原文
            {onUpgrade && turns.length > 0 && !upgradeSuggestion?.recommended && (
              <>
                {' · '}
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="text-brand-primary hover:underline"
                >
                  从此对话创建任务
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
