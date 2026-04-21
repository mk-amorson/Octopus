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
    // 1 px white frame around the canvas — visually closes the graph
    // off as a panel, on every viewport regardless of session.
    // box-sizing: border-box (Tailwind default) means the border
    // sits inside the 100%×100% box, the grid + canvas size against
    // the inner edge, no extra layout math.
    <div className="relative w-full h-full bg-black border border-white">
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
