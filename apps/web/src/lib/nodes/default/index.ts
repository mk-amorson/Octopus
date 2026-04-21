// The one node type that ships today. A placeholder / playground for
// building out the platform UX on a single, stable target. No
// external integrations, no webhooks, no runtime — pure config so
// the panel, graph, save/load, and visual affordances get shaken
// down before any real node type is layered on top.
//
// Adding new node types later is a one-file drop under
// `src/lib/nodes/<slug>/index.ts` + one append to registry.ts.

import type { NodeDefinition } from "../types";

type Config = {
  label: string;
  notes: string;
};

export const defaultNode: NodeDefinition<Config> = {
  id: "node.default",
  name: "Node",
  category: "General",
  kind: "trigger",
  description:
    "Your first node. Rename it, write notes, flip the enabled toggle — every new kind of node we add later will use the same side-panel pattern.",
  fields: [
    {
      key: "label",
      label: "Label",
      type: "text",
      placeholder: "What is this node about?",
    },
    {
      key: "notes",
      label: "Notes",
      type: "text",
      placeholder: "Free-form text. Markdown later.",
    },
  ],
  defaults: () => ({ label: "", notes: "" }),
  async start() {
    // No runtime for the default node — it's a configurable object,
    // not a trigger. Return a no-op stop handle so the manager
    // reconciliation path stays uniform.
    return async () => {};
  },
};
