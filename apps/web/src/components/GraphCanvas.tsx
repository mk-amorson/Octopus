"use client";

// Thin client wrapper that plugs the 3D graph into the shared
// SelectionContext: node clicks select, background clicks deselect,
// and the current selection drives the camera-focus for free.
// Also paints the grid backdrop behind the (transparent) canvas so
// the graph has a sense of scale / perspective.

import { NodeGraphLoader } from "./NodeGraphLoader";
import { useSelection } from "./SelectionContext";
import { GRID_BG, type GraphLink, type GraphNode } from "@/lib/graph/visual";

// Tailwind w-72 = 288 px. Mobile drawers overlay the canvas rather
// than take screen estate, so the offset only applies on md+.
const SIDEBAR_WIDTH_MD = 288;

export function GraphCanvas({
  graphNodes,
  graphLinks,
}: {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
}) {
  const { select, selectedId } = useSelection();
  const sidebarWidth =
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 768px)").matches
      ? SIDEBAR_WIDTH_MD
      : 0;

  return (
    <div className="relative w-full h-full bg-black">
      <div className="absolute inset-0 pointer-events-none" style={GRID_BG} />
      <NodeGraphLoader
        nodes={graphNodes}
        links={graphLinks}
        onSelect={(id) => select(id)}
        onDeselect={() => select(null)}
        focusNodeId={selectedId}
        sidebarWidth={sidebarWidth}
      />
    </div>
  );
}
