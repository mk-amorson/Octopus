// GET  /api/nodes        — list every node instance + available types
// POST /api/nodes        — create a new node of the given type
//
// Secrets are stripped from the response: the UI never needs the raw
// token back, only a boolean "is this field set?".

import { NextResponse } from "next/server";
import { create, list } from "@/lib/nodes/store";
import { getRegistry } from "@/lib/nodes/registry";
import { manager } from "@/lib/nodes/manager";
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

export async function GET() {
  const registry = getRegistry().map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    kind: d.kind,
    description: d.description,
    fields: d.fields,
  }));
  const nodes = list().map(publicView);
  return NextResponse.json({ registry, nodes });
}

export async function POST(req: Request) {
  let body: { type?: string; name?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }
  try {
    const created = create(body.type, body.name ?? "");
    return NextResponse.json(publicView(created));
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 },
    );
  }
}
