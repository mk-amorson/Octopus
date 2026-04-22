"use client";

// 3D force graph of every node in the install. Ported from the
// reference octohub: a custom requestAnimationFrame loop rotates the
// Three.js *scene* (not the camera) around the focused node, and
// re-positions every label each frame so it always sits on the
// camera's right of its node — at a constant world-space offset,
// never hidden behind the geometry.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { nodeObject, type GraphLink, type GraphNode } from "@/lib/graph/visual";
import { createGraph, type Graph } from "@/lib/graph/forceGraph";

type Props = {
  nodes: GraphNode[];
  links: GraphLink[];
  onSelect?: (id: string) => void;
  onDeselect?: () => void;
  focusNodeId?: string | null;
  sidebarWidth?: number;
};

// Camera placement + tuning. All hardcoded timings/speeds live here
// so a future polish pass has one knob per feel-axis.
// z=150 (down from 180) pulls the scene closer: with three-forcegraph's
// default 60° vertical FOV, the visible world-height becomes
// 2·150·tan(30°) ≈ 173 world units, i.e. each unit maps to ~5 CSS px
// on a 900-pixel-tall viewport. Combined with the radii in visual.ts
// that lands the hub at ~70 px diameter — a primary-content weight.
const CAMERA_POS = { x: 0, y: 50, z: 150 } as const;
const LOOK_AT = { x: 0, y: 0, z: 0 } as const;
const BACKGROUND_TRANSPARENT = "rgba(0,0,0,0)";
const LINK_COLOUR = "rgba(255,255,255,0.22)";
const LINK_WIDTH = 1;
const PARTICLE_COUNT = 2;
const PARTICLE_SPEED = 0.004;
const PARTICLE_WIDTH = 1;
// Ambient rotation of the scene (radians / frame). Resumes this many
// ms after the user releases the mouse, so drags don't fight the spin.
const ROTATION_STEP_RAD = 0.002;
const ROTATION_RESUME_DELAY_MS = 6000;
// High renderOrder on the label sprite lifts it above the node mesh
// even when the camera flies through. Matched to SpriteText inside
// visual.ts — both files' numbers never need to sync because only
// this one reads runtime state from __threeObj.userData.labelOffset.

