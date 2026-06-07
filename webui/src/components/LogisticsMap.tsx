'use client';

import { themeVars } from '@/lib/theme-vars';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Truck, Navigation } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import type { FleetTelemetryStatus, FleetVehicle } from '@/types';

// Fix for Leaflet default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (status: FleetTelemetryStatus, _heading: number, selected: boolean) => {
  const color = status === 'operational' ? themeVars.statusSuccess : status === 'warning' ? themeVars.statusWarning : themeVars.statusError;

  if (selected) {
    const box = 52;
    const html = renderToString(
      <div
        style={{
          width: box,
          height: box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '2px solid rgba(255, 255, 255, 0.95)',
          boxShadow: `0 0 0 2px ${color}55, 0 0 18px ${color}`,
          color,
        }}
      >
        <Truck fill={color} size={34} stroke="rgba(255,255,255,0.35)" strokeWidth={1.25} />
      </div>,
    );
    return L.divIcon({
      html,
      className: 'custom-div-icon',
      iconSize: [box, box],
      iconAnchor: [box / 2, box / 2],
    });
  }

  const html = renderToString(
    <div
      style={{
        color,
        filter: `drop-shadow(0 0 4px ${color}80)`,
      }}
    >
      <Truck fill={color} size={24} />
    </div>,
  );

  return L.divIcon({
    html,
    className: 'custom-div-icon',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function MapInstanceBridge({ onMapReady }: { onMapReady?: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);
  return null;
}

function FitRouteBounds({ points, flyKey }: { points: [number, number][]; flyKey: number }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    if (flyKey > 0) {
      const t = window.setTimeout(() => {
        map.flyToBounds(bounds, {
          padding: [60, 60],
          maxZoom: 7,
          duration: 1.85,
          easeLinearity: 0.11,
        });
      }, 140);
      return () => window.clearTimeout(t);
    }
    map.fitBounds(bounds, { padding: [56, 56], maxZoom: 8 });
    return undefined;
  }, [map, points, flyKey]);
  return null;
}

function interpolateAlongPath(path: [number, number][], t: number): L.LatLng {
  if (path.length < 2) return L.latLng(path[0]![0], path[0]![1]);
  const pts = path.map(([lat, lng]) => L.latLng(lat, lng));
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pts[i]!.distanceTo(pts[i + 1]!);
    segLens.push(d);
    total += d;
  }
  if (total < 1e-6) return pts[0]!;
  let dist = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segLens.length; i++) {
    const segLen = segLens[i]!;
    if (dist <= segLen) {
      const segT = segLen > 0 ? dist / segLen : 0;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      return L.latLng(a.lat + (b.lat - a.lat) * segT, a.lng + (b.lng - a.lng) * segT);
    }
    dist -= segLen;
  }
  return pts[pts.length - 1]!;
}

/** Vertices from path start up to fractional progress `t` ∈ [0,1] for a growing trail polyline. */
function latLngsAlongPath(path: [number, number][], t: number): L.LatLng[] {
  if (path.length === 0) return [];
  if (path.length === 1) return [L.latLng(path[0]![0], path[0]![1])];
  const pts = path.map(([lat, lng]) => L.latLng(lat, lng));
  const segLens: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = pts[i]!.distanceTo(pts[i + 1]!);
    segLens.push(d);
    total += d;
  }
  if (total < 1e-6) return [pts[0]!];
  let remaining = Math.max(0, Math.min(1, t)) * total;
  const out: L.LatLng[] = [pts[0]!];
  for (let i = 0; i < segLens.length; i++) {
    const Lseg = segLens[i]!;
    if (remaining <= Lseg + 1e-6) {
      const segT = Lseg > 0 ? remaining / Lseg : 0;
      const a = pts[i]!;
      const b = pts[i + 1]!;
      out.push(L.latLng(a.lat + (b.lat - a.lat) * segT, a.lng + (b.lng - a.lng) * segT));
      break;
    }
    remaining -= Lseg;
    out.push(pts[i + 1]!);
  }
  return out;
}

