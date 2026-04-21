// Telegram webhook inbox. Public endpoint (middleware bypasses auth
// for /api/hooks/*) that Telegram POSTs every bot update to.
//
// Responsibilities:
//   1. Verify the node still exists and is enabled. A disabled bot
//      that was previously registered may still receive a straggler
//      update; returning 200 tells Telegram to stop retrying. Tracing
//      it is optional — if the node is gone entirely we just 200 OK.
//   2. Append one trace event with a human-readable label derived
//      from the Update shape. Raw payload is included so the UI can
//      pop it open for debugging.

import { NextResponse } from "next/server";
import { get } from "@/lib/nodes/store";
import { append } from "@/lib/nodes/traces";
import { describeUpdate } from "@/lib/nodes/telegram-trigger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const node = get(params.id);
  if (!node || node.type !== "telegram.trigger") {
    // Don't hand Telegram a 404 — it will retry for hours. Acknowledge
    // and move on; the node operator can see the orphan hits nowhere.
    return NextResponse.json({ ok: true });
  }
  if (!node.enabled) {
    append(node.id, "warn", "update arrived while node is disabled — discarded");
    return NextResponse.json({ ok: true });
  }
  let update: unknown;
  try {
    update = await req.json();
  } catch {
    append(node.id, "warn", "non-JSON webhook body ignored");
    return NextResponse.json({ ok: true });
  }
  const { label, from } = describeUpdate(update);
  const header = from ? `${from}: ${label}` : label;
  append(node.id, "info", header, update);
  return NextResponse.json({ ok: true });
}