export function NodeGraph({
  nodes,
  links,
  onSelect,
  onDeselect,
  focusNodeId = null,
  sidebarWidth = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const rafRef = useRef(0);
  const angleRef = useRef(0);
  const rotatingRef = useRef(true);
  const focusRef = useRef<string | null>(focusNodeId);
  const selectRef = useRef(onSelect);
  const deselectRef = useRef(onDeselect);
  selectRef.current = onSelect;
  deselectRef.current = onDeselect;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;

    // CSS variable already resolved to the next/font-generated family
    // name — canvas 2D accepts that string directly. Single source for
    // type on every text surface in the app.
    const fontFamily = getComputedStyle(document.body).fontFamily;

    const graph = createGraph(el)
      // Transparent scene background so the grid the GraphCanvas
      // wrapper paints behind this canvas shows through.
      .backgroundColor(BACKGROUND_TRANSPARENT)
      .showNavInfo(false)
      .nodeThreeObject((n) => nodeObject(n, { fontFamily }))
      // No .nodeLabel() — the SpriteText inside nodeObject() is the
      // one and only label; the DOM hover tooltip would be a second
      // copy in system fonts.
      .linkColor(() => LINK_COLOUR)
      .linkWidth(LINK_WIDTH)
      .linkDirectionalParticles(PARTICLE_COUNT)
      .linkDirectionalParticleSpeed(PARTICLE_SPEED)
      .linkDirectionalParticleWidth(PARTICLE_WIDTH)
      .cameraPosition(CAMERA_POS, LOOK_AT);

    graphRef.current = graph;

    graph.onBackgroundClick(() => deselectRef.current?.());
    graph.onNodeClick((n) => selectRef.current?.(n.id));

    let resume: ReturnType<typeof setTimeout> | null = null;
    const pause = (e: MouseEvent) => {
      if (e.button !== 0) return;
      rotatingRef.current = false;
      if (resume) clearTimeout(resume);
    };
    const schedule = () => {
      if (resume) clearTimeout(resume);
      resume = setTimeout(() => { rotatingRef.current = true; }, ROTATION_RESUME_DELAY_MS);
    };
    el.addEventListener("mousedown", pause);
    el.addEventListener("mouseup", schedule);
    el.addEventListener("touchstart", () => (rotatingRef.current = false));
    el.addEventListener("touchend", schedule);

    const applyViewOffset = () => {
      const camera = graph.camera() as THREE.PerspectiveCamera;
      const w = el.clientWidth, h = el.clientHeight;
      if (!camera?.setViewOffset || w === 0 || h === 0) return;
      if (sidebarWidth > 0) camera.setViewOffset(w, h, -sidebarWidth / 2, 0, w, h);
    };
    applyViewOffset();

    const ro = new ResizeObserver(() => {
      graph.width(el.clientWidth).height(el.clientHeight);
      applyViewOffset();
    });
    ro.observe(el);

    const tick = () => {
      applySceneRotation(graph);
      applyLabelAnchor(graph);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (resume) clearTimeout(resume);
      ro.disconnect();
      el.removeEventListener("mousedown", pause);
      el.removeEventListener("mouseup", schedule);
      graph._destructor();
      graphRef.current = null;
    };

    function applySceneRotation(g: Graph) {
      const scene = g.scene();
      if (!scene) return;
      if (rotatingRef.current) angleRef.current += ROTATION_STEP_RAD;
      let tx = 0, ty = 0, tz = 0;
      const focusId = focusRef.current;
      if (focusId) {
        const focused = g.graphData().nodes.find((n) => n.id === focusId);
        if (focused) {
          tx = focused.x ?? 0; ty = focused.y ?? 0; tz = focused.z ?? 0;
        }
      }
      const c = Math.cos(angleRef.current);
      const s = Math.sin(angleRef.current);
      scene.rotation.y = angleRef.current;
      scene.position.set(-tx * c - tz * s, -ty, tx * s - tz * c);
    }

    // Port of the reference's animateLabels: every label carries a
    // userData.labelOffset (set by nodeObject) and every frame we
    // place it at `localRight * offset` in the node's local coords
    // — which, once the scene's own rotation is factored out, puts
    // the sprite on the camera's right in world space. Result: a
    // readable badge at a constant offset no matter which side of
    // the node the camera is on.
    function applyLabelAnchor(g: Graph) {
      const camera = g.camera();
      const scene = g.scene();
      if (!camera || !scene) return;

      const camRight = new THREE.Vector3();
      camera.getWorldDirection(camRight);
      camRight.cross(camera.up).normalize();

      const sceneInverse = new THREE.Matrix4()
        .makeRotationFromEuler(scene.rotation)
        .invert();
      const localRight = camRight.clone().applyMatrix4(sceneInverse);

      for (const n of g.graphData().nodes) {
        const obj = n.__threeObj;
        if (!obj) continue;
        for (const child of obj.children) {
          const offset = (child.userData as { labelOffset?: number }).labelOffset;
          if (offset === undefined) continue;
          child.position.set(
            localRight.x * offset,
            localRight.y * offset,
            localRight.z * offset,
          );
        }
      }
    }
  }, [sidebarWidth]);

  // Feed graph data, awaiting document.fonts.ready every time so the
  // label sprites rebuild with the real pixel TTF if the initial
  // mount happened before the font had finished loading. After the
  // first resolution the Promise is already fulfilled, so subsequent
  // changes are effectively synchronous.
  useEffect(() => {
    const g = graphRef.current;
    if (!g) return;
    let cancelled = false;
    const feed = () => { if (!cancelled) g.graphData({ nodes, links }); };
    if (document.fonts?.ready) document.fonts.ready.then(feed);
    else feed();
    return () => { cancelled = true; };
  }, [nodes, links]);

  useEffect(() => {
    focusRef.current = focusNodeId;
    angleRef.current = 0;
    graphRef.current?.cameraPosition(CAMERA_POS, LOOK_AT, 0);
  }, [focusNodeId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
