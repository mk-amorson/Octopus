// /nodes/[id] — single-node editor. Config form + live trace stream.
// Serialises the instance through lib/nodes/serialize so the client
// never receives plaintext secrets and never has to reconstruct the
// webhook URL itself.

import { notFound } from "next/navigation";
import { NodeEditor } from "@/components/NodeEditor";
import { get } from "@/lib/nodes/store";
import { getRegistry } from "@/lib/nodes/registry";
import { toPublicView } from "@/lib/nodes/serialize";

export const dynamic = "force-dynamic";

export default function NodeDetailPage({ params }: { params: { id: string } }) {
  const raw = get(params.id);
  if (!raw) notFound();
  const def = getRegistry().find((d) => d.id === raw.type);
  if (!def) notFound();

  const node = toPublicView(raw);

  // key={node.id} forces React to remount the whole editor subtree
  // when the user navigates between two instances of the same route
  // shape — which is the only way client form state resets. Without
  // it, typing a token in one node's form and switching to another
  // would carry the stale token over (v0.1.29 bug).
  return (
    <NodeEditor
      key={node.id}
      node={node}
      def={{
        id: def.id,
        name: def.name,
        description: def.description,
        fields: def.fields,
      }}
    />
  );
}
