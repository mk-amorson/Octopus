// Persistent store for node instances. JSON file on disk; disk IS the
// source of truth — no in-memory cache. Reads parse the file on every
// call (sub-millisecond at the scale we care about), writes go
// tempfile → rename for atomicity.
//
// Why no cache: at ~100 nodes the read cost is irrelevant, and the
// one thing a cache buys you — speed — is dwarfed by the class of
// bugs it creates when something (a concurrent PATCH, a crash mid-
// save, a test) leaves memory and disk out of sync. Disk-only is the
// simplest correct design.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { getRegistry } from "./registry";
import { encrypt, decrypt } from "@/lib/crypto/vault";
import type { NodeInstance } from "./types";

const DATA_DIR = process.env["OCTOPUS_DATA_DIR"] ?? "/app/data";
const NODES_FILE = join(DATA_DIR, "nodes.json");

type FileShape = { version: 1; nodes: NodeInstance[] };

function readAll(): FileShape {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(NODES_FILE)) return { version: 1, nodes: [] };
  const parsed = JSON.parse(readFileSync(NODES_FILE, "utf8")) as FileShape;
  if (parsed?.version !== 1 || !Array.isArray(parsed.nodes)) {
    throw new Error(`${NODES_FILE}: unexpected shape`);
  }
  return parsed;
}

function writeAll(data: FileShape): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmp = NODES_FILE + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, NODES_FILE);
}

export function list(): NodeInstance[] {
  return readAll().nodes.map(decryptSecrets);
}

export function get(id: string): NodeInstance | null {
  const n = readAll().nodes.find((x) => x.id === id);
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
  const data = readAll();
  data.nodes.push(encryptSecrets(instance));
  writeAll(data);
  return instance;
}

export function update(
  id: string,
  patch: Partial<Pick<NodeInstance, "name" | "enabled" | "config">>,
): NodeInstance | null {
  const data = readAll();
  const idx = data.nodes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  const current = decryptSecrets(data.nodes[idx]!);
  const next: NodeInstance = {
    ...current,
    ...patch,
    config: { ...current.config, ...(patch.config ?? {}) },
  };
  data.nodes[idx] = encryptSecrets(next);
  writeAll(data);
  return next;
}

export function remove(id: string): boolean {
  const data = readAll();
  const before = data.nodes.length;
  data.nodes = data.nodes.filter((n) => n.id !== id);
  if (data.nodes.length === before) return false;
  writeAll(data);
  return true;
}

function secretKeys(type: string): Set<string> {
  const def = getRegistry().find((d) => d.id === type);
  if (!def) return new Set();
  return new Set(def.fields.filter((f) => f.type === "text" && f.secret).map((f) => f.key));
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
      try { next[k] = decrypt(v); } catch { next[k] = ""; }
    }
  }
  return { ...n, config: next };
}