function bearingFromTo(a: L.LatLng, b: L.LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingAlongPath(path: [number, number][], t: number): number {
  const eps = 0.006;
  const a = interpolateAlongPath(path, Math.max(0, t - eps));
  const b = interpolateAlongPath(path, Math.min(1, t + eps));
  return bearingFromTo(a, b);
}

/** Single truck icon; heading updated via `.runner-truck-rot` transform (no per-frame icon rebuild). */
function createStaticRunnerTruckIcon(): L.DivIcon {
  const html = renderToString(
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 9999,
        background: 'rgba(255,255,255,0.97)',
        border: `2px solid ${themeVars.shellText}`,
        boxShadow: '0 4px 14px rgba(9, 9, 11, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="runner-truck-rot"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'rotate(90deg)',
          transformOrigin: '50% 50%',
        }}
      >
        <Truck size={19} color={themeVars.shellText} strokeWidth={2.25} />
      </div>
    </div>,
  );
  return L.divIcon({
    html,
    className: 'fleet-route-runner-truck',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
}

/** Animates a truck along the route; draws the path behind it imperatively until `onComplete`. */
function RouteRunnerTruck({
  path,
  runId,
  onComplete,
}: {
  path: [number, number][];
  runId: string;
  onComplete: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (path.length < 2 || !runId) return;

    const trail = L.polyline([], {
      color: themeVars.shellText,
      weight: 5,
      opacity: 0.92,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    const marker = L.marker(interpolateAlongPath(path, 0), {
      icon: createStaticRunnerTruckIcon(),
      zIndexOffset: 1250,
      interactive: false,
    }).addTo(map);

    let rotEl: HTMLElement | null = null;
    const bindRot = () => {
      rotEl = marker.getElement()?.querySelector('.runner-truck-rot') as HTMLElement | null;
    };

    let raf = 0;
    let start = 0;
    const durationMs = 8600; //小车速到 8.6s
    const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
    let disposed = false;

    const finish = () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      trail.remove();
      marker.remove();
      onComplete();
    };

    const tick = (now: number) => {
      if (!start) start = now;
      const rawT = Math.min(1, (now - start) / durationMs);
      const t = easeOutCubic(rawT);
      const ll = interpolateAlongPath(path, t);
      const bearing = bearingAlongPath(path, t);
      marker.setLatLng(ll);
      trail.setLatLngs(latLngsAlongPath(path, t));
      if (!rotEl) bindRot();
      // Lucide Truck faces “west” in local coords; +90° aligns front with geographic bearing (was 180° off vs bearing - 90).
      if (rotEl) rotEl.style.transform = `rotate(${bearing + 90}deg)`;
      if (rawT >= 1) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    const begin = () => {
      bindRot();
      start = 0;
      raf = requestAnimationFrame(tick);
    };

    if (marker.getElement()) begin();
    else marker.once('add', begin);

    return () => {
      cancelAnimationFrame(raf);
      if (!disposed) {
        trail.remove();
        marker.remove();
      }
    };
  }, [map, path, runId, onComplete]);

  return null;
}

/** Truck moves along path continuously (no drawing trail); for order / live preview maps. */
function RouteRunnerTruckLoop({
  path,
  runId,
  durationMs = 14000,
}: {
  path: [number, number][];
  runId: string;
  durationMs?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (path.length < 2 || !runId) return;

    const marker = L.marker(interpolateAlongPath(path, 0), {
      icon: createStaticRunnerTruckIcon(),
      zIndexOffset: 1250,
      interactive: false,
    }).addTo(map);

    let rotEl: HTMLElement | null = null;
    const bindRot = () => {
      rotEl = marker.getElement()?.querySelector('.runner-truck-rot') as HTMLElement | null;
    };

    let raf = 0;
    let start = 0;
    let disposed = false;

    const tick = (now: number) => {
      if (disposed) return;
      if (!start) start = now;
      const u = ((now - start) % durationMs) / durationMs;
      const ll = interpolateAlongPath(path, u);
      const bearing = bearingAlongPath(path, u);
      marker.setLatLng(ll);
      if (!rotEl) bindRot();
      if (rotEl) rotEl.style.transform = `rotate(${bearing + 90}deg)`;
      raf = requestAnimationFrame(tick);
    };

    const begin = () => {
      bindRot();
      start = 0;
      raf = requestAnimationFrame(tick);
    };

    if (marker.getElement()) begin();
    else marker.once('add', begin);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      marker.remove();
    };
  }, [map, path, runId, durationMs]);

  return null;
}

