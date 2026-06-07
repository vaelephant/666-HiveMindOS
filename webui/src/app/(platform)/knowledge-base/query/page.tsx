'use client';

import { useRef, useState } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';
import { queryKnowledge } from '@/lib/kb-api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  error?: boolean;
};

const EXAMPLES = [
  '报价超过多少金额需要审批？',
  '我们的折扣政策是什么？',
  '销售跟进的完整流程是什么？',
  '客户合同签署需要哪些步骤？',
];

export default function QueryPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const result = await queryKnowledge(question);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.answer,
          sources: result.source_pages,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: err instanceof Error ? err.message : '请求失败，请检查后端服务是否运行',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex w-full flex-col py-16">
            <h1 className="text-[22px] font-semibold tracking-tight text-shell-text">知识问答</h1>
            <p className="mt-2 max-w-lg text-[15px] text-shell-muted">
              基于企业 Wiki，回答业务问题并标注来源
            </p>
            <ul className="mt-10 grid w-full grid-cols-1 gap-0 sm:grid-cols-2 xl:grid-cols-4">
              {EXAMPLES.map((q) => (
                <li key={q} className="border-t border-shell-border">
                  <button
                    type="button"
                    onClick={() => send(q)}
                    className="w-full py-4 text-left text-[14px] text-shell-subtext transition-colors hover:text-brand-primary"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="w-full divide-y divide-shell-border">
            {messages.map((m) => (
              <div key={m.id} className="py-8">
                <p className="text-[11px] font-medium tracking-wide text-shell-muted">
                  {m.role === 'user' ? '你' : '知识库'}
                </p>
                <pre
                  className={`mt-3 whitespace-pre-wrap font-sans text-[15px] leading-relaxed ${
                    m.error ? 'text-status-error' : 'text-shell-text'
                  }`}
                >
                  {m.content}
                </pre>
                {m.sources && m.sources.length > 0 && (
                  <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1">
                    {m.sources.map((s) => (
                      <li key={s} className="text-[12px] text-brand-primary">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 py-8 text-shell-muted">
                <Loader2 className="size-4 animate-spin" />
                <span className="text-[14px]">正在检索知识库…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-shell-border py-4">
        <div className="flex items-end gap-3">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
            }}
            placeholder="输入问题，按 Enter 发送"
            className="min-h-[44px] flex-1 resize-none border-0 border-b border-shell-border bg-transparent py-2 text-[15px] text-shell-text outline-none transition-colors placeholder:text-shell-muted focus:border-brand-primary"
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex size-9 shrink-0 items-center justify-center text-brand-primary transition-opacity disabled:opacity-30"
            aria-label="发送"
          >
            <ArrowUp className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
