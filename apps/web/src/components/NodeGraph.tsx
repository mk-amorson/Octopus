"use client";

// 3D force graph of every node in the install. Ported from the
// reference octohub: a custom requestAnimationFrame loop rotates the
// Three.js *scene* (not the camera) around the focused node, so
// whichever node the user has expanded in the sidebar sits at the
// visual centre of the canvas. `setViewOffset` compensates for the
// fixed left sidebar so the graph isn't hidden behind it.

import { useEffect, useRef } from "react";
import ForceGraph3D from "3d-force-graph";
import * as THREE from "three";
import { nodeObject, type GraphLink, type GraphNode } from "@/lib/graph/visual";

type GraphInstance = InstanceType<typeof ForceGraph3D>;
// The library's type surface covers most of what we use but trails
// its actual runtime — scene(), camera(), cameraPosition() and a few
// others aren't on the d.ts. We keep the casts narrow and local.
type Loose = GraphInstance & {
  graphData: (d: { nodes: unknown[]; links: unknown[] }) => unknown;
  onBackgroundClick: (cb: () => void) => void;
  scene: () => THREE.Scene;
  camera: () => THREE.Camera;
  cameraPosition: (
    pos: { x: number; y: number; z: number },
    lookAt?: { x: number; y: number; z: number },
    ms?: number,
  ) => void;
  width: (n: number) => unknown;
  height: (n: number) => unknown;
  _destructor?: () => void;
};

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  /** When set, the scene translates + rotates around this node so the
   *  camera sees it at the centre of the canvas. null = world origin. */
  focusNodeId?: string | null;
  /** Width in pixels of the fixed left sidebar; the canvas shifts its
   *  camera view by half that so 3D content stays centred in the
   *  visible area. */
  sidebarWidth?: number;
};

const CAMERA_POS = { x: 0, y: 50, z: 180 };

export function NodeGraph({
  nodes,
  links,
  onSelect,
  onDeselect,
  focusNodeId = null,
  sidebarWidth = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Loose | null>(null);
  const rafRef = useRef(0);
  const angleRef = useRef(0);
  const rotatingRef = useRef(true);
  const focusRef = useRef<string | null>(focusNodeId);
  const selectRef = useRef(onSelect);
  const deselectRef = useRef(onDeselect);
  selectRef.current = onSelect;
  deselectRef.current = onDeselect;

  // One-shot scene creation.
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
      .cameraPosition(CAMERA_POS, { x: 0, y: 0, z: 0 });

    const g = graph as unknown as Loose;
    graphRef.current = g;

    g.onBackgroundClick(() => deselectRef.current?.());
    g.onNodeClick((raw: unknown) => {
      const n = raw as GraphNode;
      selectRef.current?.(n.id);
    });

    // Pause the custom rotation on left-button drag; resume 6 s after
    // the user lets go. No 3d-force-graph autoRotate is used — we
    // mutate the scene directly in the rAF loop so the rotation axis
    // can track the focused node.
    let resume: ReturnType<typeof setTimeout> | null = null;
    const pause = (e: MouseEvent) => {
      if (e.button !== 0) return;
      rotatingRef.current = false;
      if (resume) clearTimeout(resume);
    };
    const schedule = () => {
      if (resume) clearTimeout(resume);
      resume = setTimeout(() => { rotatingRef.current = true; }, 6000);
    };
    el.addEventListener("mousedown", pause);
    el.addEventListener("mouseup", schedule);
    el.addEventListener("touchstart", () => (rotatingRef.current = false));
    el.addEventListener("touchend", schedule);

    const applyViewOffset = () => {
      // Only PerspectiveCamera carries setViewOffset; 3d-force-graph
      // uses one but the upstream types return the abstract Camera.
      const camera = g.camera() as THREE.PerspectiveCamera;
      const w = el.clientWidth, h = el.clientHeight;
      if (!camera?.setViewOffset || w === 0 || h === 0) return;
      // Shift the visible viewport by half the sidebar width so the
      // scene's origin lands in the centre of the uncovered canvas.
      // A negative x-offset pushes content right, away from the
      // sidebar that sits on the left.
      if (sidebarWidth > 0) camera.setViewOffset(w, h, -sidebarWidth / 2, 0, w, h);
    };
    applyViewOffset();

    const ro = new ResizeObserver(() => {
      g.width(el.clientWidth).height(el.clientHeight);
      applyViewOffset();
    });
    ro.observe(el);

    const tick = () => {
      const scene = g.scene();
      if (scene) {
        if (rotatingRef.current) angleRef.current += 0.002;
        let tx = 0, ty = 0, tz = 0;
        const focusId = focusRef.current;
        if (focusId) {
          const data = g.graphData() as unknown as {
            nodes: Array<{ id: string; x?: number; y?: number; z?: number }>;
          };
          const f = data.nodes.find((n) => n.id === focusId);
          if (f) { tx = f.x ?? 0; ty = f.y ?? 0; tz = f.z ?? 0; }
        }
        const c = Math.cos(angleRef.current);
        const s = Math.sin(angleRef.current);
        scene.rotation.y = angleRef.current;
        scene.position.set(-tx * c - tz * s, -ty, tx * s - tz * c);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (resume) clearTimeout(resume);
      ro.disconnect();
      el.removeEventListener("mousedown", pause);
      el.removeEventListener("mouseup", schedule);
      g._destructor?.();
      graphRef.current = null;
    };
  }, [sidebarWidth]);

  // Feed graph data without tearing the scene down.
  useEffect(() => {
    graphRef.current?.graphData({ nodes, links });
  }, [nodes, links]);

  // Instant camera-reset when focus changes. Matches the reference's
  // behaviour — the rAF loop above then keeps the scene revolving
  // around the new centre.
  useEffect(() => {
    focusRef.current = focusNodeId;
    angleRef.current = 0;
    graphRef.current?.cameraPosition(CAMERA_POS, { x: 0, y: 0, z: 0 }, 0);
  }, [focusNodeId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
