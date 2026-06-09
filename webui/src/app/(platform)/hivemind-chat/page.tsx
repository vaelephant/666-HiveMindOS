'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { ChatEmptyState, ChatThread } from '@/components/knowledge-base/chat-conversation';
import { ChatDeleteSessionDialog } from '@/components/knowledge-base/chat-delete-session-dialog';
import { ChatHistorySidebar } from '@/components/knowledge-base/chat-history-sidebar';
import { ChatUpgradeDialog } from '@/components/knowledge-base/chat-upgrade-dialog';
import {
  createTask,
  getChatSession,
  getSessionPipeline,
  listChatSessions,
  sendChatMessageStream,
} from '@/lib/kb-api';
import { detectUpgradeSuggestion, manualUpgradeSuggestion } from '@/lib/chat-task-upgrade';
import type { ChatStreamPhase } from '@/lib/kb-api';
import { readCachedSessions, writeCachedSessions } from '@/lib/chat-session-cache';
import { HIVEMIND_HOME_PATH } from '@/config/navigation';
import type { ChatSessionSummary, ChatTurn, SessionPipeline } from '@/lib/kb-types';

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
  const [extracting, setExtracting] = useState(false);
  const [pipeline, setPipeline] = useState<SessionPipeline | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [streamText, setStreamText] = useState('');
  const [streamPhase, setStreamPhase] = useState<ChatStreamPhase | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventBaselineRef = useRef(0);
  const streamAbortRef = useRef<AbortController | null>(null);

  function abortActiveStream() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }

  const syncUrl = useCallback(
    (id: string | null) => {
      if (id) router.replace(`${HIVEMIND_HOME_PATH}?id=${id}`, { scroll: false });
      else router.replace(HIVEMIND_HOME_PATH, { scroll: false });
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
    return () => abortActiveStream();
  }, []);

  useEffect(() => {
    abortActiveStream();
    setPending(null);
    setStreamText('');
    setStreamPhase(null);
  }, [sessionIdFromUrl]);

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
  }, [turns, pending, streamText]);

  function handleNew() {
    abortActiveStream();
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

  function handleDeleteRequest(id: string) {
    setDeleteTargetId(id);
  }

  async function handleDeleteComplete(id: string) {
    await refreshSessions(true);
    if (activeId === id) handleNew();
  }

  const deleteTargetTitle =
    sessions.find((s) => s.id === deleteTargetId)?.title ?? '未命名对话';

  async function watchExtraction(sessionId: string) {
    eventBaselineRef.current = pipeline?.stats.event_count ?? 0;
    setExtracting(true);
    const deadline = Date.now() + 18000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const p = await getSessionPipeline(sessionId);
        setPipeline(p);
        if (p.stats.event_count > eventBaselineRef.current) {
          break;
        }
      } catch {
        break;
      }
    }
    setExtracting(false);
  }

  async function handleSend(text?: string) {
    const q = (text ?? input).trim();
    if (!q || pending !== null) return;
    abortActiveStream();
    const abort = new AbortController();
    streamAbortRef.current = abort;

    setInput('');
    setPending(q);
    setError(null);
    setStreamText('');
    setStreamPhase('gathering');

    try {
      const res = await sendChatMessageStream(
        q,
        activeId,
        {
          onStatus: (phase) => setStreamPhase(phase),
          onToken: (text) => setStreamText((prev) => prev + text),
        },
        undefined,
        abort.signal,
      );
      const sessionId = res.session_id;
      if (!activeId) {
        setActiveId(sessionId);
        syncUrl(sessionId);
      }
      setTurns((prev) => [...prev, res.turn]);
      await refreshSessions(true);
      void watchExtraction(sessionId);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
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
      if (streamAbortRef.current === abort) {
        streamAbortRef.current = null;
      }
      setPending(null);
      setStreamText('');
      setStreamPhase(null);
    }
  }

  const showEmpty = !threadLoading && turns.length === 0 && pending === null;

  const upgradeSuggestion = useMemo(
    () => (pending ? null : detectUpgradeSuggestion(turns)),
    [turns, pending],
  );

  const upgradeDialogSuggestion = useMemo(() => {
    if (upgradeSuggestion?.recommended) return upgradeSuggestion;
    return manualUpgradeSuggestion(turns);
  }, [upgradeSuggestion, turns]);

  async function handleUpgradeConfirm(goal: string, constraints: Record<string, unknown>) {
    setUpgradeSubmitting(true);
    try {
      const task = await createTask(goal, { constraints });
      setUpgradeOpen(false);
      router.push(`/tasks/agent?taskId=${task.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建任务失败');
    } finally {
      setUpgradeSubmitting(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <ChatHistorySidebar
        sessions={sessions}
        activeId={activeId}
        loading={mounted && sessionsLoading}
        extracting={extracting}
        onNew={handleNew}
        onSelect={handleSelect}
        onDelete={handleDeleteRequest}
      />

      <ChatDeleteSessionDialog
        sessionId={deleteTargetId}
        sessionTitle={deleteTargetTitle}
        onClose={() => setDeleteTargetId(null)}
        onDeleted={handleDeleteComplete}
      />

      <ChatUpgradeDialog
        open={upgradeOpen}
        suggestion={upgradeDialogSuggestion}
        turns={turns}
        sessionId={activeId}
        submitting={upgradeSubmitting}
        onClose={() => setUpgradeOpen(false)}
        onConfirm={handleUpgradeConfirm}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
            extracting={extracting}
            pipeline={pipeline}
            streamText={streamText}
            streamPhase={streamPhase}
            upgradeSuggestion={upgradeSuggestion}
            onUpgrade={turns.length > 0 ? () => setUpgradeOpen(true) : undefined}
          />
        )}
      </div>
    </div>
  );
}

function ChatPageShell() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside className="flex h-full w-56 shrink-0 flex-col overflow-hidden border-r border-shell-border bg-shell-panel/50 lg:w-60">
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
