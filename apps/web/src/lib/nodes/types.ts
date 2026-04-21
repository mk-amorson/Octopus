// The node contract. Every node definition in the registry implements
// this shape. Intentionally tiny: the whole UI (sidebar catalogue,
// config form, trace panel) and the whole runtime (start / stop, trace
// emission, webhook routing) compose out of these fields.
//
// Design goals:
//   1. One file per node. No base class, no decorators, no sidecar
//      HTML templates (Node-RED's mistake). Just an object literal
//      that we can put next to its implementation.
//   2. No build step beyond `tsc`. `fields` is a plain array so the
//      UI can render the form without running a JSON-schema compiler.
//   3. Trigger runtime is `start(cfg) => stop()` — a standard handle
//      pattern that generalises from "own a webhook route" to "own a
//      long-running WebSocket / polling loop" without any contract
//      change.

export type FieldSpec =
  | {
      key: string;
      label: string;
      type: "text";
      placeholder?: string;
      /** Mask input + store encrypted. */
      secret?: boolean;
      required?: boolean;
    }
  | {
      key: string;
      label: string;
      type: "boolean";
    };

export type NodeKind = "trigger" | "action";

export type TraceLevel = "info" | "warn" | "error";

export type TraceEmit = (
  level: TraceLevel,
  message: string,
  payload?: unknown,
) => void;

/**
 * Everything a trigger needs to function — a trace sink, a stable
 * webhook URL, and a scoped logger in one unified object. The runtime
 * populates this before calling start().
 */
export type TriggerContext = {
  /** Stable id of this node instance, for building webhook URLs. */
  nodeId: string;
  /** Fully-qualified public URL the trigger should register with the
   *  external service — includes basePath, e.g.
   *  `https://amorson.me/octopus/api/hooks/telegram/<uuid>`. Empty
   *  string when no public URL is configured; triggers that need one
   *  should refuse to start and surface that in a trace. */
  webhookUrl: string;
  /** Append a single event to this node's trace stream. */
  trace: TraceEmit;
};

/** Returned by start() — call to tear the trigger down. */
export type StopFn = () => void | Promise<void>;

export type NodeConfig = Record<string, unknown>;

// One non-generic shape for every node definition. A previous version
// parameterised this on TConfig, which forced every call-site in the
// manager + registry to cast through `unknown` (TypeScript functions
// are contravariant in their argument types, so narrower configs don't
// survive heterogeneous arrays). The runtime already persists config
// as NodeConfig end-to-end — it reads JSON, validates per-field on
// save, and hands the same object back to start(). Authors of a new
// node type narrow the shape internally in their start() body, where
// they already know which keys they own.
export type NodeDefinition = {
  /** Dotted identifier, e.g. `telegram.trigger`. Stable — used as the
   *  discriminator in persisted config and in the registry. */
  id: string;
  /** Human label shown in the sidebar / catalogue. */
  name: string;
  /** Top-level group in the sidebar, e.g. "Triggers". */
  category: string;
  kind: NodeKind;
  description: string;
  /** Form fields rendered for the user in the config panel. */
  fields: FieldSpec[];
  /**
   * If set, this node owns a public webhook. The slug is dropped into
   * the URL as `/api/hooks/<slug>/<nodeId>` and the runtime builds
   * the full URL via lib/nodes/webhook.ts. Every node that wants to
   * advertise a callback URL to the world sets this — no more
   * hardcoding per-type paths in the UI.
   */
  webhookPathSlug?: string;
  /**
   * How the 3D graph should draw this node. "hub" = central platform
   * marker (icosahedron, hub colour); "instance" = orbiting node
   * shaped by its `kind`. Defaults to "instance".
   */
  graphRole?: "hub" | "instance";
  /**
   * Short human labels listed in the sidebar info panel so a visitor
   * can tell, at a glance, what kind of signals this node consumes
   * and emits. Connections between instances are derived separately
   * from the live graph links.
   */
  inputs?: string[];
  outputs?: string[];
  /** Zero-state for a freshly-created instance. Empty object is fine. */
  defaults: () => NodeConfig;
  /**
   * Activate the trigger. Return a stop function the runtime will call
   * on disable / config change / shutdown. For action nodes that don't
   * own a long-running resource, return a no-op.
   */
  start: (cfg: NodeConfig, ctx: TriggerContext) => Promise<StopFn>;
};

/** Persisted shape. `config` may contain ciphertext for `secret: true`
 *  fields — the nodes module handles encrypt/decrypt transparently. */
export type NodeInstance = {
  id: string; // uuid
  type: string; // NodeDefinition.id
  name: string;
  enabled: boolean;
  config: NodeConfig;
  createdAt: number;
};
