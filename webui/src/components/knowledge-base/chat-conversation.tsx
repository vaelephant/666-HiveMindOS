'use client';

import Link from 'next/link';
import { ArrowUp, BookOpen, Bot, Brain, Loader2 } from 'lucide-react';
import type { ChatTurn, MemoryType, MemoryUsed } from '@/lib/kb-types';
import { wikiHref } from '@/lib/wiki-links';

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
        <h3 key={i} className="mt-5 mb-2 text-[15px] font-semibold text-shell-text">
          {renderInline(line.slice(3))}
        </h3>,
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={i} className="mt-4 mb-1 text-[14px] font-semibold text-shell-text">
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
        <ul key={`ul-${i}`} className="my-3 space-y-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-[14px] leading-7 text-shell-subtext">
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
        <ol key={`ol-${i}`} className="my-3 space-y-2">
          {items.map((item, j) => (
            <li key={j} className="flex gap-2.5 text-[14px] leading-7 text-shell-subtext">
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

  return <div className="space-y-2">{elements}</div>;
}

const MEMORY_TYPE_LABEL: Record<MemoryType, string> = {
  project: '项目',
  preference: '偏好',
  decision: '决策',
};

function MemoryUsedChip({ memory }: { memory: MemoryUsed }) {
  return (
    <Link
      href="/memories"
      className="flex min-w-0 flex-col gap-1 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2.5 transition-colors hover:border-violet-500/35"
    >
      <div className="flex items-center gap-1.5">
        <Brain className="size-3 shrink-0 text-violet-600" />
        <span className="truncate text-[12px] font-medium text-shell-text">{memory.title}</span>
        <span className="shrink-0 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-600">
          {MEMORY_TYPE_LABEL[memory.memory_type]}
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-[1.5] text-shell-muted">{memory.content}</p>
    </Link>
  );
}

function SourceCard({ source, index }: { source: ChatTurn['sources'][number]; index: number }) {
  return (
    <Link
      href={wikiHref(source.path)}
      className="flex w-44 shrink-0 flex-col gap-1.5 rounded-xl border border-shell-border bg-shell-bg p-3 text-left transition-colors hover:border-brand-primary/40"
    >
      <div className="flex items-center gap-1.5">
        <span className="flex size-4 shrink-0 items-center justify-center rounded bg-brand-primary/15 text-[9px] font-bold text-brand-primary">
          {index}
        </span>
        <span className="min-w-0 truncate text-[12px] font-medium text-shell-text">
          {source.name}
        </span>
      </div>
      <p className="line-clamp-2 text-[11px] leading-[1.5] text-shell-muted">{source.excerpt}</p>
    </Link>
  );
}

function QABlock({ turn, onFollowUp }: { turn: ChatTurn; onFollowUp: (q: string) => void }) {
  return (
    <div className="space-y-5">
      <h2 className="text-[20px] font-semibold tracking-tight text-shell-text">{turn.question}</h2>

      {(turn.memories_used?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-shell-muted">
            智慧召回
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {turn.memories_used!.map((m) => (
              <MemoryUsedChip key={m.id} memory={m} />
            ))}
          </div>
        </div>
      )}

      {turn.sources.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-shell-muted">
            知识库来源
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {turn.sources.map((s, i) => (
              <SourceCard key={s.path} source={s} index={i + 1} />
            ))}
          </div>
        </div>
      )}

      <div>
        <ChatMarkdown text={turn.answer} />
      </div>

      {turn.follow_ups.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-shell-muted">
            相关问题
          </p>
          <div className="space-y-1.5">
            {turn.follow_ups.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onFollowUp(q)}
                className="flex w-full items-center gap-2 rounded-xl border border-shell-border bg-shell-panel px-4 py-2.5 text-left text-[13px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
              >
                <BookOpen className="size-3.5 shrink-0 text-shell-muted" />
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PendingBlock({ question }: { question: string }) {
  return (
    <div className="space-y-5">
      <h2 className="text-[20px] font-semibold tracking-tight text-shell-text">{question}</h2>
      <div className="flex items-center gap-3 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin text-brand-primary" />
        正在查阅知识库与智慧…
      </div>
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
      className={`flex items-end gap-2 rounded-2xl border border-shell-border bg-shell-panel shadow-lg shadow-black/5 focus-within:border-brand-primary/50 ${
        large ? 'px-5 py-4' : 'px-4 py-3'
      }`}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={large ? 2 : 1}
        autoFocus={large}
        className={`custom-scrollbar max-h-36 flex-1 resize-none bg-transparent text-shell-text outline-none placeholder:text-shell-muted ${
          large ? 'text-[15px]' : 'text-[14px]'
        }`}
      />
      <button
        type="button"
        onClick={onSend}
        disabled={!value.trim() || disabled}
        className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-primary text-brand-on-primary shadow-sm transition-opacity disabled:opacity-40 hover:opacity-90 ${
          large ? 'size-9' : 'size-8'
        }`}
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
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-primary/10">
        <Bot className="size-7 text-brand-primary" strokeWidth={1.5} />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold text-shell-text">企业知识助手</h1>
      <p className="mt-1.5 text-[13px] text-shell-muted">
        只管提问，系统自动检索知识库并召回你的长期智慧 · 答案标注出处
      </p>

      <div className="mt-8 w-full max-w-2xl">
        <ChatInputBar
          value={input}
          onChange={onInputChange}
          onSend={() => onSend()}
          disabled={disabled}
          placeholder="输入问题，按 Enter 发送"
          large
        />
      </div>

      <div className="mt-6 grid w-full max-w-2xl grid-cols-2 gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSend(s)}
            className="rounded-xl border border-shell-border bg-shell-panel px-4 py-3 text-left text-[13px] text-shell-subtext transition-colors hover:border-brand-primary/40 hover:text-brand-primary"
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
}: {
  turns: ChatTurn[];
  pending: string | null;
  input: string;
  onInputChange: (v: string) => void;
  onSend: (text?: string) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-12 px-4 py-10">
          {turns.map((turn, i) => (
            <div key={i}>
              <QABlock turn={turn} onFollowUp={onSend} />
              {i < turns.length - 1 && <hr className="mt-12 border-shell-border" />}
            </div>
          ))}
          {pending && <PendingBlock question={pending} />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="sticky bottom-0 border-t border-shell-border bg-shell-surface/80 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-2xl">
          <ChatInputBar
            value={input}
            onChange={onInputChange}
            onSend={() => onSend()}
            disabled={pending !== null}
            placeholder="继续提问…"
          />
        </div>
      </div>
    </>
  );
}
