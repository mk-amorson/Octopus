// In-memory trace buffer + event bus.
//
// Every node's ctx.trace() call lands here. Two consumers:
//   1. The HTTP API replays the last N events on first request so the
//      client doesn't flicker to empty on page load.
//   2. The SSE stream subscribes to the EventEmitter and pushes new
//      events down the wire as they happen.
//
// Bounded on purpose: RING_SIZE events per node, 100 nodes-worth kept
// around. At ~500 B per event that's <25 MiB resident — fine for the
// single-process self-hosted deployment Octopus targets. Persistence
// is deliberately out of scope for v1; a container restart wipes
// traces, which is acceptable for the "live debugging" use case
// (users watch events arrive, they don't audit last week's).

import { EventEmitter } from "node:events";
import type { TraceLevel } from "./types";

export type TraceEvent = {
  id: number; // monotonically increasing, unique per process
  nodeId: string;
  ts: number; // epoch millis
  level: TraceLevel;
  message: string;
  payload?: unknown;
};

const RING_SIZE = 500;

const rings = new Map<string, TraceEvent[]>();
const bus = new EventEmitter();
bus.setMaxListeners(0); // one listener per SSE connection; don't cap.

let seq = 0;

export function append(
  nodeId: string,
  level: TraceLevel,
  message: string,
  payload?: unknown,
): TraceEvent {
  const ev: TraceEvent = {
    id: ++seq,
    nodeId,
    ts: Date.now(),
    level,
    message,
    payload,
  };
  const ring = rings.get(nodeId) ?? [];
  ring.push(ev);
  if (ring.length > RING_SIZE) ring.splice(0, ring.length - RING_SIZE);
  rings.set(nodeId, ring);
  bus.emit("trace", ev);
  return ev;
}

export function recent(nodeId: string, limit = RING_SIZE): TraceEvent[] {
  const ring = rings.get(nodeId) ?? [];
  return ring.slice(Math.max(0, ring.length - limit));
}

export function subscribe(listener: (ev: TraceEvent) => void): () => void {
  bus.on("trace", listener);
  return () => bus.off("trace", listener);
}

export function clear(nodeId: string): void {
  rings.delete(nodeId);
}
