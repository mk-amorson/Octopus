// GET  /api/nodes        — list every node instance + registry
// POST /api/nodes        — create a new node of the given type

import { NextResponse } from "next/server";
import { create, list } from "@/lib/nodes/store";
import { getRegistry } from "@/lib/nodes/registry";
import { toPublicView } from "@/lib/nodes/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const registry = getRegistry().map((d) => ({
    id: d.id,
    name: d.name,
    category: d.category,
    kind: d.kind,
    description: d.description,
    fields: d.fields,
  }));
  return NextResponse.json({ registry, nodes: list().map(toPublicView) });
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
    return NextResponse.json(toPublicView(create(body.type, body.name ?? "")));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
