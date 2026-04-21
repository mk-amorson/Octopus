// The single long-lived thing in the app. Keeps a map of currently-
// active triggers (nodeId → StopFn), exposes start/stop/reconcile
// methods that the API routes call when a node is created, updated,
// deleted, or the server boots.
//
// Why a singleton: there can only ever be one process holding one
// Telegram webhook per bot, and the active-trigger state needs to
// outlive any individual HTTP request. This lives at module scope so
// every route handler in the same Node process sees the same
// instance. Wrapped in a globalThis cache so Next's HMR in dev
// doesn't duplicate it on every save.

import { getRegistry } from "./registry";
import { list, get } from "./store";
import { append as appendTrace } from "./traces";
import { webhookUrl } from "./webhook";
import type { NodeInstance, StopFn, TriggerContext } from "./types";

type Active = {
  stop: StopFn;
  type: string;
};

const GLOBAL_KEY = Symbol.for("octopus.nodes.manager");
type GlobalCache = { started: boolean; active: Map<string, Active> };

function cache(): GlobalCache {
  const g = globalThis as unknown as Record<symbol, GlobalCache | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { started: false, active: new Map() };
  return g[GLOBAL_KEY]!;
}

function ctxFor(instance: NodeInstance): TriggerContext {
  const def = getRegistry().find((d) => d.id === instance.type);
  return {
    nodeId: instance.id,
    webhookUrl: def?.webhookPathSlug
      ? webhookUrl(instance.id, def.webhookPathSlug)
      : "",
    trace: (level, message, payload) => appendTrace(instance.id, level, message, payload),
  };
}

export const manager = {
  /** Called once from instrumentation on server boot. Idempotent. */
  async bootstrap(): Promise<void> {
    const c = cache();
    if (c.started) return;
    c.started = true;
    for (const instance of list()) {
      if (instance.enabled) {
        await this.start(instance.id);
      }
    }
  },

  /** Start the trigger for a given node instance, replacing any
   *  currently-running instance of the same id. */
  async start(nodeId: string): Promise<void> {
    const c = cache();
    await this.stop(nodeId);
    const instance = get(nodeId);
    if (!instance) throw new Error(`node ${nodeId} not found`);
    const def = getRegistry().find((d) => d.id === instance.type);
    if (!def) {
      appendTrace(nodeId, "error", `unknown node type ${instance.type}`);
      return;
    }
    try {
      const stop = await def.start(instance.config as never, ctxFor(instance));
      c.active.set(nodeId, { stop, type: instance.type });
    } catch (err) {
      appendTrace(nodeId, "error", `start failed: ${(err as Error).message}`);
    }
  },

  async stop(nodeId: string): Promise<void> {
    const a = cache().active.get(nodeId);
    if (!a) return;
    cache().active.delete(nodeId);
    try {
      await a.stop();
    } catch (err) {
      appendTrace(nodeId, "warn", `stop threw: ${(err as Error).message}`);
    }
  },

  isRunning(nodeId: string): boolean {
    return cache().active.has(nodeId);
  },
};
