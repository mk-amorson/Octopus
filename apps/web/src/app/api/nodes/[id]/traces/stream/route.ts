// SSE endpoint — streams trace events for one node. On connect we
// replay the recent buffer so the UI shows context immediately;
// after that every new event lands on the wire within a few ms.
//
// Chose SSE over WebSocket because this is strictly server → client,
// one-way, text. SSE has automatic browser reconnection, reuses the
// HTTPS connection, and is a ~10-line backend.

import { NextResponse } from "next/server";
import { recent, subscribe, type TraceEvent } from "@/lib/nodes/traces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const nodeId = params.id;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (ev: TraceEvent) => {
        controller.enqueue(
          enc.encode(`event: trace\ndata: ${JSON.stringify(ev)}\n\n`),
        );
      };

      // Replay the ring buffer so the client doesn't flash empty.
      for (const ev of recent(nodeId)) send(ev);

      // Keep-alive comment every 25s to survive idle proxies
      // (Caddy's default is 2 minutes; 25 s is n8n's default and a
      // decent compromise).
      const ka = setInterval(() => {
        controller.enqueue(enc.encode(`: keep-alive\n\n`));
      }, 25_000);

      const unsub = subscribe((ev) => {
        if (ev.nodeId === nodeId) send(ev);
      });

      // @ts-expect-error — the abort signal isn't typed on the controller,
      // but Next passes us one via the underlying request.
      const abort = _req.signal as AbortSignal | undefined;
      abort?.addEventListener("abort", () => {
        clearInterval(ka);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
