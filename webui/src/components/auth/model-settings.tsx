'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import { useOrgReady } from '@/components/auth/OrgProvider';
import {
  addCustomModel,
  deleteCustomModel,
  getModelSettings,
  saveModelPreferences,
} from '@/lib/kb-api';
import type { ModelProfileSpec, ModelSettingsCatalog } from '@/lib/kb-types';
import { cn } from '@/lib/utils';

function chatProfiles(catalog: ModelSettingsCatalog): ModelProfileSpec[] {
  return [...catalog.system_profiles, ...catalog.custom_profiles].filter((p) => p.kind === 'chat');
}

function embedProfiles(catalog: ModelSettingsCatalog): ModelProfileSpec[] {
  return [...catalog.system_profiles, ...catalog.custom_profiles].filter((p) => p.kind === 'embed');
}

function profileLabel(catalog: ModelSettingsCatalog, id: string): string {
  const hit = [...catalog.system_profiles, ...catalog.custom_profiles].find((p) => p.id === id);
  return hit?.label || hit?.model || id;
}

function ProfileSelect({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: ModelProfileSpec[];
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-shell-text">{label}</span>
      <span className="mt-0.5 block text-[11px] text-shell-muted">{hint}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] text-shell-text outline-none focus:border-brand-primary/40"
      >
        {options.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.available}>
            {p.label || p.id} · {p.model}
            {!p.available ? '（未配置 API Key）' : ''}
            {p.source === 'custom' ? ' · 自定义' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ModelSettings() {
  const { ready, orgId } = useOrgReady();
  const [catalog, setCatalog] = useState<ModelSettingsCatalog | null>(null);
  const [chatProfile, setChatProfile] = useState('default');
  const [fastProfile, setFastProfile] = useState('fast');
  const [embedProfile, setEmbedProfile] = useState('embedding');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    label: '',
    provider: 'openai' as 'openai' | 'anthropic',
    model: '',
    max_tokens: 8192,
  });

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await getModelSettings(orgId);
      setCatalog(data);
      setChatProfile(data.preferences.chat_profile);
      setFastProfile(data.preferences.fast_profile);
      setEmbedProfile(data.preferences.embed_profile);
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '加载失败' });
    } finally {
      setLoading(false);
    }
  }, [orgId, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  const chatOptions = useMemo(() => (catalog ? chatProfiles(catalog) : []), [catalog]);
  const embedOptions = useMemo(() => (catalog ? embedProfiles(catalog) : []), [catalog]);
  const dirty =
    catalog &&
    (chatProfile !== catalog.preferences.chat_profile ||
      fastProfile !== catalog.preferences.fast_profile ||
      embedProfile !== catalog.preferences.embed_profile);

  async function handleSave() {
    if (!catalog) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await saveModelPreferences(
        { chat_profile: chatProfile, fast_profile: fastProfile, embed_profile: embedProfile },
        orgId,
      );
      setCatalog(data);
      setChatProfile(data.preferences.chat_profile);
      setFastProfile(data.preferences.fast_profile);
      setEmbedProfile(data.preferences.embed_profile);
      setMessage({ tone: 'ok', text: '模型偏好已保存，下一条 Chat 将使用新配置' });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '保存失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    if (!form.label.trim() || !form.model.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await addCustomModel(
        {
          label: form.label.trim(),
          provider: form.provider,
          model: form.model.trim(),
          kind: 'chat',
          max_tokens: form.max_tokens,
        },
        orgId,
      );
      setCatalog(data);
      setShowAdd(false);
      setForm({ label: '', provider: 'openai', model: '', max_tokens: 8192 });
      setMessage({ tone: 'ok', text: '自定义模型已添加' });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '添加失败' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profileId: string) {
    if (!window.confirm(`删除自定义模型「${profileLabel(catalog!, profileId)}」？`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await deleteCustomModel(profileId, orgId);
      setCatalog(data);
      setChatProfile(data.preferences.chat_profile);
      setFastProfile(data.preferences.fast_profile);
      setEmbedProfile(data.preferences.embed_profile);
      setMessage({ tone: 'ok', text: '已删除自定义模型' });
    } catch (e) {
      setMessage({ tone: 'err', text: e instanceof Error ? e.message : '删除失败' });
    } finally {
      setSaving(false);
    }
  }

  if (!ready || loading) {
    return (
      <section className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-shell-border bg-shell-panel py-16 text-[13px] text-shell-muted">
        <Loader2 className="size-4 animate-spin" />
        加载模型设置…
      </section>
    );
  }

  if (!catalog) {
    return (
      <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200">
        无法加载模型配置
      </p>
    );
  }

  return (
    <>
      {message ? (
        <p
          className={cn(
            'mt-4 rounded-xl px-4 py-2.5 text-[13px]',
            message.tone === 'ok' ? 'bg-brand-primary/8 text-brand-primary' : 'bg-red-500/8 text-red-600',
          )}
        >
          {message.text}
        </p>
      ) : null}

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-shell-text">默认模型</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">
              对话合成、轻量任务与向量嵌入使用的 profile
            </p>
          </div>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            保存偏好
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <ProfileSelect
            label="Chat 对话"
            hint="回答合成阶段使用（检索仍用系统 chat_tools）"
            value={chatProfile}
            options={chatOptions}
            onChange={setChatProfile}
          />
          <ProfileSelect
            label="轻量任务"
            hint="智慧提取、摘要等后台任务"
            value={fastProfile}
            options={chatOptions}
            onChange={setFastProfile}
          />
          <ProfileSelect
            label="向量嵌入"
            hint="记忆与技能的语义索引"
            value={embedProfile}
            options={embedOptions}
            onChange={setEmbedProfile}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-shell-muted">
          {catalog.providers.map((p) => (
            <span
              key={p.id}
              className={cn(
                'rounded-full px-2.5 py-1',
                p.available ? 'bg-brand-primary/8 text-brand-primary' : 'bg-shell-bg text-shell-subtext',
              )}
            >
              {p.id} {p.available ? '已连接' : '未配置 Key'}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-shell-text">自定义模型</p>
            <p className="mt-0.5 text-[12px] text-shell-muted">添加你自己的 OpenAI / Anthropic 模型 endpoint</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-shell-border px-3 py-2 text-[12px] font-medium text-brand-primary hover:bg-brand-primary/5"
          >
            <Plus className="size-3.5" />
            添加模型
          </button>
        </div>

        {catalog.custom_profiles.length === 0 ? (
          <p className="mt-6 text-center text-[13px] text-shell-muted">尚未添加自定义模型</p>
        ) : (
          <ul className="mt-4 divide-y divide-shell-border">
            {catalog.custom_profiles.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/8">
                    <Box className="size-4 text-brand-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-shell-text">{p.label}</p>
                    <p className="font-mono text-[11px] text-shell-muted">
                      {p.id} · {p.provider} / {p.model}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleDelete(p.id)}
                  className="shrink-0 rounded-lg p-2 text-shell-muted hover:bg-red-500/8 hover:text-red-600 disabled:opacity-50"
                  title="删除"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-shell-border bg-shell-panel p-5">
        <p className="text-[14px] font-semibold text-shell-text">系统模型库</p>
        <p className="mt-0.5 text-[12px] text-shell-muted">来自 models.yaml，由平台统一维护</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {catalog.system_profiles.map((p) => (
            <li
              key={p.id}
              className="rounded-lg border border-shell-border bg-shell-bg/50 px-3 py-2.5 text-[12px]"
            >
              <p className="font-medium text-shell-text">{p.id}</p>
              <p className="mt-0.5 font-mono text-shell-muted">
                {p.provider} / {p.model}
              </p>
              <p className="mt-1 text-[10px] text-shell-subtext">
                {p.kind} · max {p.max_tokens.toLocaleString('zh-CN')}
                {p.optional ? ' · 可选' : ''}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-shell-border bg-shell-panel shadow-xl">
            <div className="flex items-center justify-between border-b border-shell-border px-5 py-4">
              <h3 className="text-[15px] font-semibold text-shell-text">添加自定义模型</h3>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded p-1 text-shell-muted hover:bg-shell-bg">
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="text-[11px] font-medium text-shell-muted">显示名称</span>
                <input
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="例如：我的 Claude Sonnet"
                  className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] outline-none focus:border-brand-primary/40"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-shell-muted">Provider</span>
                <select
                  value={form.provider}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as 'openai' | 'anthropic' }))}
                  className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] outline-none"
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-shell-muted">模型 ID</span>
                <input
                  value={form.model}
                  onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                  placeholder="gpt-4o / claude-sonnet-4-6"
                  className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 font-mono text-[13px] outline-none focus:border-brand-primary/40"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-shell-muted">max_tokens</span>
                <input
                  type="number"
                  min={256}
                  max={128000}
                  value={form.max_tokens}
                  onChange={(e) => setForm((f) => ({ ...f, max_tokens: Number(e.target.value) }))}
                  className="mt-1 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] outline-none"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-shell-border px-5 py-4">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-lg border border-shell-border px-4 py-2 text-[13px] text-shell-muted"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving || !form.label.trim() || !form.model.trim()}
                onClick={() => void handleAdd()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                添加
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
