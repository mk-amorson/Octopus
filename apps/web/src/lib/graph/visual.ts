// Pure factories for the three.js objects the 3D node graph renders.
// Kept separate from the component so the graph view stays focused on
// lifecycle, and every visual decision — shape, colour, typography,
// label placement — has a single source of truth in this module.

import * as THREE from "three";
import SpriteText from "three-spritetext";
import { HUB_COLOR, STATUS, colorFor } from "@/lib/nodes/theme";

// NodeObject/LinkObject from three-forcegraph are `object & { id?, x?,
// y?, z?, … }` — every position/velocity field optional. We declare
// the simulation-populated fields here so our GraphNode is structurally
// assignable to the library's generic parameter (three-forcegraph adds
// x/y/z/vx/…/__threeObj at runtime). Keeping the declarations next to
// our own fields means the library's type constraints stay visible
// right where a new node visual is authored.
export type GraphNode = {
  id: string;
  label: string;
  sublabel?: string;
  role: "hub" | "instance";
  kind?: "trigger" | "action";
  category?: string;
  running?: boolean;
  enabled?: boolean;
  // Populated by the force simulation; never set by producers.
  x?: number;
  y?: number;
  z?: number;
  // Attached by three-forcegraph when it mounts the nodeThreeObject
  // into the scene. The label-anchor rAF loop reads it to re-place
  // the sprite each frame.
  __threeObj?: THREE.Object3D;
};

export type GraphLink = {
  source: string;
  target: string;
};

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

// Grid overlay painted behind the (transparent) Three.js canvas.
// Keeps the UI from looking like a black void and visually anchors
// the free-floating nodes. One place defines it; GraphCanvas and
// the <NodeGraph> both read from here.
export const GRID_BG = {
  // Paired horizontal + vertical linear-gradients draw a pin-stripe
  // lattice. Line weight kept at 1px so it doesn't compete with the
  // nodes themselves; 5% white is readable on the black body without
  // overpowering the pixel-font labels.
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), " +
    "linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "80px 80px",
} as const;

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

// Wireframe overlay along the polygon edges of the node mesh —
// what makes an icosahedron / octahedron / cube read as a faceted
// 3D object instead of a smooth blob. Lifted from the reference
// octohub. Scale 1.03 lifts the lines just outside the mesh surface
// so they don't z-fight with the filled faces underneath.
const WIREFRAME_OPACITY = 0.3;
const WIREFRAME_SCALE = 1.03;

export function nodeObject(n: GraphNode, opts: NodeObjectOptions = {}): THREE.Object3D {
  const group = new THREE.Group();
  const color = colorForNode(n);
  const geometry = geometryFor(n);

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
      metalness: 0.2,
      roughness: 0.4,
    }),
  );
  group.add(mesh);

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: WIREFRAME_OPACITY,
    }),
  );
  wire.scale.setScalar(WIREFRAME_SCALE);
  group.add(wire);

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
