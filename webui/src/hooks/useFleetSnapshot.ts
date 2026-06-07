'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FleetSnapshot } from '@/types';

export type FleetConnectionMode = 'sse' | 'rest';

export type UseFleetSnapshotOptions = {
  /** `sse` = server pushes time-based snapshots (default). `rest` = one GET /api/fleet. */
  mode?: FleetConnectionMode;
  /** SSE `interval` query (ms). Default 2000. */
  streamIntervalMs?: number;
  /** Pin mock seed; omit to use server default (hourly bucket). */
  seed?: number;
};

export function useFleetSnapshot(count = 96, options?: UseFleetSnapshotOptions) {
  const mode = options?.mode ?? 'sse';
  const streamIntervalMs = options?.streamIntervalMs ?? 2000;
  const seed = options?.seed;

  const [snapshot, setSnapshot] = useState<FleetSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ count: String(count) });
      if (seed != null) params.set('seed', String(seed));
      const res = await fetch(`/api/fleet?${params}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data: FleetSnapshot = await res.json();
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [count, seed]);

  useEffect(() => {
    if (mode !== 'rest') return;
    void load();
  }, [mode, load]);

  useEffect(() => {
    if (mode !== 'sse') return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      count: String(count),
      interval: String(streamIntervalMs),
    });
    if (seed != null) params.set('seed', String(seed));

    const es = new EventSource(`/api/fleet/stream?${params}`);

    es.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const data = JSON.parse(ev.data) as FleetSnapshot;
        setSnapshot(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Invalid fleet stream payload'));
      } finally {
        setLoading(false);
      }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [mode, count, streamIntervalMs, seed]);

  const vehicles = useMemo(() => snapshot?.vehicles ?? [], [snapshot]);

  return { snapshot, vehicles, loading, error, reload: load };
}
