// GET    /api/nodes/[id]   — one node
// PATCH  /api/nodes/[id]   — update name / enabled / config
// DELETE /api/nodes/[id]   — stop + remove
//
// Every mutation reconciles the manager: enabling or config changes
// trigger stop() + start(). Secret form fields that come through as
// empty strings are treated as "leave existing value alone" — the
// masked input couldn't possibly carry the real value back anyway.

import { NextResponse } from "next/server";
import { get, remove, update } from "@/lib/nodes/store";
import { manager } from "@/lib/nodes/manager";
import { secretKeysFor, toPublicView } from "@/lib/nodes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const n = get(params.id);
  if (!n) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toPublicView(n));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const existing = get(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: { name?: string; enabled?: boolean; config?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (body.config) {
    const secrets = secretKeysFor(existing.type);
    for (const k of Object.keys(body.config)) {
      if (secrets.has(k) && body.config[k] === "") delete body.config[k];
    }
  }

  const next = update(params.id, body);
  if (!next) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Reconcile: unconditional stop, then start only if it should run.
  // Covers "was enabled → still enabled (config changed)" without a
  // special case.
  await manager.stop(params.id);
  if (next.enabled) await manager.start(params.id);
  return NextResponse.json(toPublicView(next));
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await manager.stop(params.id);
  const ok = remove(params.id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
