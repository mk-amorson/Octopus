"use client";

// <NodeGraph> drags in Three.js (~650 KB gzipped) and only works in
// the browser (WebGL). Lazy-load it via next/dynamic with ssr: false
// so the server bundle stays thin and the page renders a minimal
// placeholder during the first paint.

import dynamic from "next/dynamic";
import type { GraphLink, GraphNode } from "@/lib/graph/visual";

const NodeGraph = dynamic(
  () => import("./NodeGraph").then((m) => m.NodeGraph),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full grid place-items-center text-white/30 text-sm font-pixel">
        loading graph…
      </div>
    ),
  },
);

export function NodeGraphLoader(props: {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
}) {
  return <NodeGraph {...props} />;
}
