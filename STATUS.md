# Octopus — Status

_Snapshot as of 2026-04-21 (v0.1.24)._

## What this project is

A single-user, self-hosted web app with a one-command installer. Users run
`curl | sh` (or the PowerShell equivalent), the installer downloads the
source tarball for the latest GitHub release, builds it under Docker, and
starts it on their own machine. No hosted control plane, no account, no
telemetry.

Two products ship together under the same `vX.Y.Z` tag:

- `apps/web` — the Next.js 14 App Router frontend users see.
- `installer/` — the Go CLI (`octopus`) that manages the app's lifecycle.

## Current release: v0.1.24

**Real session auth + hardening pass.** The login screen is no longer a
decorative widget — a correct token now sets an httpOnly session cookie,
middleware gates every route behind it, and the dashboard sits at `/`
waiting to be built out.

### Auth protocol (single source of truth)

`apps/web/src/lib/auth/session.ts` is the one module that knows how a
session is signed and verified:

- Cookie: `octopus_session`, httpOnly, SameSite=Lax.
- Value: `<b64url(iat)>.<b64url(HMAC-SHA256(iat, key=OCTOPUS_TOKEN))>`.
- Max age: 30 days. Rotating the admin token (via `octopus token rotate`)
  invalidates every outstanding session — no second secret to manage.
- Verification uses Web Crypto, so the same function works in middleware
  (edge runtime) and in route handlers (node runtime).

### Request flow

```
  visitor ──▶ middleware.ts ──▶ cookie valid? ──▶ yes ──▶ page
                  │                 │
                  │                 └── no ───▶ 302 /login?redirect=<path>
                  │
                  └── /login with valid cookie ──▶ 302 /  (or ?redirect)
```

- `POST /api/auth/login`  — validates the token, issues the cookie.
- `POST /api/auth/logout` — clears the cookie.
- Everything else is gated.

### Rate limiting

In-memory sliding window on `/api/auth/login`
(`lib/auth/rateLimit.ts`): **10 attempts per minute per client IP**,
response `429` with `Retry-After`. Single-process-only by design —
Octopus ships one container, one process.

## Repo layout

```
apps/web/
  src/
    app/
      (app)/page.tsx            Dashboard at /   (gated)
      (auth)/login/page.tsx     Login screen at /login
      api/auth/
        login/route.ts          Validate token, set cookie
        logout/route.ts         Clear cookie
      layout.tsx                Loads octopus-pixel.ttf
    components/
      Logo.tsx                  Reusable wordmark + version label
      TokenGate.tsx             POSTs /api/auth/login, redirects on ok
      LogoutButton.tsx          POSTs /api/auth/logout
    lib/auth/
      config.ts                 Cookie name, MAX_AGE, rate-limit budget,
                                basePath-aware apiUrl()
      session.ts                HMAC sign/verify (Web Crypto)
      rateLimit.ts              Per-IP sliding window
    middleware.ts               Single gate over every route
  Dockerfile                    Standalone Next build
  .eslintrc.json                Next core-web-vitals config (CI gate)

docs/pages/
  install                       curl | sh bootstrap (Linux/macOS)
  install.ps1                   iwr | iex bootstrap (Windows)
  index.html                    Landing for GitHub Pages

installer/
  cmd/octopus/                  Entry point
  internal/
    caddy/                      Marker-checked install/remove + .bak restore
    commands/                   install, lifecycle, update, uninstall, token
    docker/                     v2 plugin → v1 standalone fallback
    source/                     tarball download, size-capped, path-safe
    state/                      config.json with atomic rename
    token/                      hex-encoded 32-byte secret
    wizard/                     strict regex validation on domain + basePath
    selfupdate/                 SHA256-verified CLI self-replace
    stack/                      compose render, build, up/down

.github/workflows/
  ci.yml                        lint / typecheck / build / vet on every PR
  tag.yml                       mobile-friendly "cut a tag" button
  release.yml                   goreleaser: six binaries + checksums.txt
  pages.yml                     docs/pages/ → GitHub Pages
```

## Hardening shipped in v0.1.24

| Area | Before | After |
| --- | --- | --- |
| TokenGate | Shows "success" but no cookie, no session, dead end | Sets HMAC-signed cookie, middleware redirects to dashboard |
| verify-token rate limit | none | 10/min/IP, 429 with Retry-After |
| `octopus uninstall` Caddy | `rm -f` regardless of ownership | Marker-check + `.bak` restore |
| Tarball extraction | `Contains(rel, "..")` substring check | `filepath.Clean` + prefix verify; 200 MiB size cap |
| Wizard validation | `domain` must contain `.`, no space; `basePath` starts with `/` | Strict regex — no YAML/Caddyfile injection surface |
| Docker compose detection | v2 only; fails on v1-only hosts | v2 plugin preferred, v1 standalone fallback |
| Windows PATH hint | Skipped entirely | Prints PowerShell + cmd one-liners |
| `config.json` write | Bare `WriteFile` (torn write on crash) | Temp + atomic rename |
| Install flow | `state.Save` after Caddy — Caddy fail = orphaned install | `state.Save` before Caddy |
| CI | None | `.github/workflows/ci.yml` on every PR |

## Gaps / known follow-ups

- **No test suite** on either side (`apps/web` or `installer/`). CI runs
  static checks only.
- **`packages/`** declared in `pnpm-workspace.yaml` but does not exist.
  Reserved for shared libs.
- **Dashboard is intentionally bare** — the authenticated area just shows
  the logo + a logout button. Real features grow here next.
- **Source tarball integrity** still rides on GitHub TLS alone; the CLI
  binary has defence-in-depth via checksums.txt but the source does not.
- **No `octopus logs` command** — users still need to know about
  `docker logs octopus-web`.

## Toolchain

- pnpm 9.12.0 (via corepack), Node >=20.11.0.
- Go — stdlib only, no third-party deps.
- Docker on the host at runtime (installer will install it if missing).
