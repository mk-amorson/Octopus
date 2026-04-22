// / — the authenticated landing. A full-bleed 3D map. Click-to-
// select is wired through SelectionContext (set up by the (app)
// layout's <AppFrame>) so the sidebar info panel paints itself in
// without the page having to know about it.

import { GraphCanvas } from "@/components/GraphCanvas";
import { list } from "@/lib/nodes/store";
import { getRegistry } from "@/lib/nodes/registry";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const registry = getRegistry();
  const instances = list();

  const graphNodes: GraphNode[] = instances.map((inst) => {
    const def = registry.find((d) => d.id === inst.type);
    return {
      id: inst.id,
      label: inst.name,
      sublabel: def?.name,
      role: def?.graphRole ?? "instance",
      kind: def?.kind,
      category: def?.category,
      enabled: inst.enabled,
      running: false,
    };
  });

  // No connections yet — links stay empty until the platform grows
  // its second node type. Passing an empty array keeps the graph's
  // public API stable regardless.
  const graphLinks: GraphLink[] = [];

  return <GraphCanvas graphNodes={graphNodes} graphLinks={graphLinks} />;
}
