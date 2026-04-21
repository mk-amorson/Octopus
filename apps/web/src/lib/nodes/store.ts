// Persistent store for node instances. JSON file on disk, one object
// per field. Secret fields go through the vault — no plaintext token
// ever lands in the config file.
//
// Why a flat JSON file:
//   - Zero external deps (no sqlite native binary to rebuild per arch).
//   - Atomic writes via tempfile + rename; survives crashes.
//   - Easy to back up, easy to diff, easy to migrate later.
//
// Runs on the docker-managed `octopus_data` named volume; surviving
// `octopus update` is the whole point of putting it there.

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getRegistry } from "./registry";
import { encrypt, decrypt } from "@/lib/crypto/vault";
import type { NodeInstance } from "./types";

const DATA_DIR = process.env["OCTOPUS_DATA_DIR"] ?? "/app/data";
const NODES_FILE = join(DATA_DIR, "nodes.json");

type FileShape = {
  version: 1;
  nodes: NodeInstance[];
};

let cache: FileShape | null = null;

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function load(): FileShape {
  if (cache) return cache;
  ensureDir();
  if (!existsSync(NODES_FILE)) {
    cache = { version: 1, nodes: [] };
    return cache;
  }
  const raw = readFileSync(NODES_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as FileShape;
    if (parsed?.version !== 1 || !Array.isArray(parsed.nodes)) {
      throw new Error("nodes.json: unexpected shape");
    }
    cache = parsed;
    return cache;
  } catch (err) {
    // Corrupt file — refuse to start rather than silently wipe user
    // state. They can inspect /data/nodes.json by hand.
    throw new Error(`Failed to read ${NODES_FILE}: ${(err as Error).message}`);
  }
}

function save(data: FileShape) {
  ensureDir();
  const tmp = NODES_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, NODES_FILE);
  cache = data;
}

/** Return every node instance. Secret fields come back DECRYPTED — the
 *  runtime needs the plaintext to actually start triggers. The API
 *  layer is responsible for stripping secrets before sending to the
 *  browser. */
export function list(): NodeInstance[] {
  return load().nodes.map(decryptSecrets);
}

export function get(id: string): NodeInstance | null {
  const n = load().nodes.find((x) => x.id === id);
  return n ? decryptSecrets(n) : null;
}

export function create(type: string, name: string): NodeInstance {
  const def = getRegistry().find((d) => d.id === type);
  if (!def) throw new Error(`unknown node type: ${type}`);
  const instance: NodeInstance = {
    id: randomUUID(),
    type,
    name: name || def.name,
    enabled: false,
    config: def.defaults() as Record<string, unknown>,
    createdAt: Date.now(),
  };
  const data = load();
  data.nodes.push(encryptSecrets(instance));
  save(data);
  return instance; // plaintext for the caller
}

export function update(
  id: string,
  patch: Partial<Pick<NodeInstance, "name" | "enabled" | "config">>,
): NodeInstance | null {
  const data = load();
  const idx = data.nodes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const current = decryptSecrets(data.nodes[idx]!);
  const next: NodeInstance = {
    ...current,
    ...patch,
    config: { ...current.config, ...(patch.config ?? {}) },
  };
  data.nodes[idx] = encryptSecrets(next);
  save(data);
  return next;
}

export function remove(id: string): boolean {
  const data = load();
  const before = data.nodes.length;
  data.nodes = data.nodes.filter((n) => n.id !== id);
  if (data.nodes.length === before) return false;
  save(data);
  return true;
}

// --- secret handling --------------------------------------------------

function secretKeys(type: string): Set<string> {
  const def = getRegistry().find((d) => d.id === type);
  if (!def) return new Set();
  const keys = new Set<string>();
  for (const f of def.fields) {
    if (f.type === "text" && f.secret) keys.add(f.key);
  }
  return keys;
}

function encryptSecrets(n: NodeInstance): NodeInstance {
  const keys = secretKeys(n.type);
  if (keys.size === 0) return n;
  const next: Record<string, unknown> = { ...n.config };
  for (const k of keys) {
    const v = next[k];
    if (typeof v === "string" && v !== "") next[k] = encrypt(v);
  }
  return { ...n, config: next };
}

function decryptSecrets(n: NodeInstance): NodeInstance {
  const keys = secretKeys(n.type);
  if (keys.size === 0) return n;
  const next: Record<string, unknown> = { ...n.config };
  for (const k of keys) {
    const v = next[k];
    if (typeof v === "string" && v !== "") {
      try {
        next[k] = decrypt(v);
      } catch {
        // Key mismatch (e.g. token was rotated). Leave encrypted —
        // runtime will refuse to start this node with a readable
        // trace, and the UI will show an empty secret field asking
        // the user to re-enter.
        next[k] = "";
      }
    }
  }
  return { ...n, config: next };
}
