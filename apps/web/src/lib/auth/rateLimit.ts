// In-memory sliding-window rate limiter. Scoped to a single Next.js
// server instance, which is the only deployment shape Octopus ships —
// one container, one process. If we ever clustered, swap the Map for
// something external (Redis), but leave the function signature alone.

import { LOGIN_RATE_LIMIT } from "./config";

type Bucket = { hits: number[] };

const buckets = new Map<string, Bucket>();

// Keep the map from growing forever if a steady trickle of unique IPs
// hits us and then goes away. Called opportunistically on every take().
function sweep(now: number) {
  for (const [key, b] of buckets) {
    b.hits = b.hits.filter((t) => now - t < LOGIN_RATE_LIMIT.windowMs);
    if (b.hits.length === 0) buckets.delete(key);
  }
}

export type RateResult =
  | { ok: true }
  | { ok: false; retryAfterMs: number };

/**
 * Record one attempt for `key` (usually a client IP). Returns ok=true
 * when the caller is under budget, otherwise reports how many ms until
 * the oldest attempt slides out of the window.
 */
export function take(key: string, now: number = Date.now()): RateResult {
  if (buckets.size > 1024) sweep(now);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < LOGIN_RATE_LIMIT.windowMs);

  if (bucket.hits.length >= LOGIN_RATE_LIMIT.max) {
    const oldest = bucket.hits[0] ?? now;
    return { ok: false, retryAfterMs: LOGIN_RATE_LIMIT.windowMs - (now - oldest) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true };
}

/**
 * Best-effort client IP. Behind Caddy we see X-Forwarded-For; direct
 * binds (no proxy) fall back to the CF-Connecting-IP / X-Real-IP
 * siblings and finally to a sentinel so a broken proxy config can't
 * collapse every request into one unlimited bucket.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
