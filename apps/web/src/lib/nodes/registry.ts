// The node catalogue. Adding a new node type is:
//   1. drop a folder under `src/lib/nodes/<slug>/`
//   2. export a NodeDefinition from its index.ts
//   3. append it to the array below
//
// A filesystem scan would save that third line but costs static type
// inference and a dynamic import graph — not worth it until a
// plugin marketplace is on the roadmap.

import type { NodeDefinition } from "./types";
import { telegramTrigger } from "./telegram-trigger";

// A heterogeneous array of NodeDefinition<TConfig> with different
// TConfigs doesn't fit a single parameterised type in TypeScript.
// `NodeDefinition<any>` is the pragmatic escape hatch — every
// call-site that actually runs a node casts the config to the node's
// own shape at the last possible moment.
type AnyDef = NodeDefinition<Record<string, unknown>>;

// The cast is necessary because TriggerContext / start() is
// contravariant in TConfig: telegramTrigger's concrete Config type
// doesn't widen to Record<string, unknown> on its own. Every runtime
// call-site (manager.ts) passes the stored config back through as
// an unknown-shaped record and that's what we actually see.
const NODES: ReadonlyArray<AnyDef> = [
  telegramTrigger as unknown as AnyDef,
] as const;

/**
 * Returns the registered node types. Wrapped in a function so tests
 * and future filesystem-scan modes slot in without touching callers.
 */
export function getRegistry(): ReadonlyArray<AnyDef> {
  return NODES;
}

/**
 * Group by category, preserving the order nodes were registered.
 * The sidebar renders this directly — a flat map of
 * "category label → nodes in it".
 */
export function byCategory(): Array<{ category: string; nodes: AnyDef[] }> {
  const groups = new Map<string, AnyDef[]>();
  for (const n of getRegistry()) {
    const list = groups.get(n.category) ?? [];
    list.push(n);
    groups.set(n.category, list);
  }
  return Array.from(groups.entries()).map(([category, nodes]) => ({ category, nodes }));
}
