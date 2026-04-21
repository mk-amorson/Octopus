"use client";

// The single authenticated view. Owns the "selected node" state that
// glues the 3D graph (where the user clicks) to the side panel (where
// the user reads and edits). All node data is passed in as server-
// rendered props; mutations route through /api/nodes and are
// refreshed via router.refresh().

import { useState } from "react";
import { NodeGraphLoader } from "./NodeGraphLoader";
import { NodePanel, type PanelMode } from "./NodePanel";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";
import type { PublicNode } from "@/lib/nodes/serialize";
import type { FieldSpec } from "@/lib/nodes/types";

type PublicDef = {
  id: string;
  name: string;
  description: string;
  fields: FieldSpec[];
};

type Props = {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
  nodes: PublicNode[];
  defs: Record<string, PublicDef>;
};

export function Dashboard({ graphNodes, graphLinks, nodes, defs }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<PanelMode>("open");

  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  const selectedDef = selected ? defs[selected.type] ?? null : null;

  return (
    <div className="relative h-full w-full">
      <NodeGraphLoader
        nodes={graphNodes}
        links={graphLinks}
        onSelect={(id) => {
          setSelectedId(id);
          setMode("open");
        }}
      />
      {selected && selectedDef && (
        <NodePanel
          node={selected}
          def={selectedDef}
          mode={mode}
          onToggleMode={() =>
            setMode((m) => (m === "open" ? "expanded" : "open"))
          }
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
