import 'server-only';

import type { FleetMotionLabel, FleetSnapshot, FleetTelemetryStatus, FleetVehicle } from '@/types';

/** Deterministic PRNG per (seed, vehicleIndex). */
function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vehicleRng(seed: number, index: number) {
  const s = (((seed >>> 0) ^ 0xdeadbeef) + index * 0x9e3779b9) >>> 0;
  return mulberry32(s);
}

function fract(x: number) {
  const f = x % 1;
  return f < 0 ? f + 1 : f;
}

const FIRST = [
  'James',
  'Maria',
  'Marcus',
  'Priya',
  'Elena',
  'David',
  'Sarah',
  'Alex',
  'Jordan',
  'Keisha',
  'Ryan',
  'Hannah',
  'Luis',
  'Emily',
  'Chen',
];
const LAST = [
  'Chen',
  'Thorne',
  'Martinez',
  'Patel',
  'Nguyen',
  'Burke',
  'Okafor',
  'Silva',
  'Park',
  'Walsh',
  'King',
  'Okonkwo',
  'Larsen',
  'Foster',
  'Nakamura',
];

const RIGS = [
  'Volvo VNL 860',
  'Freightliner Cascadia',
  'Peterbilt 579',
  'Kenworth T680',
  'International LT Series',
  'Mack Anthem',
  'Western Star 49X',
];

