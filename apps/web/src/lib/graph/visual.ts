// Pure factories for the three.js objects the 3D node graph renders.
// Separate module so the component stays focused on lifecycle and
// both sides (shape, colour) have a single source of truth — the
// graph view imports from here, nothing else does.

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

export function nodeObject(n: GraphNode): THREE.Object3D {
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
  label.fontFace = "monospace";
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