const createRouteStopIcon = (seq: number) =>
  L.divIcon({
    className: 'route-plan-stop-marker',
    html: `<div class="fleet-route-stop-dot" style="width:26px;height:26px;border-radius:9999px;background:var(--color-shell-text);color:var(--color-brand-on-primary);font:800 11px system-ui;display:flex;align-items:center;justify-content:center;border:2px solid var(--color-brand-on-primary);box-shadow:0 2px 8px rgba(0,0,0,.2);animation-delay:${(seq - 1) * 0.1}s;will-change:transform">${seq}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export default function LogisticsMap({
  height = '100%',
  dark = false,
  vehicles = [],
  selectedVehicleId = null,
  onMapReady,
  routePolylines,
  routeStops,
  routeOptimizeLoading = false,
  routeOptimizeTick = 0,
  /** When true, polylines stay visible and truck loops on the selected (bold) path */
  routeTruckLoop = false,
  /** Increments to re-fit bounds / restart loop animation (e.g. selected order id change) */
  routeMapFitKey = 0,
}: {
  height?: string;
  dark?: boolean;
  vehicles?: FleetVehicle[];
  /** When set, this vehicle's map icon is enlarged and drawn above others */
  selectedVehicleId?: string | null;
  onMapReady?: (map: L.Map) => void;
  /** Planned route polylines: render unselected faint, selected bold */
  routePolylines?: {
    id: string;
    positions: [number, number][];
    selected: boolean;
    /** e.g. "6 10" for dashed remainder leg */
    dashArray?: string;
  }[];
  /** Ordered stops (pickup/rest/dropoff) shown as numbered pins */
  routeStops?: { seq: number; lat: number; lng: number; name: string }[];
  /** AI optimize in progress — pulse route vectors */
  routeOptimizeLoading?: boolean;
  /** Increment after each successful optimize — triggers draw + fly animation */
  routeOptimizeTick?: number;
  routeTruckLoop?: boolean;
  routeMapFitKey?: number;
}) {
  const [revealActive, setRevealActive] = useState(false);
  const [routePlaybackDone, setRoutePlaybackDone] = useState(true);

  useLayoutEffect(() => {
    if (routeTruckLoop) {
      setRoutePlaybackDone(true);
      return;
    }
    if (routeOptimizeTick > 0) setRoutePlaybackDone(false);
    else setRoutePlaybackDone(true);
  }, [routeOptimizeTick, routeTruckLoop]);

  const onRoutePlaybackComplete = useCallback(() => {
    setRoutePlaybackDone(true);
  }, []);

  useEffect(() => {
    if (!routePlaybackDone || !routeOptimizeTick) {
      setRevealActive(false);
      return;
    }
    setRevealActive(true);
    const t = window.setTimeout(() => setRevealActive(false), 3200);
    return () => window.clearTimeout(t);
  }, [routePlaybackDone, routeOptimizeTick]);

  const fitPoints = useMemo(() => {
    const acc: [number, number][] = [];
    if (routePolylines) {
      for (const p of routePolylines) {
        for (const pt of p.positions) acc.push(pt);
      }
    }
    if (routeStops) {
      for (const s of routeStops) acc.push([s.lat, s.lng]);
    }
    return acc;
  }, [routePolylines, routeStops]);

  const sortedPolylines = useMemo(() => {
    if (!routePolylines?.length) return [];
    return [...routePolylines].sort((a, b) => Number(a.selected) - Number(b.selected));
  }, [routePolylines]);

  const selectedRouteLayer = useMemo(
    () => sortedPolylines.find((p) => p.selected),
    [sortedPolylines],
  );

  const truckPath: [number, number][] = selectedRouteLayer?.positions ?? [];
  const truckRunId =
    routeOptimizeTick > 0 && selectedRouteLayer
      ? `${routeOptimizeTick}-${selectedRouteLayer.id}`
      : '';

  const fitFlyKey = routeMapFitKey > 0 ? routeMapFitKey : routeOptimizeTick;
  const shouldFitBounds =
    fitPoints.length >= 2 && (routeTruckLoop ? routeMapFitKey > 0 : routeOptimizeTick > 0);

  const showStaticRoute =
    (routeTruckLoop && sortedPolylines.length > 0) ||
    (routeOptimizeTick > 0 && routePlaybackDone);
  const showRouteRunner =
    !routeTruckLoop &&
    routeOptimizeTick > 0 &&
    !routePlaybackDone &&
    truckPath.length >= 2 &&
    !!truckRunId;

  const routeLoopRunId =
    routeTruckLoop && selectedRouteLayer && routeMapFitKey > 0
      ? `loop-${routeMapFitKey}-${selectedRouteLayer.id}`
      : '';
  const showRouteRunnerLoop =
    routeTruckLoop && truckPath.length >= 2 && !!routeLoopRunId;

  const wrapperClass =
    'w-full h-full rounded-xl overflow-hidden border border-shell-border shadow-inner' +
    (routeOptimizeLoading ? ' fleet-map--route-loading' : '') +
    (revealActive ? ' fleet-map--route-reveal' : '');

  return (
    <div style={{ height }} className={wrapperClass}>
      <MapContainer 
        center={[39.8283, -98.5795]} 
        zoom={4} 
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <MapInstanceBridge onMapReady={onMapReady} />
        <TileLayer
          url={dark 
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          }
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {shouldFitBounds ? <FitRouteBounds points={fitPoints} flyKey={fitFlyKey} /> : null}

        {showRouteRunner ? (
          <RouteRunnerTruck
            path={truckPath}
            runId={truckRunId}
            onComplete={onRoutePlaybackComplete}
          />
        ) : null}

        {showRouteRunnerLoop ? (
          <RouteRunnerTruckLoop path={truckPath} runId={routeLoopRunId} durationMs={15000} />
        ) : null}

        {showStaticRoute
          ? sortedPolylines.map((layer) => (
          <Polyline
            key={`${layer.id}-${routeMapFitKey}-${routeOptimizeTick}`}
            positions={layer.positions}
            pathOptions={{
              color: layer.selected ? themeVars.shellText : themeVars.chart4,
              weight: layer.selected ? 5 : 4,
              opacity: layer.selected ? 0.92 : 0.45,
              lineCap: 'round',
              lineJoin: 'round',
              dashArray: layer.dashArray,
            }}
          />
        ))
          : null}

        {vehicles.map((v) => {
          const selected = selectedVehicleId != null && v.id === selectedVehicleId;
          return (
            <Marker
              key={v.vin}
              position={[v.lat, v.lng]}
              icon={createCustomIcon(v.telemetryStatus, v.headingDeg, selected)}
              zIndexOffset={selected ? 800 : 0}
            >
            <Popup className="custom-popup">
              <div className="p-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-black">{v.id}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      v.telemetryStatus === 'operational'
                        ? 'bg-emerald-500'
                        : v.telemetryStatus === 'warning'
                          ? 'bg-orange-500'
                          : 'bg-red-500'
                    }`}
                  />
                </div>
                <div className="text-[10px] text-shell-muted font-bold uppercase tracking-tight">
                  {v.driverName}
                </div>
                <div className="text-[9px] text-shell-muted mt-0.5">{v.makeModel}</div>
                <div className="mt-2 flex items-center space-x-2 text-[10px] font-mono">
                  <Navigation className="w-3 h-3 text-shell-muted" />
                  <span>{v.speedDisplay}</span>
                </div>
              </div>
            </Popup>
          </Marker>
          );
        })}

        {showStaticRoute
          ? routeStops?.map((s) => (
          <Marker
            key={`stop-${s.seq}-${s.name}`}
            position={[s.lat, s.lng]}
            icon={createRouteStopIcon(s.seq)}
            zIndexOffset={950}
          >
            <Popup className="custom-popup">
              <span className="text-[11px] font-bold text-shell-text">{s.name}</span>
            </Popup>
          </Marker>
        ))
          : null}
      </MapContainer>

      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-container {
          background: var(--color-chart-grid);
        }
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
          border: 1px solid var(--color-chart-tooltip-border);
        }
        .custom-popup .leaflet-popup-tip {
          box-shadow: none;
        }
        .fleet-map--route-loading .leaflet-overlay-pane svg path {
          animation: fleet-route-loading-glow 1.75s cubic-bezier(0.45, 0, 0.2, 1) infinite;
        }
        @keyframes fleet-route-loading-glow {
          0%, 100% { stroke-opacity: 0.3; }
          50% { stroke-opacity: 0.72; }
        }
        .fleet-map--route-reveal .fleet-route-stop-dot {
          animation: fleet-route-stop-pop 0.72s cubic-bezier(0.16, 1, 0.3, 1) both;
          transform: translateZ(0);
        }
        @keyframes fleet-route-stop-pop {
          0% {
            transform: translateZ(0) scale(0.2);
            opacity: 0;
          }
          65% {
            opacity: 1;
          }
          100% {
            transform: translateZ(0) scale(1);
            opacity: 1;
          }
        }
      `}} />
    </div>
  );
}
