'use client';

import React, { useState } from 'react';
import {
  Bell,
  Building2,
  Check,
  ChevronRight,
  Cpu,
  Gauge,
  Globe2,
  Link2,
  Map,
  Moon,
  Shield,
  Sun,
  Zap,
} from 'lucide-react';

type SectionId = 'workspace' | 'alerts' | 'maps' | 'integrations';

const sections: { id: SectionId; label: string; hint: string }[] = [
  { id: 'workspace', label: 'Workspace', hint: 'Org & defaults' },
  { id: 'alerts', label: 'Alerts', hint: 'How we notify you' },
  { id: 'maps', label: '地图与实况', hint: '库内热力与动线图层' },
  { id: 'integrations', label: 'Integrations', hint: 'Connected tools' },
];

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 border-b border-shell-border-dim last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-shell-text">{title}</p>
        <p className="mt-0.5 text-[11px] font-medium text-shell-muted leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-slate-900' : 'bg-shell-border'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-shell-panel shadow transition-transform ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsView() {
  const [active, setActive] = useState<SectionId>('workspace');
  const [orgName] = useState('NorthStar Logistics Co.');
  const [timezone, setTimezone] = useState('America/Chicago');
  const [units, setUnits] = useState<'imperial' | 'metric'>('imperial');
  const [mapTheme, setMapTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [streamIntervalSec, setStreamIntervalSec] = useState(120);

  const [emailDigest, setEmailDigest] = useState(true);
  const [criticalPush, setCriticalPush] = useState(true);
  const [maintenanceNudges, setMaintenanceNudges] = useState(true);
  const [hosEscalation, setHosEscalation] = useState(false);

  const [shareAnonymousTelemetry, setShareAnonymousTelemetry] = useState(true);

  const [savedFlash, setSavedFlash] = useState(false);

  const save = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2200);
  };

  return (
    <div className="flex h-full w-full min-h-0 bg-surface-base text-on-background">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-surface-border bg-shell-panel lg:flex">
        <div className="p-5 pb-3">
          <h2 className="text-lg font-black tracking-tight text-shell-text">Settings</h2>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-shell-muted">
            Account &amp; tenant
          </p>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 pb-4">
          {sections.map((s) => {
            const on = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActive(s.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors ${
                  on ? 'bg-shell-panel-hover text-shell-text' : 'text-shell-subtext hover:bg-shell-bg'
                }`}
              >
                <div>
                  <span className="block text-[13px] font-bold">{s.label}</span>
                  <span className="block text-[10px] font-medium text-shell-muted">{s.hint}</span>
                </div>
                <ChevronRight
                  className={`h-4 w-4 shrink-0 transition-transform ${on ? 'text-shell-text' : 'text-shell-subtext'}`}
                />
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-surface-border bg-shell-panel px-4 py-4 sm:px-6">
          <div className="min-w-0 lg:hidden">
            <label className="sr-only" htmlFor="settings-section-mob">
              Section
            </label>
            <select
              id="settings-section-mob"
              value={active}
              onChange={(e) => setActive(e.target.value as SectionId)}
              className="w-full max-w-[280px] rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] font-bold text-shell-text focus:ring-1 focus:ring-slate-300"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden min-w-0 lg:block">
            <p className="text-[10px] font-black uppercase tracking-widest text-shell-muted">WareMind OS</p>
            <h1 className="truncate text-xl font-black tracking-tight text-shell-text">
              {sections.find((s) => s.id === active)?.label}
            </h1>
          </div>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition-colors hover:bg-black"
          >
            {savedFlash ? <Check className="h-4 w-4" /> : null}
            {savedFlash ? 'Saved' : 'Save preferences'}
          </button>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-6">
            {active === 'workspace' ? (
              <>
                <section className="overflow-hidden rounded-xl border border-surface-border bg-shell-panel shadow-sm">
                  <div className="flex items-center gap-2 border-b border-shell-border-dim bg-shell-bg/80 px-5 py-3">
                    <Building2 className="h-4 w-4 text-shell-muted" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-shell-subtext">
                      Workspace
                    </h3>
                  </div>
                  <div className="space-y-4 px-5 py-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-shell-muted">
                        Organization name
                      </label>
                      <input
                        readOnly
                        value={orgName}
                        className="mt-1.5 w-full rounded-lg border border-shell-border bg-shell-bg px-3 py-2 text-[13px] font-bold text-shell-subtext"
                      />
                      <p className="mt-1 text-[10px] font-medium text-shell-muted">
                        联系 WareMind 支持修改工作空间名称。
                      </p>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-shell-muted">
                        Default timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-shell-border bg-shell-panel px-3 py-2 text-[13px] font-bold text-shell-text focus:ring-1 focus:ring-slate-300"
                      >
                        <option value="America/New_York">Eastern (US)</option>
                        <option value="America/Chicago">Central (US)</option>
                        <option value="America/Denver">Mountain (US)</option>
                        <option value="America/Los_Angeles">Pacific (US)</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-shell-muted">
                        Units
                      </label>
                      <div className="mt-1.5 flex rounded-lg border border-shell-border p-1">
                        {(
                          [
                            { id: 'imperial' as const, label: 'Imperial (mi, lb, °F)' },
                            { id: 'metric' as const, label: 'Metric (km, kg, °C)' },
                          ] as const
                        ).map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => setUnits(u.id)}
                            className={`flex-1 rounded-md px-3 py-2 text-[11px] font-black uppercase tracking-tight ${
                              units === u.id ? 'bg-slate-900 text-white shadow' : 'text-shell-subtext hover:bg-shell-bg'
                            }`}
                          >
                            {u.id === 'imperial' ? 'Imperial' : 'Metric'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-xl border border-surface-border bg-shell-panel shadow-sm">
                  <div className="flex items-center gap-2 border-b border-shell-border-dim bg-shell-bg/80 px-5 py-3">
                    <Shield className="h-4 w-4 text-shell-muted" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-shell-subtext">
                      Privacy
                    </h3>
                  </div>
                  <div className="px-5 py-2">
                    <ToggleRow
                      title="Share anonymous product telemetry"
                      description="Helps us improve routing mock accuracy and map performance. Never includes shipment or PII."
                      checked={shareAnonymousTelemetry}
                      onChange={setShareAnonymousTelemetry}
                    />
                  </div>
                </section>
              </>
            ) : null}

            {active === 'alerts' ? (
              <section className="overflow-hidden rounded-xl border border-surface-border bg-shell-panel shadow-sm">
                <div className="flex items-center gap-2 border-b border-shell-border-dim bg-shell-bg/80 px-5 py-3">
                  <Bell className="h-4 w-4 text-shell-muted" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-shell-subtext">
                    Notifications
                  </h3>
                </div>
                <div className="px-5 py-2">
                  <ToggleRow
                    title="Daily operations digest"
                    description="晨间汇总：库存快照、异常与设备告警（演示）。"
                    checked={emailDigest}
                    onChange={setEmailDigest}
                  />
                  <ToggleRow
                    title="Critical asset alerts"
                    description="Push-style banners for telemetry loss, geofence breaches, and unsafe speeding clusters."
                    checked={criticalPush}
                    onChange={setCriticalPush}
                  />
                  <ToggleRow
                    title="Maintenance reminders"
                    description="Nudge dispatch when PM windows approach based on odometer and engine hours."

                    checked={maintenanceNudges}
                    onChange={setMaintenanceNudges}
                  />
                  <ToggleRow
                    title="Escalate HOS to SMS"
                    description="Also send SMS to on-call when a driver approaches violation in the next hour."
                    checked={hosEscalation}
                    onChange={setHosEscalation}
                  />
                </div>
              </section>
            ) : null}

            {active === 'maps' ? (
              <section className="overflow-hidden rounded-xl border border-surface-border bg-shell-panel shadow-sm">
                <div className="flex items-center gap-2 border-b border-shell-border-dim bg-shell-bg/80 px-5 py-3">
                  <Map className="h-4 w-4 text-shell-muted" />
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-shell-subtext">
                    库存实况地图
                  </h3>
                </div>
                <div className="space-y-5 px-5 py-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-shell-muted">
                      Basemap
                    </span>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'light' as const, label: 'Light', icon: Sun },
                          { id: 'dark' as const, label: 'Dark', icon: Moon },
                          { id: 'auto' as const, label: 'Auto', icon: Globe2 },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMapTheme(m.id)}
                          className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 transition-all ${
                            mapTheme === m.id
                              ? 'border-brand-primary bg-slate-900 text-white shadow-md'
                              : 'border-shell-border bg-shell-panel text-shell-subtext hover:border-slate-300'
                          }`}
                        >
                          <m.icon className="h-5 w-5" />
                          <span className="text-[10px] font-black uppercase tracking-tight">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-shell-muted">
                        <Gauge className="h-4 w-4 text-shell-muted" />
                        Stream refresh
                      </label>
                      <span className="text-[12px] font-black text-shell-text tabular-nums">{streamIntervalSec}s</span>
                    </div>
                    <input
                      type="range"
                      min={30}
                      max={300}
                      step={30}
                      value={streamIntervalSec}
                      onChange={(e) => setStreamIntervalSec(Number(e.target.value))}
                      className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-shell-border accent-slate-900"
                    />
                    <p className="mt-1 text-[10px] font-medium text-shell-muted">
                      对本浏览器会话中的库存实况流生效（演示）。
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {active === 'integrations' ? (
              <>
                <section className="overflow-hidden rounded-xl border border-surface-border bg-shell-panel shadow-sm">
                  <div className="flex items-center gap-2 border-b border-shell-border-dim bg-shell-bg/80 px-5 py-3">
                    <Link2 className="h-4 w-4 text-shell-muted" />
                    <h3 className="text-[11px] font-black uppercase tracking-widest text-shell-subtext">
                      Connected services
                    </h3>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {[
                      {
                        name: 'ELD — Motive',
                        status: 'Connected',
                        tone: 'success' as const,
                        detail: 'Last sync · 4 min ago',
                      },
                      {
                        name: 'Fuel cards — WEX',
                        status: 'Reconnect',
                        tone: 'warning' as const,
                        detail: 'Token expired · mock',
                      },
                      {
                        name: 'Weather routing — mock',
                        status: 'Available',
                        tone: 'neutral' as const,
                        detail: 'Enable in a future release',
                      },
                    ].map((row) => (
                      <li key={row.name} className="flex items-center justify-between gap-4 px-5 py-4">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-shell-text">{row.name}</p>
                          <p className="text-[11px] font-medium text-shell-muted">{row.detail}</p>
                        </div>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-tight ${
                            row.tone === 'success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : row.tone === 'warning'
                                ? 'bg-status-warning/10 text-status-warning'
                                : 'bg-shell-panel-hover text-shell-subtext'
                          }`}
                        >
                          {row.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="overflow-hidden rounded-xl border border-dashed border-shell-border bg-shell-bg/50 shadow-sm">
                  <div className="flex items-start gap-3 px-5 py-4">
                    <div className="rounded-lg bg-shell-panel p-2 shadow-sm">
                      <Cpu className="h-5 w-5 text-shell-subtext" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-shell-subtext" />
                        <h3 className="text-[13px] font-black text-shell-text">AI route optimize</h3>
                      </div>
                      <p className="mt-1 text-[11px] font-medium leading-relaxed text-shell-subtext">
                        Tiered routing models and carrier-specific constraints ship on the roadmap. Your team will
                        configure provider keys here when available.
                      </p>
                    </div>
                  </div>
                </section>
              </>
            ) : null}

            <p className="pb-8 text-center text-[10px] font-medium text-shell-muted">
              Preferences are stored in this session only (demo).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
