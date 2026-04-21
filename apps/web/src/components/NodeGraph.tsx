"use client";

// 3D force-directed graph of every node in this install. The platform
// is visually modelled as a central "hub" with user-created node
// instances orbiting it — each instance's geometry and colour carry
// meaning (kind = shape, category = colour) so the topology is
// readable at a glance instead of being a wall of text.
//
// 3d-force-graph is a thin Three.js wrapper that exposes a chainable
// builder and owns the animation loop; it's significantly smaller
// than writing raw Three yourself and matches the look the prototype
// had verbatim. We wrap it in a React component so the scene tears
// down cleanly on navigation.

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import SpriteText from "three-spritetext";

// 3d-force-graph@1.76 ships as a class, not a factory: the instance
// is `new ForceGraph3D(el)`. We keep the type loose — its public
// surface is fluent chainable methods and the generated d.ts is
// generic over NodeObject/LinkObject in a way we don't need here.
type GraphInstance = InstanceType<typeof ForceGraph3D>;

export type GraphNode = {
  id: string;
  label: string;
  /** Subtitle shown under the label — node type name for instances,
   *  "platform" for the hub. */
  sublabel?: string;
  /** "hub" for the centre; "instance" for user-created nodes. */
  role: "hub" | "instance";
  /** Drives shape. Matches NodeDefinition.kind for instances. */
  kind?: "trigger" | "action";
  /** Drives colour. Category name for instances; "" for hub. */
  category?: string;
  /** Dashboard wants to show status on each instance. */
  running?: boolean;
  enabled?: boolean;
};

export type GraphLink = { source: string; target: string };

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
};

// Pleasant, distinguishable palette — keyed off category so two
// triggers under "Communication" share a colour and the user can read
// the topology quickly. Falls back to a neutral white for any
// unmapped category.
const CATEGORY_COLOR: Record<string, string> = {
  Triggers: "#51ff97", // green — things that start a flow
  Actions: "#f472b6", // pink — things the flow does
  AI: "#fb923c", // orange — agent nodes
};
const HUB_COLOR = "#7c3aed"; // purple — the platform itself

function colorFor(n: GraphNode): string {
  if (n.role === "hub") return HUB_COLOR;
  if (n.category && CATEGORY_COLOR[n.category]) return CATEGORY_COLOR[n.category]!;
  return "#cccccc";
}

// One geometry per (role, kind) — cached so we allocate exactly one
// per class of node and reuse across instances. Three.js meshes are
// cheap but the factory calls aren't free on a graph that re-renders.
function geometryFor(n: GraphNode): THREE.BufferGeometry {
  if (n.role === "hub") return new THREE.IcosahedronGeometry(6, 0);
  if (n.kind === "trigger") return new THREE.OctahedronGeometry(4, 0);
  if (n.kind === "action") return new THREE.BoxGeometry(6, 6, 6);
  return new THREE.SphereGeometry(4, 12, 12);
}

export function NodeGraph({ nodes, links }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphInstance | null>(null);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    const graph = new ForceGraph3D(el)
      .backgroundColor("#000000")
      .showNavInfo(false)
      .nodeThreeObject((raw) => {
        const n = raw as unknown as GraphNode;
        const group = new THREE.Group();
        const color = colorFor(n);
        const mesh = new THREE.Mesh(
          geometryFor(n),
          new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.35,
            metalness: 0.2,
            roughness: 0.4,
          }),
        );
        group.add(mesh);

        // Billboarded label under the geometry. Stays legible
        // regardless of camera angle.
        const label = new SpriteText(n.label);
        label.color = "#ffffff";
        label.textHeight = n.role === "hub" ? 3 : 2.2;
        label.position.set(0, n.role === "hub" ? -10 : -7, 0);
        label.fontFace = "monospace";
        label.strokeColor = "#000000";
        label.strokeWidth = 1;
        group.add(label);

        // A small status dot for instances — green running, amber
        // enabled-but-not-running, dim when disabled.
        if (n.role === "instance") {
          const status = n.running
            ? "#6ce26c"
            : n.enabled
              ? "#fbbf24"
              : "#555";
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.8, 8, 8),
            new THREE.MeshBasicMaterial({ color: status }),
          );
          dot.position.set(5, 5, 0);
          group.add(dot);
        }

        return group;
      })
      .linkColor(() => "rgba(255,255,255,0.25)")
      .linkWidth(1.2)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(1.1)
      .nodeLabel((raw) => {
        const n = raw as unknown as GraphNode;
        return n.sublabel ? `${n.label} — ${n.sublabel}` : n.label;
      })
      .onNodeClick((raw) => {
        const n = raw as unknown as GraphNode;
        if (n.role === "instance") routerRef.current.push(`/nodes/${n.id}`);
      })
      .cameraPosition({ x: 0, y: 0, z: 120 });

    // The library accepts any object; we carry our own discriminator
     // fields on the NodeObject superset.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (graph as any).graphData({ nodes, links });

    // Gentle auto-rotate of the camera around the scene centre. Pauses
    // on user interaction so it doesn't fight the mouse.
    let rotating = true;
    const controls = graph.controls() as unknown as {
      addEventListener: (ev: string, cb: () => void) => void;
      autoRotate: boolean;
      autoRotateSpeed: number;
    };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;
    controls.addEventListener("start", () => {
      rotating = false;
      controls.autoRotate = false;
    });
    // Resume after a few seconds of no interaction.
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;
    controls.addEventListener("end", () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (!rotating) {
          rotating = true;
          controls.autoRotate = true;
        }
      }, 3000);
    });

    const onResize = () => graph.width(el.clientWidth).height(el.clientHeight);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    onResize();

    graphRef.current = graph;

    return () => {
      ro.disconnect();
      if (resumeTimer) clearTimeout(resumeTimer);
      // _destructor isn't on the typings but the library exposes it;
       // calling it tears down the WebGL context so navigation doesn't
       // leak GPU resources.
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (graph as any)._destructor?.();
      graphRef.current = null;
    };
    // Intentionally re-build the whole graph when data changes — nodes
    // and links aren't mutated in place, and 3d-force-graph's
    // graphData() diff is flaky when node identity shifts. Tearing
    // down + rebuilding is cheap at our scale (<100 nodes).
  }, [nodes, links]);

  return <div ref={containerRef} className="w-full h-full" />;
}
