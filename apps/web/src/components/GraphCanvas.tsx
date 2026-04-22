"use client";

// Thin client wrapper that plugs the 3D graph into the shared
// SelectionContext: node clicks select, background clicks deselect,
// and the current selection drives the camera-focus for free.
// Also paints the grid backdrop behind the (transparent) canvas so
// the graph has a sense of scale / perspective.

import { useEffect, useState } from "react";
import { NodeGraphLoader } from "./NodeGraphLoader";
import { useSelection } from "./SelectionContext";
import { GRID_BG, type GraphLink, type GraphNode } from "@/lib/graph/visual";
import { currentSidebarWidth, onSidebarWidthChange } from "@/lib/visual/sidebar";

export function GraphCanvas({
  graphNodes,
  graphLinks,
}: {
  graphNodes: GraphNode[];
  graphLinks: GraphLink[];
}) {
  const { select, selectedId } = useSelection();

  // Track the sidebar's current px width across breakpoint crossings
  // so the camera offset matches the *visible* sidebar width — not
  // whatever we happened to measure on the first paint. Initial value
  // is 0 on the server (and for the initial client render, since the
  // lib gates on `typeof window`), then hydration resolves it.
  const [sidebarWidth, setSidebarWidth] = useState(0);
  useEffect(() => {
    setSidebarWidth(currentSidebarWidth());
    return onSidebarWidthChange(setSidebarWidth);
  }, []);

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
