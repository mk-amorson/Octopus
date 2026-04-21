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

export type NodeDefinition<TConfig = Record<string, unknown>> = {
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
   * Build a config form's default values from nothing — used when a
   * new node instance is created. Returning an empty object is fine;
   * defined explicitly so TypeScript knows the config shape.
   */
  defaults: () => TConfig;
  /**
   * Activate the trigger. Return a stop function the runtime will call
   * on disable / config change / shutdown. For action nodes that don't
   * own a long-running resource, return a no-op.
   */
  start: (cfg: TConfig, ctx: TriggerContext) => Promise<StopFn>;
};

/** Persisted shape. `config` may contain ciphertext for `secret: true`
 *  fields — the nodes module handles encrypt/decrypt transparently. */
export type NodeInstance = {
  id: string; // uuid
  type: string; // NodeDefinition.id
  name: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: number;
};
