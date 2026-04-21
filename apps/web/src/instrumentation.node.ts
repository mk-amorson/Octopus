// Node-runtime-only bootstrap. Loaded exclusively via the
// runtime-guarded dynamic import in `instrumentation.ts`, so it can
// freely pull modules that use `node:fs`, `node:crypto`, etc., without
// tripping webpack's edge-runtime build pass.

import { manager } from "./lib/nodes/manager";

void manager.bootstrap();
