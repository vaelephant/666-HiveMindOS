import { parseFleetHttpQuery, parseStreamInterval } from '@/server/fleet/parse-fleet-query';
import { fleetTelemetry } from '@/server/fleet/telemetry-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Server-Sent Events: repeated `FleetSnapshot` JSON as vehicles move along routes (mock) or
 * as your future real provider publishes updates.
 *
 * Query: `count`, optional `seed`, optional `interval` (ms, 800–30000, default 2000).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { count, seed } = parseFleetHttpQuery(searchParams);
  const intervalMs = parseStreamInterval(searchParams);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const push = () => {
        try {
          const snap = fleetTelemetry.getSnapshot({
            count,
            seed,
            atMs: Date.now(),
          });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snap)}\n\n`),
          );
        } catch (e) {
          controller.error(e);
        }
      };

      push();
      timer = setInterval(push, intervalMs);

      const stop = () => {
        if (timer) clearInterval(timer);
        timer = undefined;
        try {
          controller.close();
        } catch {
          /* closed */
        }
      };
      request.signal.addEventListener('abort', stop);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
