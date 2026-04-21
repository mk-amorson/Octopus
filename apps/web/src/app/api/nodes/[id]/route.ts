// GET    /api/nodes/[id]   — one node
// PATCH  /api/nodes/[id]   — update name / enabled / config. Secrets
//                            are merged: sending `{config: {botToken: ""}}`
//                            leaves the existing token untouched; send
//                            a real new value to replace it.
// DELETE /api/nodes/[id]   — stop + remove
//
// Every mutation reconciles the manager: enabling triggers start(),
// disabling or changing config triggers stop()+start().

import { NextResponse } from "next/server";
import { get, remove, update } from "@/lib/nodes/store";
import { manager } from "@/lib/nodes/manager";
import { getRegistry } from "@/lib/nodes/registry";
import type { NodeInstance } from "@/lib/nodes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicView(n: NodeInstance) {
  const def = getRegistry().find((d) => d.id === n.type);
  const secretKeys = new Set(
    (def?.fields ?? [])
      .filter((f) => f.type === "text" && f.secret)
      .map((f) => f.key),
  );
  const safeConfig: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n.config)) {
    safeConfig[k] = secretKeys.has(k)
      ? { __set: typeof v === "string" && v.length > 0 }
      : v;
  }
  return {
    id: n.id,
    type: n.type,
    name: n.name,
    enabled: n.enabled,
    config: safeConfig,
    createdAt: n.createdAt,
    running: manager.isRunning(n.id),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const n = get(params.id);
  if (!n) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(publicView(n));
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const existing = get(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const def = getRegistry().find((d) => d.id === existing.type);

  let body: {
    name?: string;
    enabled?: boolean;
    config?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // For every secret field, drop empty-string assignments — they mean
  // "the form left the masked input alone, keep the stored value".
  if (body.config && def) {
    const secretKeys = new Set(
      def.fields.filter((f) => f.type === "text" && f.secret).map((f) => f.key),
    );
    for (const k of Object.keys(body.config)) {
      if (secretKeys.has(k) && body.config[k] === "") {
        delete body.config[k];
      }
    }
  }

  const next = update(params.id, body);
  if (!next) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Reconcile the manager: stop if it's running, then start only when
  // the new state calls for it. Simple + correct under any
  // combination of "was enabled → still enabled" etc.
  await manager.stop(params.id);
  if (next.enabled) {
    await manager.start(params.id);
  }
  return NextResponse.json(publicView(next));
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await manager.stop(params.id);
  const ok = remove(params.id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
