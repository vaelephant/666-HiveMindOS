'use client';

import { Globe, Shield, Zap, Trash2, Save } from 'lucide-react';

export function SettingsView() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-primary">System Settings</h2>
        <p className="text-sm text-on-surface-variant mt-1">Configure your network infrastructure and security protocols.</p>
      </div>

      <div className="space-y-6">
        <section className="bg-shell-panel border border-outline-variant rounded-xl p-8 shadow-sm space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b border-outline-variant">
            <div className="p-3 bg-surface-container-low rounded-xl text-primary border border-outline-variant">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary">Global Preferences</h3>
              <p className="text-sm text-on-surface-variant">Manage basic network behavior and language.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Network Mode</label>
              <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container outline-none">
                <option>Decentralized Hybrid</option>
                <option>Centralized Proxy</option>
                <option>Pure P2P</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-primary uppercase tracking-widest">Data Retention</label>
              <select className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container outline-none">
                <option>30 Days</option>
                <option>90 Days</option>
                <option>1 Year</option>
                <option>Indefinite</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <h4 className="text-sm font-bold text-primary">Enable Auto-Scaling</h4>
              <p className="text-xs text-on-surface-variant">Automatically provision new nodes when capacity exceeds 85%.</p>
            </div>
            <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer shadow-inner">
              <div className="absolute right-1 top-1 w-4 h-4 bg-shell-panel rounded-full transition-all" />
            </div>
          </div>
        </section>

        <section className="bg-shell-panel border border-outline-variant rounded-xl p-8 shadow-sm space-y-8">
          <div className="flex items-center gap-4 pb-4 border-b border-outline-variant">
            <div className="p-3 bg-surface-container-low rounded-xl text-primary border border-outline-variant">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary">Security & Privacy</h3>
              <p className="text-sm text-on-surface-variant">Control access and encryption standards.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 bg-surface-container-low rounded-lg border border-outline-variant flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-secondary" />
                <div>
                  <h4 className="text-xs font-bold text-primary">Advanced Encryption</h4>
                  <p className="text-[10px] text-on-surface-variant">AES-256 GCM for all node communication.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="text-sm font-bold text-primary">Public API Gateway</h4>
                <p className="text-xs text-on-surface-variant">Allow external CID fetching via load balancer.</p>
              </div>
              <div className="w-12 h-6 bg-surface-container rounded-full relative cursor-pointer">
                <div className="absolute left-1 top-1 w-4 h-4 bg-on-surface-variant/30 rounded-full transition-all" />
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-4 pt-4">
          <button
            type="button"
            className="flex items-center gap-2 px-8 py-3 border border-outline-variant text-[10px] font-bold text-primary uppercase tracking-widest rounded-lg hover:bg-surface-container transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            type="button"
            className="flex items-center gap-2 px-8 py-3 bg-primary-container text-white text-[10px] font-bold uppercase tracking-widest rounded-lg hover:bg-opacity-90 transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            Sync Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
