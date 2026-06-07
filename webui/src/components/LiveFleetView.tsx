'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import { Truck, Zap, Activity, Thermometer, Wifi, Plus, Minus, Layers, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LogisticsMap from './LogisticsMapDynamic';
import Sidebar from './Sidebar';
import { useFleetSnapshot } from '@/hooks/useFleetSnapshot';

export default function LiveFleetView() {
  const { snapshot, vehicles, error } = useFleetSnapshot(120, {
    mode: 'sse',
    streamIntervalMs: 1500,
  });
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const handleMapReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  const roster = useMemo(
    () =>
      [...vehicles].sort((a, b) => a.driverName.localeCompare(b.driverName)).slice(0, 80),
    [vehicles],
  );

  useEffect(() => {
    if (roster.length === 0) {
      setSelectedAsset(null);
      return;
    }
    setSelectedAsset((prev) => (prev && roster.some((r) => r.id === prev) ? prev : roster[0]!.id));
  }, [roster]);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === selectedAsset),
    [vehicles, selectedAsset],
  );

  const networkEvents = useMemo(() => {
    if (!snapshot) return [];
    const delayed = snapshot.vehicles
      .filter((v) => v.telemetryStatus !== 'operational')
      .slice(0, 3);
    return delayed.map((v) => ({
      id: v.id,
      tone: v.telemetryStatus === 'error' ? ('red' as const) : ('blue' as const),
      text:
        v.telemetryStatus === 'error'
          ? `${v.id} telemetry gap · ${v.corridorLabel}`
          : `${v.id} congestion watch · ${v.speedDisplay}`,
    }));
  }, [snapshot]);

  return (
    <div className="flex h-full w-full bg-slate-950 overflow-hidden relative">
      <div className="absolute inset-0 z-0">
        <LogisticsMap dark vehicles={vehicles} selectedVehicleId={selectedAsset} onMapReady={handleMapReady} />
        <div className="absolute inset-0 map-gradient-overlay pointer-events-none" />
      </div>

      {error ? (
        <div className="absolute inset-0 z-[500] flex items-center justify-center bg-slate-950/85 text-sm text-red-300 px-6 text-center">
          库区实时流不可用：{error.message}
        </div>
      ) : null}

      <Sidebar
        roster={roster}
        selectedAsset={selectedAsset}
        onSelectAsset={setSelectedAsset}
        snapshot={snapshot}
      />

      <main className="relative min-w-0 flex-1">
        <div className="absolute top-6 left-6 flex flex-col space-y-2 z-10">
          <div className="bg-slate-900/80 backdrop-blur border border-white/10 rounded-lg flex flex-col shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="p-2.5 hover:bg-shell-panel/10 transition-colors border-b border-white/5"
              aria-label="Zoom in"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="p-2.5 hover:bg-shell-panel/10 transition-colors"
              aria-label="Zoom out"
            >
              <Minus className="w-4 h-4 text-white" />
            </button>
          </div>
          <button
            type="button"
            className="bg-slate-900/80 backdrop-blur border border-white/10 p-2.5 rounded-lg shadow-2xl hover:bg-shell-panel/10 transition-colors"
          >
            <Layers className="w-4 h-4 text-white" />
          </button>
        </div>

        <AnimatePresence>
          {selectedAsset && selected ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl min-w-[600px] z-20 flex items-center space-x-8"
            >
              <div className="w-16 h-16 bg-shell-panel/5 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
                <Truck className="w-8 h-8 text-white opacity-80" />
              </div>

              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <h3 className="text-xl font-black text-white">{selected.id}</h3>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded border border-emerald-500/20 uppercase tracking-widest">
                    实时链路
                  </span>
                  <div className="flex-1" />
                  <div className="flex items-center space-x-1 text-emerald-400">
                    <Wifi className="w-4 h-4" />
                    <span className="text-[10px] font-black">98 ms</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-shell-muted font-black uppercase tracking-wider">
                      模拟坐标
                    </p>
                    <p className="text-xs text-white font-mono">
                      {selected.lat.toFixed(4)}° N, {Math.abs(selected.lng).toFixed(4)}° W
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-shell-muted font-black uppercase tracking-wider">
                      读数 / 温控
                    </p>
                    <div className="flex items-center space-x-2">
                      <Thermometer className="w-3 h-3 text-orange-400" />
                      <p className="text-xs text-white font-mono">{selected.engineTempF} °F</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-shell-muted font-black uppercase tracking-wider">
                      载货重量
                    </p>
                    <p className="text-xs text-white font-mono">
                      {selected.loadWeightLbs.toLocaleString()} lbs
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-shell-muted font-black uppercase tracking-wider">
                      巷道 / 分区
                    </p>
                    <p className="text-xs text-white">{selected.corridorLabel}</p>
                  </div>
                </div>
                <p className="text-[9px] text-shell-muted mt-3 font-mono">设备 ID {selected.vin}</p>
              </div>

              <div className="flex flex-col space-y-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-shell-panel text-slate-950 text-[11px] font-black rounded-xl uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg flex items-center space-x-2"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>设备诊断</span>
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-shell-panel/10 hover:bg-shell-panel/20 text-white text-[11px] font-black rounded-xl uppercase tracking-widest transition-all border border-white/5 flex items-center space-x-2"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>地图居中</span>
                </button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className="absolute top-6 right-6 w-72 space-y-3 z-10">
          <div className="bg-slate-950/40 backdrop-blur border border-white/5 p-4 rounded-2xl">
            <h4 className="text-[10px] font-black text-shell-muted uppercase tracking-widest mb-3 flex items-center space-x-2">
              <Zap className="w-3 h-3 text-white" />
              <span>库区事件</span>
            </h4>
            <div className="space-y-3">
              {networkEvents.length === 0 ? (
                <p className="text-[11px] text-shell-muted">演示流：暂无新的异常事件。</p>
              ) : (
                networkEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center space-x-3 group">
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.tone === 'red' ? 'bg-red-500' : 'bg-brand-bright'} group-hover:animate-ping`}
                    />
                    <p className="text-[11px] text-shell-subtext">{ev.text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
