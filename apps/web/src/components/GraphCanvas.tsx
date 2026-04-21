"use client";

// Thin client wrapper that plugs the 3D graph into the shared
// SelectionContext: node clicks select, background clicks deselect.
// Graph data is passed in by the page's server component so SSR can
// prerender the container and stream the Three.js chunk after.

import { NodeGraphLoader } from "./NodeGraphLoader";
import { useSelection } from "./SelectionContext";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";

export function GraphCanvas({
  graphNodes,
  graphLinks,
}: {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
}) {
  const { select } = useSelection();
  return (
    <NodeGraphLoader
      nodes={graphNodes}
      links={graphLinks}
      onSelect={(id) => select(id)}
      onDeselect={() => select(null)}
    />
  );
}
