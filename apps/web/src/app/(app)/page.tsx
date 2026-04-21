// / — the authenticated landing. A full-bleed 3D map with a single
// default node today; clicking it opens the side panel with info and
// settings.

import { Dashboard } from "@/components/Dashboard";
import { list } from "@/lib/nodes/store";
import { manager } from "@/lib/nodes/manager";
import { getRegistry } from "@/lib/nodes/registry";
import { toPublicView } from "@/lib/nodes/serialize";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const registry = getRegistry();
  const instances = list();
  const nodes = instances.map(toPublicView);

  const graphNodes: GraphNode[] = instances.map((inst) => {
    const def = registry.find((d) => d.id === inst.type);
    return {
      id: inst.id,
      label: inst.name,
      sublabel: def?.name,
      role: "instance",
      kind: def?.kind,
      category: def?.category,
      running: manager.isRunning(inst.id),
      enabled: inst.enabled,
    };
  });
  const graphLinks: GraphLink[] = [];

  const defs = Object.fromEntries(
    registry.map((d) => [
      d.id,
      {
        id: d.id,
        name: d.name,
        description: d.description,
        fields: d.fields,
      },
    ]),
  );

  return (
    <Dashboard
      graphNodes={graphNodes}
      graphLinks={graphLinks}
      nodes={nodes}
      defs={defs}
    />
  );
}
