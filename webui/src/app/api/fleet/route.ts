import { NextResponse } from 'next/server';
import { parseFleetHttpQuery } from '@/server/fleet/parse-fleet-query';
import { fleetTelemetry } from '@/server/fleet/telemetry-service';

/** One-shot snapshot at request time. Same data model as `/api/fleet/stream`. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { count, seed } = parseFleetHttpQuery(searchParams);
  const snapshot = fleetTelemetry.getSnapshot({
    count,
    seed,
    atMs: Date.now(),
  });
  return NextResponse.json(snapshot);
}
