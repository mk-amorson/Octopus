// Pure factories for the three.js objects the 3D node graph renders.
// Kept separate from the component so the graph view stays focused on
// lifecycle, and every visual decision — shape, colour, typography,
// label placement — has a single source of truth in this module.

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
   *  Canvas 2D accepts the same comma-separated format as CSS.
   *  Defaulted for tests / tools that don't care; the live graph
   *  always passes the resolved body font so labels stay in our
   *  pixel TTF. */
  fontFamily?: string;
};

// Geometry radius per node role. One source of truth so the label
// offset below reads the same number — the label sits at
// `radius + LABEL_GAP` world units from the node centre, every time.
const HUB_RADIUS = 6;
const INSTANCE_RADIUS = 4;
const ACTION_SIDE = 6; // cube side length
const LABEL_GAP = 3;

function geometryFor(n: GraphNode): THREE.BufferGeometry {
  if (n.role === "hub") return new THREE.IcosahedronGeometry(HUB_RADIUS, 0);
  if (n.kind === "trigger") return new THREE.OctahedronGeometry(INSTANCE_RADIUS, 0);
  if (n.kind === "action") return new THREE.BoxGeometry(ACTION_SIDE, ACTION_SIDE, ACTION_SIDE);
  return new THREE.SphereGeometry(INSTANCE_RADIUS, 12, 12);
}

function radiusFor(n: GraphNode): number {
  if (n.role === "hub") return HUB_RADIUS;
  if (n.kind === "action") return ACTION_SIDE / 2;
  return INSTANCE_RADIUS;
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
  // Anchor the sprite's origin at its LEFT-centre so the text grows
  // rightward from the placement point set by the rAF loop — never
  // overlaps the node, always starts cleanly at `labelOffset` units
  // away from the centre.
  label.center.set(0, 0.5);
  // A dim chip behind the text keeps it readable over any geometry
  // the scene flies it in front of. depthTest/Write off + a high
  // renderOrder guarantee the label is never clipped by the node
  // mesh, even when the node is between camera and label.
  label.backgroundColor = "rgba(0,0,0,0.55)";
  label.padding = 1.2;
  label.borderRadius = 2;
  label.material.depthWrite = false;
  label.material.depthTest = false;
  label.renderOrder = 999;
  if (opts.fontFamily) label.fontFace = opts.fontFamily;
  // rAF loop in NodeGraph reads this to place the label on the
  // camera's right each frame. World-space offset; scales with
  // zoom like everything else in the scene.
  label.userData.labelOffset = radiusFor(n) + LABEL_GAP;
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
