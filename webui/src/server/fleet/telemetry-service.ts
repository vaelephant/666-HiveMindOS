import 'server-only';

import type { FleetSnapshot } from '@/types';
import { defaultFleetSeed, generateFleetMockAt } from '@/server/fleet/mock-engine';

export type FleetTelemetryQuery = {
  count: number;
  seed: number;
  /** Wall time used to place vehicles (Unix ms). */
  atMs: number;
};

/** Replace with a DB / telematics implementation later; keep the same query + snapshot shape. */
export type FleetTelemetrySource = {
  getSnapshot(query: FleetTelemetryQuery): FleetSnapshot;
};

/**
 * Application entry for fleet telemetry. Inject another `FleetTelemetrySource` when wiring real data.
 */
export class FleetTelemetryService implements FleetTelemetrySource {
  getSnapshot(query: FleetTelemetryQuery): FleetSnapshot {
    return generateFleetMockAt(query.seed, query.count, query.atMs);
  }
}

export const fleetTelemetry = new FleetTelemetryService();

export { defaultFleetSeed };
