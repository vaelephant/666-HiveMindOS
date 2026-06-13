'use client';

import Link from 'next/link';
import { ArrowUp, Bot, Brain, ChevronDown, Loader2, Sparkles, User, Wrench } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TurnEvolutionHint } from '@/components/chat/evolution-panel';
import { ChatMarkdown, isChatErrorAnswer } from '@/components/chat/markdown/markdown';
import { ChatTurnActions } from '@/components/chat/turn-actions';
import { ChatUpgradeSessionBanner, ChatUpgradeTurnHint } from '@/components/chat/upgrade-hint';
import type { ChatSource, ChatTurn, MemoryUsed, SessionPipeline, SkillUsed } from '@/lib/kb-types';
import type { UpgradeSuggestion } from '@/lib/chat-task-upgrade';
import { HIVEMIND_MEMORIES_PATH } from '@/config/navigation';
import { skillDetailHref } from '@/lib/skill-links';
import { MEMORY_TYPE_LABEL } from '@/lib/kb-labels';
import { wikiHref } from '@/lib/wiki-links';
import { cn } from '@/lib/utils';

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
      <div className="max-w-[min(92%,52rem)] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-shell-panel px-3.5 py-2.5 text-[14px] leading-7 text-shell-text shadow-sm ring-1 ring-shell-border/80">
        {text}
      </div>
      <Avatar role="user" />
    </div>
  );
}

function AssistantContent({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-sm ring-1',
        error
          ? 'bg-status-error/5 ring-status-error/30'
          : 'bg-shell-panel/70 ring-shell-border/60',
      )}
    >
      {children}
    </div>
  );
}

