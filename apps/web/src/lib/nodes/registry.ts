// The node catalogue. Adding a new node type is:
//   1. drop a folder under `src/lib/nodes/<slug>/`
//   2. export a NodeDefinition from its index.ts
//   3. append it to the array below
//
// One-file-per-type + explicit array keeps static type inference and
// avoids a filesystem-scan dynamic-import graph we don't need yet.

import type { NodeDefinition } from "./types";
import { defaultNode } from "./default";

const NODES: ReadonlyArray<NodeDefinition> = [defaultNode];

export function getRegistry(): ReadonlyArray<NodeDefinition> {
  return NODES;
}

export function byCategory(): Array<{ category: string; nodes: NodeDefinition[] }> {
  const groups = new Map<string, NodeDefinition[]>();
  for (const n of getRegistry()) {
    const list = groups.get(n.category) ?? [];
    list.push(n);
    groups.set(n.category, list);
  }
  return Array.from(groups.entries()).map(([category, nodes]) => ({ category, nodes }));
}
