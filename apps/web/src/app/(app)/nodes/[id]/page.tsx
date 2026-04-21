// /nodes/[id] — the single-node editor. Two panes: the config form
// (top / left) and the live trace stream (below / right). Both load
// from their respective APIs; the form PATCHes the node on save and
// the trace panel tails the SSE stream.

import { notFound } from "next/navigation";
import { NodeEditor } from "@/components/NodeEditor";
import { get } from "@/lib/nodes/store";
import { getRegistry } from "@/lib/nodes/registry";
import { manager } from "@/lib/nodes/manager";

export const dynamic = "force-dynamic";

export default function NodeDetailPage({ params }: { params: { id: string } }) {
  const node = get(params.id);
  if (!node) notFound();
  const def = getRegistry().find((d) => d.id === node.type);
  if (!def) notFound();

  // Strip secrets before handing to the client. The form treats
  // masked inputs as "send empty means keep current value"; we
  // expose only whether the value is set.
  const secretKeys = new Set(
    def.fields.filter((f) => f.type === "text" && f.secret).map((f) => f.key),
  );
  const safeConfig: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node.config)) {
    safeConfig[k] = secretKeys.has(k) ? { __set: typeof v === "string" && v.length > 0 } : v;
  }

  return (
    <NodeEditor
      node={{
        id: node.id,
        name: node.name,
        type: node.type,
        enabled: node.enabled,
        config: safeConfig,
        running: manager.isRunning(node.id),
      }}
      def={{
        id: def.id,
        name: def.name,
        description: def.description,
        category: def.category,
        kind: def.kind,
        fields: def.fields,
      }}
    />
  );
}
