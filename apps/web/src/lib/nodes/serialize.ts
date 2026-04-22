// The one function that converts a persisted NodeInstance into the
// shape the UI sees. Handles secret stripping, `running` flag, and
// webhook URL in one place; every API route and every server-
// component page that renders node data goes through it.

import { getRegistry } from "./registry";
import { manager } from "./manager";
import { webhookUrl } from "./webhook";
import type { NodeInstance } from "./types";

export type PublicNode = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  running: boolean;
  /** Secret fields become `{ __set: boolean }`; other fields pass
   *  through verbatim so the form can pre-fill non-sensitive values. */
  config: Record<string, unknown>;
  createdAt: number;
  /** Non-empty when the node's definition declares a webhookPathSlug
   *  and the install has a public URL configured. UI renders this
   *  directly — no client-side assembly, no hardcoded paths. */
  webhookUrl: string;
};

/** Set of config keys that hold secret values for this node type. */
export function secretKeysFor(type: string): Set<string> {
  const def = getRegistry().find((d) => d.id === type);
  if (!def) return new Set();
  return new Set(
    def.fields.filter((f) => f.type === "text" && f.secret).map((f) => f.key),
  );
}

export function toPublicView(instance: NodeInstance): PublicNode {
  const def = getRegistry().find((d) => d.id === instance.type);
  const secrets = secretKeysFor(instance.type);
  const config: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(instance.config)) {
    config[k] = secrets.has(k)
      ? { __set: typeof v === "string" && v.length > 0 }
      : v;
  }
  return {
    id: instance.id,
    type: instance.type,
    name: instance.name,
    enabled: instance.enabled,
    running: manager.isRunning(instance.id),
    config,
    createdAt: instance.createdAt,
    webhookUrl: def?.webhookPathSlug
      ? webhookUrl(instance.id, def.webhookPathSlug)
      : "",
  };
}