const CORRIDORS: { label: string; a: [number, number]; b: [number, number] }[] = [
  { label: 'I-80, NE', a: [41.26, -95.94], b: [41.14, -101.71] },
  { label: 'I-35, TX', a: [32.78, -96.8], b: [29.42, -98.49] },
  { label: 'I-40, OK', a: [35.47, -97.52], b: [35.21, -99.88] },
  { label: 'I-95, VA', a: [37.54, -77.43], b: [36.85, -76.28] },
  { label: 'I-10, AZ', a: [33.45, -112.08], b: [32.22, -110.97] },
  { label: 'I-5, WA', a: [47.6, -122.33], b: [45.52, -122.68] },
  { label: 'I-75, KY', a: [39.1, -84.5], b: [37.13, -86.02] },
  { label: 'I-55, IL', a: [41.88, -87.63], b: [38.63, -90.18] },
  { label: 'US-287, CO', a: [40.02, -105.27], b: [39.74, -104.99] },
  { label: 'I-20, GA', a: [33.75, -84.39], b: [33.52, -86.8] },
  { label: 'I-44, MO', a: [38.63, -90.32], b: [36.16, -95.89] },
  { label: 'I-15, UT', a: [40.76, -111.89], b: [37.09, -113.58] },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Bearing from point A to B, degrees 0–360 clockwise from north. */
function bearingDeg(a: [number, number], b: [number, number]): number {
  const φ1 = (a[0] * Math.PI) / 180;
  const φ2 = (b[0] * Math.PI) / 180;
  const Δλ = ((b[1] - a[1]) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

function pickMotion(
  telemetry: FleetTelemetryStatus,
  speedMph: number,
  rand: () => number,
): FleetMotionLabel {
  if (telemetry === 'error') return rand() > 0.35 ? 'Offline' : 'Delayed';
  if (telemetry === 'warning') return rand() > 0.5 ? 'Delayed' : speedMph > 8 ? 'In Transit' : 'Idle';
  if (speedMph <= 3) return 'Idle';
  if (speedMph > 50 && rand() > 0.72) return 'In Transit';
  return 'In Motion';
}

function formatVin(rand: () => number): string {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 17; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}

/**
 * Full fleet snapshot at synthetic instant `atMs` (Unix ms).
 * Vehicle positions move along corridors as `atMs` increases — same seed + count ⇒ same identities, smooth motion in time.
 */
export function generateFleetMockAt(seed: number, count: number, atMs: number): FleetSnapshot {
  const clamped = Math.min(500, Math.max(1, Math.floor(count)));
  const vehicles: FleetVehicle[] = [];

  for (let i = 0; i < clamped; i++) {
    const rand = vehicleRng(seed >>> 0, i);
    const r = () => rand();

    const corridor = CORRIDORS[Math.floor(r() * CORRIDORS.length)]!;
    const p0 = 0.05 + r() * 0.9;
    const jitterLat = (r() - 0.5) * 0.14;
    const jitterLng = (r() - 0.5) * 0.14;

    const roll = r();
    const telemetry: FleetTelemetryStatus =
      roll > 0.93 ? 'error' : roll > 0.78 ? 'warning' : 'operational';

    const speedBase =
      telemetry === 'error'
        ? r() * 4
        : telemetry === 'warning'
          ? 15 + r() * 40
          : 35 + r() * 48;
    const speedMph = Math.round(speedBase);

    const fuelPct = Math.round(
      telemetry === 'error' ? 5 + r() * 22 : 25 + r() * 74,
    );

    const first = FIRST[Math.floor(r() * FIRST.length)]!;
    const last = LAST[Math.floor(r() * LAST.length)]!;
    const driverName = `${first} ${last}`;
    const rig = RIGS[Math.floor(r() * RIGS.length)]!;
    const jitterId = (((seed ^ (i * 1103515245)) >>> 0) % 37);
    /** Step 37 + jitter in [0,36] guarantees unique ids for any distinct index i (37*|Δi| cannot equal a difference of jitters). */
    const id = `TR-${8800 + i * 37 + jitterId}`;

    const ambientTempC = Math.round(-6 + r() * 36);
    const motionLabel = pickMotion(telemetry, speedMph, r);

    const routeBear = bearingDeg(corridor.a, corridor.b);
    const bearingWobble = Math.sin(atMs * 0.0008 + i * 0.7) * 4 + (r() * 16 - 8);
    const headingDeg = Math.floor((routeBear + bearingWobble + 360) % 360);

    const almostStill =
      motionLabel === 'Idle' ||
      motionLabel === 'Offline' ||
      telemetry === 'error' ||
      speedMph < 3;

    const driftPerMs = almostStill ? 1.2e-10 * speedMph : 1.25e-7 * Math.max(8, speedMph);
    const p = fract(p0 + atMs * driftPerMs);

    const lat = lerp(corridor.a[0], corridor.b[0], p) + jitterLat;
    const lng = lerp(corridor.a[1], corridor.b[1], p) + jitterLng;

    const pingLag = Math.floor(r() * 120_000);

    vehicles.push({
      id,
      vin: formatVin(r),
      makeModel: rig,
      driverName,
      lat,
      lng,
      headingDeg,
      speedMph,
      speedDisplay: `${speedMph} mph`,
      fuelPct,
      fuelDisplay: `${fuelPct}%`,
      telemetryStatus: telemetry,
      motionLabel,
      corridorLabel: corridor.label,
      ambientTempC,
      ambientTempDisplay: `${ambientTempC >= 0 ? '+' : ''}${ambientTempC}°C`,
      engineTempF: Math.round(175 + r() * 45),
      loadWeightLbs: Math.round(38_000 + r() * 42_000),
      odometerMiles: Math.round(120_000 + r() * 380_000),
      lastPingIso: new Date(atMs - pingLag).toISOString(),
    });
  }

  const summary = vehicles.reduce(
    (acc, v) => {
      acc[v.telemetryStatus]++;
      if (v.motionLabel === 'In Motion' || v.motionLabel === 'In Transit') acc.inMotion++;
      if (v.motionLabel === 'Idle') acc.idle++;
      acc.avgSpeedMph += v.speedMph;
      return acc;
    },
    {
      operational: 0,
      warning: 0,
      error: 0,
      inMotion: 0,
      idle: 0,
      avgSpeedMph: 0,
    },
  );
  summary.avgSpeedMph =
    vehicles.length > 0 ? Math.round(summary.avgSpeedMph / vehicles.length) : 0;

  return {
    generatedAt: new Date(atMs).toISOString(),
    seed: seed >>> 0,
    count: vehicles.length,
    summary,
    vehicles,
    serverTimeMs: atMs,
    source: 'mock-time',
  };
}

export function defaultFleetSeed(): number {
  return Math.floor(Date.now() / 3_600_000);
}
