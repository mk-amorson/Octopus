// The single node type that ships today: the Octopus Hub. Every
// install has exactly one instance of this — the central marker on
// the 3D graph, carrying only a name and a description. No settings,
// no runtime — the panel shows it read-only for now and future node
// types (triggers, actions, AI) will connect in around it.

import type { NodeDefinition } from "../types";

export const defaultNode: NodeDefinition<Record<string, never>> = {
  id: "node.default",
  name: "Octopus Hub",
  category: "Platform",
  kind: "trigger",
  description:
    "The core of the platform. Every other node you add connects in around this hub; events flow through it, settings live one layer deeper, and the 3D map always keeps the hub at its centre.",
  fields: [],
  graphRole: "hub",
  inputs: [],
  outputs: [],
  defaults: () => ({}),
  async start() {
    // Pure config marker — no runtime, no side effects. Return a
    // no-op stop handle so the manager's reconcile path stays
    // uniform as real triggers land next to it.
    return async () => {};
  },
};