function SourcePill({
  source,
  index,
  highlighted,
  innerRef,
}: {
  source: ChatTurn['sources'][number];
  index: number;
  highlighted?: boolean;
  innerRef?: (el: HTMLAnchorElement | null) => void;
}) {
  return (
    <Link
      ref={innerRef}
      href={wikiHref(source.path)}
      className={cn(
        'inline-flex max-w-[200px] items-center gap-1.5 rounded-full border border-shell-border bg-shell-bg px-2.5 py-1 text-[11px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary',
        highlighted && 'border-brand-primary/50 bg-brand-primary/5 ring-2 ring-brand-primary/25',
      )}
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
      href={HIVEMIND_MEMORIES_PATH}
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

function SkillPill({ skill }: { skill: SkillUsed }) {
  const label = skill.description
    ? skill.description.split('：').pop()?.slice(0, 40) || skill.name
    : skill.name;
  return (
    <Link
      href={skillDetailHref(skill.name)}
      className="inline-flex max-w-[240px] items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/5 px-2.5 py-1 text-[11px] text-amber-800 transition-colors hover:border-amber-500/40 dark:text-amber-300"
      title={skill.description || skill.name}
    >
      <Wrench className="size-3 shrink-0" />
      <span className="truncate">{label}</span>
      <span className="shrink-0 rounded bg-amber-500/10 px-1 text-[9px]">Skill</span>
    </Link>
  );
}

function ContextChips({
  turn,
  open,
  onOpenChange,
  highlightedSourceIndex = null,
  onSourceRef,
}: {
  turn: ChatTurn;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  highlightedSourceIndex?: number | null;
  onSourceRef?: (index: number, el: HTMLAnchorElement | null) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const hasMemories = (turn.memories_used?.length ?? 0) > 0;
  const hasSkills = (turn.skills_used?.length ?? 0) > 0;
  const hasSources = turn.sources.length > 0;
  const count =
    (turn.memories_used?.length ?? 0) + (turn.skills_used?.length ?? 0) + turn.sources.length;

  if (!hasMemories && !hasSkills && !hasSources) {
    if (!isOpen) return null;
    return (
      <div className="mt-3 rounded-lg border border-shell-border/80 bg-shell-bg/60 px-3 py-2 text-[11px] text-shell-muted">
        引用 [{highlightedSourceIndex ?? '…'}] — 暂无 Wiki 来源详情（刷新后记忆/技能引用可能未加载）
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 text-[11px] text-shell-muted transition-colors hover:text-shell-subtext"
      >
        <ChevronDown className={cn('size-3 transition-transform', isOpen && 'rotate-180')} />
        引用 {count} 条来源
      </button>
      {isOpen && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {turn.memories_used?.map((m) => (
            <MemoryPill key={m.id} memory={m} />
          ))}
          {turn.skills_used?.map((s) => (
            <SkillPill key={s.name} skill={s} />
          ))}
          {turn.sources.map((s, i) => (
            <SourcePill
              key={s.path}
              source={s}
              index={i + 1}
              highlighted={highlightedSourceIndex === i + 1}
              innerRef={(el) => onSourceRef?.(i + 1, el)}
            />
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
  turnIndex,
  sessionId,
  onFollowUp,
  onCreateTaskFromTurn,
  onEnqueueTurn,
  showEvolutionHint,
  showUpgradeHint,
  upgradeSuggestion,
  onUpgrade,
  extracting,
  pipeline,
}: {
  turn: ChatTurn;
  turnIndex: number;
  sessionId: string | null;
  onFollowUp: (q: string) => void;
  onCreateTaskFromTurn?: (turnIndex: number) => void;
  onEnqueueTurn?: (turnIndex: number) => Promise<void>;
  showEvolutionHint?: boolean;
  showUpgradeHint?: boolean;
  upgradeSuggestion?: UpgradeSuggestion | null;
  onUpgrade?: () => void;
  extracting?: boolean;
  pipeline?: SessionPipeline | null;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlightedCitation, setHighlightedCitation] = useState<number | null>(null);
  const [highlightedSourceIndex, setHighlightedSourceIndex] = useState<number | null>(null);
  const sourceRefs = useRef<Map<number, HTMLAnchorElement | null>>(new Map());
  const highlightTimerRef = useRef<number | null>(null);
  const hasSources =
    turn.sources.length > 0
    || (turn.memories_used?.length ?? 0) > 0
    || (turn.skills_used?.length ?? 0) > 0;

  const handleSourceRef = useCallback((index: number, el: HTMLAnchorElement | null) => {
    if (el) sourceRefs.current.set(index, el);
    else sourceRefs.current.delete(index);
  }, []);

  const handleCitationClick = useCallback((index: number) => {
    setSourcesOpen(true);
    setHighlightedCitation(index);
    setHighlightedSourceIndex(index);
    if (highlightTimerRef.current != null) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedCitation(null);
      setHighlightedSourceIndex(null);
      highlightTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    if (!sourcesOpen || highlightedSourceIndex == null) return;
    const timer = window.setTimeout(() => {
      sourceRefs.current.get(highlightedSourceIndex)?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [sourcesOpen, highlightedSourceIndex]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current != null) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  const isError = isChatErrorAnswer(turn.answer);

  return (
    <div className="flex gap-2.5 py-3">
      <Avatar role="assistant" />
      <div className="min-w-0 flex-1 pt-0.5 pr-1">
        <AssistantContent error={isError}>
          <ChatMarkdown
            key={`answer-${turnIndex}`}
            text={turn.answer}
            sources={turn.sources}
            highlightedCitation={highlightedCitation}
            onCitationClick={handleCitationClick}
            variant={isError ? 'error' : 'default'}
          />
        </AssistantContent>
        <ChatTurnActions
          turn={turn}
          turnIndex={turnIndex}
          sessionId={sessionId}
          hasSources={hasSources}
          onCreateTask={
            onCreateTaskFromTurn ? () => onCreateTaskFromTurn(turnIndex) : undefined
          }
          onEnqueue={onEnqueueTurn}
          onShowSources={hasSources ? () => setSourcesOpen(true) : undefined}
        />
        <ContextChips
          turn={turn}
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
          highlightedSourceIndex={highlightedSourceIndex}
          onSourceRef={handleSourceRef}
        />
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
  streamSources = [],
}: {
  streamText?: string;
  streamPhase?: 'gathering' | 'writing' | null;
  streamSources?: ChatSource[];
}) {
  return (
    <div className="flex gap-2.5 py-3">
      <Avatar role="assistant" />
      <div className="min-w-0 flex-1 pt-0.5 pr-1">
        {streamText ? (
          <AssistantContent>
            <ChatMarkdown
              text={streamText}
              isAnimating
              sources={streamSources}
            />
          </AssistantContent>
        ) : (
          <AssistantContent>
            <div className="flex items-center gap-2.5 py-0.5 text-[13px] text-shell-muted">
              <Loader2 className="size-3.5 animate-spin text-brand-primary" />
              {streamPhase === 'writing' ? '正在生成回答…' : '正在检索 Wiki 与智慧记忆…'}
            </div>
          </AssistantContent>
        )}
      </div>
    </div>
  );
}

function TurnPair({
  turn,
  turnIndex,
  sessionId,
  onFollowUp,
  onCreateTaskFromTurn,
  onEnqueueTurn,
  showEvolutionHint,
  showUpgradeHint,
  upgradeSuggestion,
  onUpgrade,
  extracting,
  pipeline,
}: {
  turn: ChatTurn;
  turnIndex: number;
  sessionId: string | null;
  onFollowUp: (q: string) => void;
  onCreateTaskFromTurn?: (turnIndex: number) => void;
  onEnqueueTurn?: (turnIndex: number) => Promise<void>;
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
        turnIndex={turnIndex}
        sessionId={sessionId}
        onFollowUp={onFollowUp}
        onCreateTaskFromTurn={onCreateTaskFromTurn}
        onEnqueueTurn={onEnqueueTurn}
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

export function ChatEmptyState({
  input,
  onInputChange,
  onSend,
  disabled,
  suggestions = [],
}: {
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  disabled: boolean;
  suggestions?: string[];
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
        提问或描述目标，系统将检索 Wiki 与智慧记忆并回答
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
        {suggestions.map((s) => (
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
  sessionId = null,
  extracting = false,
  pipeline = null,
  streamText = '',
  streamPhase = null,
  streamSources = [],
  upgradeSuggestion = null,
  onUpgrade,
  onCreateTaskFromTurn,
  onEnqueueTurn,
}: {
  turns: ChatTurn[];
  pending: string | null;
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  sessionId?: string | null;
  extracting?: boolean;
  pipeline?: SessionPipeline | null;
  streamText?: string;
  streamPhase?: 'gathering' | 'writing' | null;
  streamSources?: ChatSource[];
  upgradeSuggestion?: UpgradeSuggestion | null;
  onUpgrade?: () => void;
  onCreateTaskFromTurn?: (turnIndex: number) => void;
  onEnqueueTurn?: (turnIndex: number) => Promise<void>;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinToBottomRef = useRef(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      pinToBottomRef.current = distance < 96;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (pending) {
      pinToBottomRef.current = true;
    }
  }, [pending]);

  useEffect(() => {
    if (!pinToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({
      behavior: streamText ? 'auto' : 'smooth',
    });
  }, [turns, pending, streamText, bottomRef]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div ref={scrollRef} className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-5 py-4">
          {turns.map((turn, i) => (
            <TurnPair
              key={`${i}-${turn.question.slice(0, 24)}`}
              turn={turn}
              turnIndex={i}
              sessionId={sessionId}
              onFollowUp={onSend}
              onCreateTaskFromTurn={onCreateTaskFromTurn}
              onEnqueueTurn={onEnqueueTurn}
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
              <AssistantPending
                streamText={streamText}
                streamPhase={streamPhase}
                streamSources={streamSources}
              />
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
            回答基于 Wiki 与智慧记忆，重要决策请核实原文
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
