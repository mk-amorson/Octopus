"use client";

// 3D force-directed graph of every node in this install. The platform
// is visually modelled as a central hub with user-created instances
// orbiting it — each instance's geometry (kind) and colour (category)
// carry meaning so the topology reads at a glance. Visual factories
// live in lib/graph/visual.ts; this file owns the lifecycle.
//
// Two effects on purpose:
//   1. Create the ForceGraph3D instance once, on mount. The camera,
//      force simulation, and WebGL context stay stable across prop
//      changes — no jarring re-layout when a node is added or
//      deleted.
//   2. Re-feed graphData + click handler when the props change.
//      graphData() does its own diff; the library is fine as long as
//      we don't recreate the graph under it.

import { useEffect, useRef } from "react";
import ForceGraph3D from "3d-force-graph";
import { nodeObject, type GraphLink, type GraphNode } from "@/lib/graph/visual";

type GraphInstance = InstanceType<typeof ForceGraph3D>;
type LooseGraph = GraphInstance & {
  graphData: (d: { nodes: unknown[]; links: unknown[] }) => void;
  _destructor?: () => void;
};

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  /** Called with the clicked node's id. The caller decides how to
   *  surface that — highlight, open a panel, route, etc. */
  onSelect?: (id: string) => void;
  /** Called when the user clicks empty space on the canvas — a
   *  standard "clear selection" affordance. */
  onDeselect?: () => void;
};

export function NodeGraph({ nodes, links, onSelect, onDeselect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<LooseGraph | null>(null);
  const selectRef = useRef<typeof onSelect>(onSelect);
  const deselectRef = useRef<typeof onDeselect>(onDeselect);
  selectRef.current = onSelect;
  deselectRef.current = onDeselect;

  // Mount once — initialise the scene, camera, controls, and resize
  // observer. Teardown on unmount only; prop changes don't land here.
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const graph = new ForceGraph3D(el)
      .backgroundColor("#000000")
      .showNavInfo(false)
      .nodeThreeObject((raw) => nodeObject(raw as unknown as GraphNode))
      .nodeLabel((raw) => {
        const n = raw as unknown as GraphNode;
        return n.sublabel ? `${n.label} — ${n.sublabel}` : n.label;
      })
      .linkColor(() => "rgba(255,255,255,0.22)")
      .linkWidth(1)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.004)
      .linkDirectionalParticleWidth(1)
      .cameraPosition({ x: 0, y: 0, z: 120 });

    const controls = graph.controls() as unknown as {
      addEventListener: (ev: string, cb: () => void) => void;
      autoRotate: boolean;
      autoRotateSpeed: number;
    };
    controls.autoRotate = true;
    // 0.2 is about one full turn every 50 s — slow enough to feel
    // meditative, fast enough to keep the graph from feeling static.
    controls.autoRotateSpeed = 0.2;

    // Pause auto-rotate while the user is interacting; resume after
    // a 6 s idle so the page doesn't fight the mouse.
    let resume: ReturnType<typeof setTimeout> | null = null;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      if (resume) clearTimeout(resume);
    });
    controls.addEventListener("end", () => {
      if (resume) clearTimeout(resume);
      resume = setTimeout(() => {
        controls.autoRotate = true;
      }, 6000);
    });

    const onResize = () => graph.width(el.clientWidth).height(el.clientHeight);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    onResize();

    graphRef.current = graph as LooseGraph;

    return () => {
      ro.disconnect();
      if (resume) clearTimeout(resume);
      (graph as LooseGraph)._destructor?.();
      graphRef.current = null;
    };
  }, []);

  // Wire click handlers once. The actual callbacks live in refs so
  // prop changes take effect without rebinding the 3d-force-graph
  // handlers every render.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.onNodeClick((raw) => {
      const n = raw as unknown as GraphNode;
      selectRef.current?.(n.id);
    });
    (graph as unknown as {
      onBackgroundClick: (cb: () => void) => void;
    }).onBackgroundClick(() => deselectRef.current?.());
  }, []);

  // Push new data without tearing the scene down. 3d-force-graph
  // diffs on node id, so the hub and unchanged instances keep their
  // simulated positions; only added/removed nodes animate in/out.
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    graph.graphData({ nodes, links });
  }, [nodes, links]);

  return <div ref={containerRef} className="w-full h-full" />;
}
