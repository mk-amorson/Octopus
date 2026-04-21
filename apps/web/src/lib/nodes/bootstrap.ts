// Runs once per container start, before the manager reads the store.
// Two jobs:
//   1. Drop orphans — any instance whose `type` no longer appears in
//      the registry (a node type was removed between releases).
//      Otherwise they'd linger as grey clickable shapes on the graph
//      with no definition behind them.
//   2. Seed the default node on a fresh install (empty store after
//      orphan cleanup) so every canvas has something to interact
//      with.

import { create, list, remove } from "./store";
import { getRegistry } from "./registry";
import { defaultNode } from "./default";

export function seedDefaults(): void {
  const knownTypes = new Set(getRegistry().map((d) => d.id));
  for (const inst of list()) {
    if (!knownTypes.has(inst.type)) remove(inst.id);
  }
  if (list().length > 0) return;
  create(defaultNode.id, defaultNode.name);
}
