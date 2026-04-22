// Node-runtime-only bootstrap. Loaded exclusively via the
// runtime-guarded dynamic import in `instrumentation.ts`, so it can
// freely pull modules that use `node:fs`, `node:crypto`, etc., without
// tripping webpack's edge-runtime build pass.

import { seedDefaults } from "./lib/nodes/bootstrap";
import { manager } from "./lib/nodes/manager";

// Order matters: seed before the manager reads the store for enabled
// triggers. If we seeded after, the freshly planted default node
// wouldn't participate in the first reconciliation cycle (not a bug
// today — the default node is disabled by default and has no runtime
// — but it keeps the bootstrap path honest for the next node type).
seedDefaults();
void manager.bootstrap();
