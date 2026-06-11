'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, Loader2, Plug, Trash2 } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import { Button } from '@/components/ui/button';
import {
  bindWeChatWorkUser,
  getWeChatWorkConfig,
  listWeChatWorkBindings,
  resolveUserId,
  saveWeChatWorkConfig,
  testWeChatWorkConnection,
  unbindWeChatWorkUser,
  type WeChatWorkBinding,
} from '@/lib/kb-api';

const KB_PUBLIC_BASE = process.env.NEXT_PUBLIC_KB_API_BASE_URL ?? 'http://localhost:8006';

type FormState = {
  corp_id: string;
  agent_id: string;
  secret: string;
  token: string;
  encoding_aes_key: string;
  enabled: boolean;
};

const EMPTY_FORM: FormState = {
  corp_id: '',
  agent_id: '',
  secret: '',
  token: '',
  encoding_aes_key: '',
  enabled: false,
};

export function WeChatWorkSettings() {
  const { ready: orgReady, orgId } = useOrgReady();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [bindings, setBindings] = useState<WeChatWorkBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bindForm, setBindForm] = useState({ wechat_userid: '', wechat_name: '' });

  const webhookUrl = useMemo(
    () => `${KB_PUBLIC_BASE}/api/v1/webhooks/wechat-work/${orgId}`,
    [orgId],
  );

  const load = useCallback(async () => {
    if (!orgReady) return;
    setLoading(true);
    try {
      const [cfg, bindRes] = await Promise.all([
        getWeChatWorkConfig(orgId),
        listWeChatWorkBindings(orgId),
      ]);
      setBindings(bindRes.bindings);
      if (cfg.configured) {
        setForm({
          corp_id: cfg.corp_id ?? '',
          agent_id: cfg.agent_id ?? '',
          secret: cfg.secret?.includes('****') ? '' : (cfg.secret ?? ''),
          token: cfg.token ?? '',
          encoding_aes_key: cfg.encoding_aes_key?.includes('****') ? '' : (cfg.encoding_aes_key ?? ''),
          enabled: cfg.enabled ?? false,
        });
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [orgId, orgReady]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      await saveWeChatWorkConfig(form, orgId);
      setMessage('配置已保存');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const res = await testWeChatWorkConnection(orgId);
      setMessage(`连接成功，Token: ${res.token_prefix ?? 'ok'}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '连接失败');
    } finally {
      setTesting(false);
    }
  }

  async function handleBind() {
    if (!bindForm.wechat_userid.trim()) return;
    try {
      await bindWeChatWorkUser(
        {
          platform_user_id: resolveUserId(),
          wechat_userid: bindForm.wechat_userid.trim(),
          wechat_name: bindForm.wechat_name.trim() || undefined,
        },
        orgId,
      );
      setBindForm({ wechat_userid: '', wechat_name: '' });
      setMessage('绑定成功');
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '绑定失败');
    }
  }

  async function handleUnbind(id: number) {
    try {
      await unbindWeChatWorkUser(id, orgId);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '解绑失败');
    }
  }

  function copyWebhook() {
    void navigator.clipboard.writeText(webhookUrl);
    setMessage('回调 URL 已复制');
  }

  if (!orgReady || loading) {
    return (
      <div className="flex items-center gap-2 text-shell-muted text-[13px]">
        <Loader2 className="size-4 animate-spin" />
        加载中…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-12">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
          <Plug className="size-5" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-[20px] font-semibold text-shell-fg">企业微信集成</h1>
          <p className="text-[13px] text-shell-muted">配置应用凭证与回调，员工可在企微中与 HiveMind 对话</p>
        </div>
      </div>

      {message && (
        <p className="rounded-lg border border-shell-border bg-shell-surface px-4 py-2 text-[13px] text-shell-fg">
          {message}
        </p>
      )}

      <section className="rounded-xl border border-shell-border bg-shell-surface p-6 space-y-4">
        <h2 className="text-[14px] font-semibold text-shell-fg">回调 URL</h2>
        <p className="text-[12px] text-shell-muted">复制到企业微信后台 → 应用 → 接收消息 → URL</p>
        <div className="flex gap-2">
          <code className="input-field flex-1 truncate px-3 py-2 text-[12px]">{webhookUrl}</code>
          <Button variant="outline" size="sm" onClick={copyWebhook}>
            <Copy className="size-3.5" />
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-shell-border bg-shell-surface p-6 space-y-4">
        <h2 className="text-[14px] font-semibold text-shell-fg">应用配置</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['corp_id', 'CorpID'],
              ['agent_id', 'AgentId'],
              ['secret', 'Secret', 'password'],
              ['token', 'Token (回调)'],
              ['encoding_aes_key', 'EncodingAESKey', 'password'],
            ] as const
          ).map(([key, label, type]) => (
            <label key={key} className="block space-y-1 sm:col-span-1">
              <span className="text-[12px] text-shell-muted">{label}</span>
              <input
                type={type === 'password' ? 'password' : 'text'}
                className="input-field h-9 w-full text-[13px]"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
          />
          启用企业微信集成
        </label>
        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : '保存配置'}
          </Button>
          <Button variant="outline" onClick={() => void handleTest()} disabled={testing}>
            {testing ? <Loader2 className="size-4 animate-spin" /> : '测试连接'}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-shell-border bg-shell-surface p-6 space-y-4">
        <h2 className="text-[14px] font-semibold text-shell-fg">账号绑定</h2>
        <p className="text-[12px] text-shell-muted">
          将当前登录用户（{resolveUserId()}）绑定到企微成员 userid，未绑定用户发消息会收到引导提示。
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input-field h-9 min-w-[140px] flex-1 text-[13px]"
            placeholder="企微 userid"
            value={bindForm.wechat_userid}
            onChange={(e) => setBindForm((b) => ({ ...b, wechat_userid: e.target.value }))}
          />
          <input
            className="input-field h-9 min-w-[120px] flex-1 text-[13px]"
            placeholder="显示名称（可选）"
            value={bindForm.wechat_name}
            onChange={(e) => setBindForm((b) => ({ ...b, wechat_name: e.target.value }))}
          />
          <Button variant="outline" onClick={() => void handleBind()}>
            绑定当前用户
          </Button>
        </div>
        {bindings.length > 0 && (
          <ul className="divide-y divide-shell-border rounded-lg border border-shell-border">
            {bindings.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3 text-[13px]">
                <span>
                  <CheckCircle2 className="mr-1.5 inline size-3.5 text-emerald-500" />
                  {b.wechat_name || b.wechat_userid}
                  <span className="ml-2 text-shell-muted">→ {b.platform_user_id}</span>
                </span>
                <button
                  type="button"
                  className="text-shell-muted hover:text-red-500"
                  onClick={() => void handleUnbind(b.id)}
                  aria-label="解绑"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
