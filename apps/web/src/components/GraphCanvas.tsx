"use client";

// Thin client wrapper that plugs the 3D graph into the shared
// SelectionContext: node clicks select, background clicks deselect,
// and the current selection drives the camera-focus for free.

import { NodeGraphLoader } from "./NodeGraphLoader";
import { useSelection } from "./SelectionContext";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";

// Tailwind w-72 = 288 px. Mobile drawers don't take real screen
// estate (they overlay), so the offset only applies on md+.
const SIDEBAR_WIDTH_MD = 288;

export function GraphCanvas({
  graphNodes,
  graphLinks,
}: {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
}) {
  const { select, selectedId } = useSelection();
  const sidebarWidth = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches
    ? SIDEBAR_WIDTH_MD
    : 0;

  return (
    <NodeGraphLoader
      nodes={graphNodes}
      links={graphLinks}
      onSelect={(id) => select(id)}
      onDeselect={() => select(null)}
      focusNodeId={selectedId}
      sidebarWidth={sidebarWidth}
    />
  );
}
