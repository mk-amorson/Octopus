// Runs once per container start, before the manager reads the store.
//   1. Drop orphans — any instance whose `type` no longer appears in
//      the registry (a node type was removed between releases).
//   2. Seed the default node on an empty store.
//   3. Migrate legacy auto-seeded names. We rename silently only when
//      the instance still looks untouched (every config value is the
//      field's zero value) so a future user-typed name is never
//      stomped on by a boot-time housekeeping pass.

import { create, list, remove, update } from "./store";
import { getRegistry } from "./registry";
import { defaultNode } from "./default";

// Names that previous releases gave to the auto-seeded default node.
// Used to migrate stored instances in-place when we rename the type.
const LEGACY_SEED_NAMES = new Set(["Node", "Telegram Bot"]);

function isUntouched(config: Record<string, unknown>): boolean {
  return Object.values(config).every((v) => v === "" || v === false);
}

export function seedDefaults(): void {
  const defs = new Map(getRegistry().map((d) => [d.id, d]));

  for (const inst of list()) {
    if (!defs.has(inst.type)) remove(inst.id);
  }

  if (list().length === 0) {
    create(defaultNode.id, defaultNode.name);
    return;
  }

  for (const inst of list()) {
    const def = defs.get(inst.type);
    if (!def) continue;
    if (
      inst.name !== def.name &&
      LEGACY_SEED_NAMES.has(inst.name) &&
      isUntouched(inst.config)
    ) {
      update(inst.id, { name: def.name });
    }
  }
}
