import 'server-only';

import { defaultFleetSeed } from '@/server/fleet/mock-engine';

export function parseFleetHttpQuery(searchParams: URLSearchParams): {
  count: number;
  seed: number;
} {
  const countRaw = searchParams.get('count');
  const seedRaw = searchParams.get('seed');

  const count = Math.min(500, Math.max(1, Number(countRaw ?? 96) || 96));
  const seed =
    seedRaw != null && seedRaw !== ''
      ? Number(seedRaw)
      : defaultFleetSeed();
  return {
    count,
    seed: Number.isFinite(seed) ? seed : defaultFleetSeed(),
  };
}

export function parseStreamInterval(searchParams: URLSearchParams): number {
  const raw = searchParams.get('interval');
  if (raw == null || raw === '') return 2000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 2000;
  return Math.min(30_000, Math.max(800, Math.floor(n)));
}
