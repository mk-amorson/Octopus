// Auth configuration constants. Single source of truth for cookie name,
// session lifetime, rate-limit budgets, and how the client prefixes
// same-origin fetches with the installer-chosen basePath.

export const COOKIE_NAME = "octopus_session";

// 30 days. Long enough that users don't retype the token every week;
// short enough that a lost device doesn't hold a session forever.
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Sliding window on /api/auth/login to blunt online brute-forcing.
// 10 attempts / minute per client IP — generous for a human, ruinous
// for a scripted guesser on a 256-bit search space.
export const LOGIN_RATE_LIMIT = { max: 10, windowMs: 60_000 } as const;

// Next's `basePath` is baked in at build time (see next.config.mjs).
// Both `<Link>` hrefs and asset URLs get auto-prefixed, but ad-hoc
// `fetch("/api/...")` does not — the client has to prepend basePath
// itself. Keep the lookup here so components don't read env directly.
const BASE_PATH = process.env["NEXT_PUBLIC_OCTOPUS_BASE_PATH"] ?? "";

export function apiUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}

export const ROUTES = {
  login: "/login",
  home: "/",
  apiLogin: "/api/auth/login",
  apiLogout: "/api/auth/logout",
} as const;
