'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ChatEmptyState, ChatThread } from '@/components/knowledge-base/chat-conversation';
import { ChatHistorySidebar } from '@/components/knowledge-base/chat-history-sidebar';
import {
  deleteChatSession,
  getChatSession,
  listChatSessions,
  sendChatMessage,
} from '@/lib/kb-api';
import { readCachedSessions, writeCachedSessions } from '@/lib/chat-session-cache';
import type { ChatSessionSummary, ChatTurn } from '@/lib/kb-types';

function ThreadLoading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-shell-muted">
      <Loader2 className="size-5 animate-spin text-brand-primary" />
      <span className="text-[13px]">加载对话…</span>
    </div>
  );
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('id');

  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [mounted, setMounted] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(sessionIdFromUrl);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(!!sessionIdFromUrl);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const syncUrl = useCallback(
    (id: string | null) => {
      if (id) router.replace(`/chat?id=${id}`, { scroll: false });
      else router.replace('/chat', { scroll: false });
    },
    [router],
  );

  const refreshSessions = useCallback(async (silent = false) => {
    if (!silent) setSessionsLoading(true);
    try {
      const list = await listChatSessions();
      setSessions(list);
      writeCachedSessions(list);
      return list;
    } finally {
      if (!silent) setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 并行加载：侧栏列表 + 当前对话（若有 id）
  useEffect(() => {
    let cancelled = false;
    setError(null);

    const cached = readCachedSessions();
    if (cached.length > 0) setSessions(cached);

    setSessionsLoading(true);
    if (sessionIdFromUrl) {
      setThreadLoading(true);
      setActiveId(sessionIdFromUrl);
    } else {
      setThreadLoading(false);
      setActiveId(null);
      setTurns([]);
    }

    const listPromise = listChatSessions();
    const sessionPromise = sessionIdFromUrl
      ? getChatSession(sessionIdFromUrl)
      : Promise.resolve(null);

    Promise.all([listPromise, sessionPromise])
      .then(([list, session]) => {
        if (cancelled) return;
        setSessions(list);
        writeCachedSessions(list);
        if (session) {
          setActiveId(session.id);
          setTurns(session.turns);
          setPending(null);
        } else if (!sessionIdFromUrl) {
          setTurns([]);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) {
          setSessionsLoading(false);
          setThreadLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [sessionIdFromUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pending]);

  function handleNew() {
    setActiveId(null);
    setTurns([]);
    setPending(null);
    setInput('');
    setThreadLoading(false);
    syncUrl(null);
  }

  function handleSelect(id: string) {
    setError(null);
    setActiveId(id);
    syncUrl(id);
  }

  async function handleDelete(id: string) {
    await deleteChatSession(id).catch(() => {});
    await refreshSessions(true);
    if (activeId === id) handleNew();
  }

  async function handleSend(text?: string) {
    const q = (text ?? input).trim();
    if (!q || pending !== null) return;
    setInput('');
    setPending(q);
    setError(null);

    try {
      const res = await sendChatMessage(q, activeId);
      if (!activeId) {
        setActiveId(res.session_id);
        syncUrl(res.session_id);
      }
      setTurns((prev) => [...prev, res.turn]);
      await refreshSessions(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发送失败';
      setError(msg);
      setTurns((prev) => [
        ...prev,
        {
          question: q,
          answer: `请求失败：${msg}`,
          sources: [],
          follow_ups: [],
        },
      ]);
    } finally {
      setPending(null);
    }
  }

  const showEmpty = !threadLoading && turns.length === 0 && pending === null;

  return (
    <div className="flex min-h-[calc(100dvh-3.25rem)]">
      <ChatHistorySidebar
        sessions={sessions}
        activeId={activeId}
        loading={mounted && sessionsLoading}
        onNew={handleNew}
        onSelect={handleSelect}
        onDelete={handleDelete}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {error && (
          <div className="border-b border-status-error/30 bg-status-error/5 px-4 py-2 text-[13px] text-status-error">
            {error}
          </div>
        )}

        {threadLoading ? (
          <ThreadLoading />
        ) : showEmpty ? (
          <ChatEmptyState
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            disabled={pending !== null}
          />
        ) : (
          <ChatThread
            turns={turns}
            pending={pending}
            input={input}
            onInputChange={setInput}
            onSend={handleSend}
            bottomRef={bottomRef}
          />
        )}
      </div>
    </div>
  );
}

function ChatPageShell() {
  return (
    <div className="flex min-h-[calc(100dvh-3.25rem)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-shell-border bg-shell-panel/50 lg:w-60">
        <div className="p-3">
          <div className="h-10 animate-pulse rounded-xl bg-shell-border/40" />
        </div>
        <div className="flex-1 space-y-1 px-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-shell-border/30" />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 items-center justify-center text-shell-muted">
        <Loader2 className="size-5 animate-spin" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageShell />}>
      <ChatPageContent />
    </Suspense>
  );
}
