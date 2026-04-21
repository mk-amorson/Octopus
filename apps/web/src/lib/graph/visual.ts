// Pure factories for the three.js objects the 3D node graph renders.
// Kept separate from the component so the graph view stays focused on
// lifecycle, and both sides (shape, colour, typography) have a
// single source of truth — this module.

import * as THREE from "three";
import SpriteText from "three-spritetext";
import { HUB_COLOR, STATUS, colorFor } from "@/lib/nodes/theme";

export type GraphNode = {
  id: string;
  label: string;
  sublabel?: string;
  role: "hub" | "instance";
  kind?: "trigger" | "action";
  category?: string;
  running?: boolean;
  enabled?: boolean;
};

export type GraphLink = { source: string; target: string };

export type NodeObjectOptions = {
  /** CSS font-family string that the Three.js sprite text will use.
   *  Comma-separated stacks are fine — canvas 2D accepts the same
   *  format as CSS. Defaulted for tests / tools that don't care; the
   *  live graph always passes the resolved body font so labels stay
   *  in our pixel TTF. */
  fontFamily?: string;
};

function geometryFor(n: GraphNode): THREE.BufferGeometry {
  if (n.role === "hub") return new THREE.IcosahedronGeometry(6, 0);
  if (n.kind === "trigger") return new THREE.OctahedronGeometry(4, 0);
  if (n.kind === "action") return new THREE.BoxGeometry(6, 6, 6);
  return new THREE.SphereGeometry(4, 12, 12);
}

function colorForNode(n: GraphNode): string {
  if (n.role === "hub") return HUB_COLOR;
  return colorFor(n.category);
}

function statusColor(n: GraphNode): string {
  if (n.running) return STATUS.running.color;
  if (n.enabled) return STATUS.enabled.color;
  return STATUS.disabled.color;
}

export function nodeObject(n: GraphNode, opts: NodeObjectOptions = {}): THREE.Object3D {
  const group = new THREE.Group();
  const color = colorForNode(n);

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

  const label = new SpriteText(n.label);
  label.color = "#ffffff";
  label.textHeight = n.role === "hub" ? 3 : 2.2;
  label.position.set(0, n.role === "hub" ? -10 : -7, 0);
  // SpriteText draws via canvas 2D, which doesn't understand CSS
  // variables. The component that builds this object reads the
  // resolved body font-family at mount time and passes it here, so
  // the sprite renders in the same pixel TTF as every other
  // character on the page.
  if (opts.fontFamily) label.fontFace = opts.fontFamily;
  label.strokeColor = "#000000";
  label.strokeWidth = 1;
  group.add(label);

  if (n.role === "instance") {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 8),
      new THREE.MeshBasicMaterial({ color: statusColor(n) }),
    );
    dot.position.set(5, 5, 0);
    group.add(dot);
  }

  return group;
}
