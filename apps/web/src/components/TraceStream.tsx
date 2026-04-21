"use client";

// Live tail of a node's trace stream. On mount opens an EventSource
// to /api/nodes/<id>/traces/stream; the server replays the ring
// buffer first, then pushes new events as they arrive. Auto-scrolls
// to the bottom unless the user has scrolled up (standard chat-log
// behaviour — don't yank them back if they're reading history).

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/auth/config";

type TraceEvent = {
  id: number;
  nodeId: string;
  ts: number;
  level: "info" | "warn" | "error";
  message: string;
  payload?: unknown;
};

const levelColor: Record<TraceEvent["level"], string> = {
  info: "text-white/80",
  warn: "text-amber-300",
  error: "text-red-400",
};

export function TraceStream({ nodeId }: { nodeId: string }) {
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  useEffect(() => {
    const es = new EventSource(apiUrl(`/api/nodes/${nodeId}/traces/stream`));
    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("error", () => setConnected(false));
    es.addEventListener("trace", (e) => {
      try {
        const parsed = JSON.parse((e as MessageEvent).data) as TraceEvent;
        setEvents((prev) => {
          // Dedupe in case of quick reconnect — we trust the server id.
          if (prev.length && prev[prev.length - 1]!.id >= parsed.id) return prev;
          return [...prev.slice(-499), parsed];
        });
      } catch {
        /* ignore malformed frames */
      }
    });
    return () => es.close();
  }, [nodeId]);

  // Scroll management. Track whether the user is "at the bottom"; if
  // they are, every new event auto-scrolls. If they scrolled up to
  // read older traces, leave them alone.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 20;
      stickBottomRef.current =
        el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!stickBottomRef.current) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {!connected && (
        <div className="px-3 py-1 text-[10px] text-white/40 border-b border-white/10">
          reconnecting…
        </div>
      )}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed px-3 py-2"
      >
        {events.length === 0 ? (
          <p className="text-white/30">No events yet.</p>
        ) : (
          events.map((ev) => <EventRow key={ev.id} ev={ev} />)
        )}
      </div>
    </div>
  );
}

function EventRow({ ev }: { ev: TraceEvent }) {
  const [open, setOpen] = useState(false);
  const t = new Date(ev.ts).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const hasPayload = ev.payload !== undefined && ev.payload !== null;
  return (
    <div className="border-b border-white/5 py-1">
      <button
        type="button"
        onClick={() => hasPayload && setOpen((v) => !v)}
        className={`block w-full text-left ${hasPayload ? "cursor-pointer" : "cursor-default"}`}
        disabled={!hasPayload}
      >
        <span className="text-white/40 mr-2">{t}</span>
        <span className={`mr-2 uppercase text-[9px] ${levelColor[ev.level]}`}>
          {ev.level}
        </span>
        <span className={levelColor[ev.level]}>{ev.message}</span>
        {hasPayload && (
          <span className="ml-2 text-white/30 text-[10px]">{open ? "▾" : "▸"}</span>
        )}
      </button>
      {open && hasPayload && (
        <pre className="mt-1 ml-10 text-[10px] text-white/50 whitespace-pre-wrap break-all">
          {JSON.stringify(ev.payload, null, 2)}
        </pre>
      )}
    </div>
  );
}
