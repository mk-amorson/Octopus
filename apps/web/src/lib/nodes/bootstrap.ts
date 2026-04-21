// On first server boot we plant one instance of the default node
// type so every fresh install has something to click on the 3D map.
// Idempotent: if any node already exists we leave the store alone.
//
// Called from instrumentation.node.ts before the manager starts, so
// the seeded node participates in the usual start/stop reconciliation
// with no special case.

import { create, list } from "./store";
import { defaultNode } from "./default";

export function seedDefaults(): void {
  if (list().length > 0) return;
  create(defaultNode.id, defaultNode.name);
}
