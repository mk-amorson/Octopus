// Symmetric vault for node credentials. Every secret field in a
// config file goes through here before landing on disk.
//
// Design:
//   - Key derived via scrypt(OCTOPUS_TOKEN, salt="octopus:vault:v1").
//     Rotating the admin token via `octopus token rotate` therefore
//     invalidates every stored credential — a clean blast-radius
//     boundary. The alternative (a random encryption key stored next
//     to the ciphertext) gives nothing beyond "file obfuscation" on
//     a single-user box.
//   - AES-256-GCM, 12-byte IV per value. Authenticated: a tampered
//     ciphertext throws on decrypt rather than silently yielding junk.
//   - Serialised envelope: base64url(iv).base64url(ciphertext+tag).
//     Short enough to keep inline in config.json, self-describing
//     enough to decrypt with just the passphrase.
//
// Out of scope for v1: key rotation with re-encryption. When the admin
// token rotates, the server simply logs a warning and the affected
// nodes refuse to start until their credentials are re-entered.

import { createCipheriv, createDecipheriv, randomFillSync, scryptSync } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SALT = Buffer.from("octopus:vault:v1", "utf8");

function getKey(): Buffer {
  const token = (process.env["OCTOPUS_TOKEN"] ?? "").trim();
  if (!token) throw new Error("OCTOPUS_TOKEN not set — cannot derive vault key");
  // scrypt params chosen to be fast enough for request-time decrypt
  // (N=2^14 ≈ 15 ms on a laptop) and slow enough to resist casual
  // offline attack on a leaked disk image.
  return scryptSync(token, SALT, KEY_BYTES, { N: 16384, r: 8, p: 1 });
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function encrypt(plain: string): string {
  const iv = Buffer.alloc(IV_BYTES);
  // Non-crypto-RNG would be fine for IV uniqueness under GCM, but
  // node:crypto's randomFillSync is already fast and available.
  randomFillSync(iv);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${b64url(iv)}.${b64url(Buffer.concat([ct, tag]))}`;
}

export function decrypt(envelope: string): string {
  const dot = envelope.indexOf(".");
  if (dot <= 0) throw new Error("vault: malformed envelope");
  const iv = unb64url(envelope.slice(0, dot));
  const body = unb64url(envelope.slice(dot + 1));
  if (body.length < 16) throw new Error("vault: body too short for auth tag");
  const tag = body.subarray(body.length - 16);
  const ct = body.subarray(0, body.length - 16);
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plain.toString("utf8");
}
