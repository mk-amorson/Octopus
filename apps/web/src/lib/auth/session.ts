// Session cookie: sign(iat) with HMAC-SHA256 keyed on OCTOPUS_TOKEN.
//
// Why this shape:
//   - Single secret (OCTOPUS_TOKEN) governs both the login check and
//     session signing. Rotating the token via `octopus token rotate`
//     cleanly invalidates every outstanding session — no extra
//     "session_secret" to bookkeep.
//   - Web Crypto (not node:crypto) so the same module is importable
//     from middleware (edge runtime) and route handlers (node runtime).
//   - Stateless: the server keeps no session store. The cookie IS the
//     session; verification is a single HMAC round-trip.
//
// Cookie value format:  <b64url(iat)>.<b64url(hmac)>
//
//   iat     : issued-at epoch millis as decimal ascii
//   hmac    : HMAC-SHA256(iatBytes, key=OCTOPUS_TOKEN)
//
// Verification checks the HMAC (constant time), then the age.

import { SESSION_MAX_AGE_MS } from "./config";

const enc = new TextEncoder();

function getSecret(): string {
  const s = (process.env["OCTOPUS_TOKEN"] ?? "").trim();
  // Empty secret => every login 401s, every cookie fails to verify.
  // That's the correct behaviour for an install that forgot the env var,
  // but we return a sentinel non-empty string so importKey doesn't throw
  // and so the constant-time path still runs.
  return s || "\x00";
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(key: string, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

// Constant-time byte compare. Length difference is reported as mismatch
// after walking the longer buffer, so timing can't tell length apart
// from value.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

/** Mint a freshly-signed session cookie value. */
export async function issue(): Promise<string> {
  const iat = Date.now().toString();
  const iatBytes = enc.encode(iat);
  const sig = await hmac(getSecret(), iatBytes);
  return `${b64urlEncode(iatBytes)}.${b64urlEncode(sig)}`;
}

/**
 * Validate a cookie value. Returns true only when the HMAC matches AND
 * the issued-at timestamp is within SESSION_MAX_AGE_MS of now.
 */
export async function verify(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot <= 0 || dot === cookieValue.length - 1) return false;

  let iatBytes: Uint8Array;
  let sig: Uint8Array;
  try {
    iatBytes = b64urlDecode(cookieValue.slice(0, dot));
    sig = b64urlDecode(cookieValue.slice(dot + 1));
  } catch {
    return false;
  }

  const expected = await hmac(getSecret(), iatBytes);
  if (!timingSafeEqual(sig, expected)) return false;

  const iat = Number.parseInt(new TextDecoder().decode(iatBytes), 10);
  if (!Number.isFinite(iat)) return false;
  return Date.now() - iat < SESSION_MAX_AGE_MS;
}

/** Validate a user-submitted token against the configured admin secret. */
export async function matchesAdminToken(submitted: string): Promise<boolean> {
  const expected = (process.env["OCTOPUS_TOKEN"] ?? "").trim();
  const got = submitted.trim();
  if (!expected || !got) return false;
  return timingSafeEqual(enc.encode(got), enc.encode(expected));
}
