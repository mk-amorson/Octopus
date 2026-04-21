# Octopus — Status

_Snapshot as of 2026-04-21 (v0.1.42)._

## What this project is

A single-user, self-hosted web app with a one-command installer. Users run
`curl | sh` (or the PowerShell equivalent), the installer downloads the
source tarball for the latest GitHub release, builds it under Docker, and
starts it on their own machine. No hosted control plane, no account, no
telemetry.

Two products ship together under the same `vX.Y.Z` tag:

- `apps/web` — the Next.js 14 App Router frontend users see.
- `installer/` — the Go CLI (`octopus`) that manages the app's lifecycle.

## Current release: v0.1.42

**Audit pass.** No user-visible change from v0.1.41 — the motion,
the graph, the login all render identically. Underneath: every
`as unknown as` cast except one library-boundary bridge is gone, the
magic timings in the graph + token gate are named constants, and this
doc is back in sync with the code.

**The platform shell is live.** After the v0.1.24 auth+hardening pass the
dashboard grew into the primary surface: a full-bleed 3D force graph with
the Octopus Hub in the centre, a categorised sidebar tree on the left, and
the wiring for future node types already in place — one node definition
per folder, one line in the registry, zero per-type branches anywhere else.

Only one node type ships today (`node.default`, the Hub). Telegram,
actions, AI and other triggers plug into the same contract when they land.

## The dashboard

```
┌─────────────────────┬──────────────────────────────────────────────────┐
│ octopus             │                                                  │
│                     │                                                  │
│ ▾ PLATFORM      1   │                 ● Octopus Hub                    │
│   Octopus Hub  ●    │              (3D icosahedron, orbit)             │
│   ┌ description     │                                                  │
│   ┌ inputs  —       │                                                  │
│   ┌ outputs —       │         grid backdrop · wireframe edges          │
│   ┌ connections —   │                                                  │
│                     │                                                  │
│ log out             │                                                  │
└─────────────────────┴──────────────────────────────────────────────────┘
```

- Left sidebar (`AppShell` → `NodeTree`): collapsible **categories** from
  the registry, each listing its node instances as `NodeTile` rows. A tile
  expands inline to show description / inputs / outputs / connections.
  Selection is single — opening a tile closes any other open one.
- Main canvas (`GraphCanvas` → `NodeGraphLoader` → `NodeGraph`): the 3D
  force graph, lazy-loaded because Three.js weighs ~650 KB gzipped and
  only works in the browser. A grid backdrop paints behind the
  transparent WebGL canvas so the free-floating nodes have a sense of
  scale.
- Selection bridges the two via a single `SelectionContext`: click a
  node in the graph, the tile opens; click a tile, the camera focuses.

## The node platform

```
apps/web/src/lib/nodes/
  types.ts          NodeDefinition, NodeInstance, FieldSpec, TraceLevel
  registry.ts       The catalogue — one array, one line per type
  default/index.ts  The Octopus Hub definition (the only node today)
  store.ts          JSON-on-disk persistence (tempfile → rename)
  serialize.ts      NodeInstance → PublicNode for the UI
  manager.ts        Singleton trigger lifecycle (start / stop / reconcile)
  bootstrap.ts      On-boot: drop orphans, seed default, migrate names
  traces.ts         Per-node ring buffer + EventEmitter (for SSE later)
  webhook.ts        Single source for `/api/hooks/<slug>/<id>` URLs
  theme.ts          Category + status palettes (3D + sidebar read same)
```

### Contract

`NodeDefinition` (in `types.ts`) is one non-generic shape. Every type
author drops a folder under `lib/nodes/<slug>/`, exports a `NodeDefinition`,
and appends one line to `registry.ts`. No per-type branching lives in the
shell, the sidebar, or the graph — every consumer walks the registry.

Runtime configs flow as `Record<string, unknown>` end-to-end (store →
manager → `start()`). Authors narrow inside their `start()` body where
they already own the keys.

### Persistence

`store.ts` reads and writes `{DATA_DIR}/nodes.json` on every call —
disk IS the source of truth. At the scale the install targets, a cache
would only buy bugs when something (a crash mid-save, a concurrent PATCH,
a test) leaves memory and disk out of sync. Writes use tempfile → rename
for atomicity, mode `0o600` to keep secrets off the filesystem for other
users.

Secret fields (those with `type: "text", secret: true` in the definition)
are encrypted at rest via `lib/crypto/vault.ts` and surfaced to the UI as
`{ __set: boolean }` via `serialize.ts`, never the plaintext.

### Lifecycle

`manager.ts` is the one long-lived thing in the app — a `globalThis`-
cached singleton holding `nodeId → StopFn`. The Next runtime's HMR
would otherwise duplicate it on every save.

- `bootstrap()` — called once from `instrumentation.ts` on server boot.
- `start(id)` / `stop(id)` — called by the API routes.
- `isRunning(id)` — read by `serialize.ts` for the UI status dot.

Any trigger whose `start()` throws is traced to `traces.ts` with level
`error`; the node stays visible in the UI so the user can see what
broke.

### Traces

`traces.ts` holds a 500-event ring buffer per node in memory. Two
consumers: the HTTP API (replays the last N on first request) and an
SSE stream subscribing to the EventEmitter. At ~500 B per event that's
<25 MiB resident — acceptable for single-process self-hosted. A
container restart wipes traces by design; users watch events arrive,
they don't audit last week's.

## Auth (unchanged since v0.1.24 + magic link)

`apps/web/src/lib/auth/session.ts` is still the one module that knows
how a session is signed and verified:

- Cookie: `octopus_session`, httpOnly, SameSite=Lax.
- Value: `<b64url(iat)>.<b64url(HMAC-SHA256(iat, key=OCTOPUS_TOKEN))>`.
- Max age: 30 days. Rotating the admin token invalidates every
  outstanding session — no second secret to manage.
- Verification uses Web Crypto, so the same function works in middleware
  (edge runtime) and in route handlers (node runtime).

New in v0.1.39: **magic-link login**. A URL like `.../?token=<admin>`
is validated by middleware in-band; on match, a session cookie is set
and middleware 307s back to the same URL minus `?token`, so the secret
never lingers in the address bar. Rate-limited identically to
`/api/auth/login` (10/min/IP).

```
  visitor ──▶ middleware ─▶ ?token present? ─ yes ─▶ validate + set cookie + strip param
                    │              │
                    │              └── no ─▶ cookie valid? ─ yes ─▶ page
                    │                              │
                    │                              └── no ─▶ /login?redirect=<path>
```

## Visual system

- **`octopus-pixel.ttf`** drives every text surface: the logo, the token
  gate, the sidebar, the 3D node labels. `layout.tsx` loads it via
  `next/font/local`, sets a CSS variable; `NodeGraph.tsx` reads the same
  resolved family via `getComputedStyle(body).fontFamily` so the Three.js
  `SpriteText` renders in the same pixel TTF. No system-font fallback.
- **Colour palette** lives in `lib/nodes/theme.ts`. Category colours
  (Platform / Triggers / Actions / AI) and status colours
  (running / enabled / disabled) — both the 3D mesh and the sidebar dot
  read from this one table.
- **Geometry** (`lib/graph/visual.ts`): hubs are icosahedra, triggers
  octahedra, actions cubes, plain nodes spheres. Every mesh carries a
  white wireframe overlay (scale 1.03 to avoid z-fighting) that makes
  facets read as 3D at any zoom.
- **Grid backdrop** painted by `GraphCanvas` behind the transparent
  WebGL canvas; one CSS `background-image` definition in `visual.ts`.
- **Labels** anchor to the camera's right via an rAF loop in
  `NodeGraph.tsx` that rotates a local-right vector into each node's
  object-space every frame. Constant world-space offset means the badge
  stays readable regardless of which side of the node the camera is on.

## Repo layout

```
apps/web/
  src/
    app/
      (app)/
        layout.tsx            Server component: reads store, feeds AppFrame
        page.tsx              Dashboard — full-bleed 3D graph
      (auth)/login/page.tsx   Login screen
      api/
        auth/{login,logout}/  Session cookie issue + clear
        nodes/                GET list + POST create, PATCH/DELETE by id
      layout.tsx              Loads octopus-pixel.ttf
    components/
      AppFrame.tsx            Wraps children in SelectionProvider
      AppShell.tsx            Persistent sidebar + burger drawer
      NodeTree.tsx            Categorised list of tiles
      NodeTile.tsx            One collapsible row per node instance
      SelectionContext.tsx    Selection + server-fetched node list
      GraphCanvas.tsx         Grid backdrop + NodeGraphLoader
      NodeGraphLoader.tsx     ssr:false dynamic import of NodeGraph
      NodeGraph.tsx           3D force graph, rAF rotate + label anchor
      Logo.tsx                Reusable wordmark + version label
      TokenGate.tsx           POSTs /api/auth/login, redirects on ok
      LogoutButton.tsx        POSTs /api/auth/logout
    lib/
      auth/{config,session,rateLimit}.ts      Auth protocol — one source
      nodes/*                                 Node platform — see above
      graph/visual.ts                         3D geometry + palette reads
      graph/forceGraph.ts                     Typed factory for 3d-force-graph
      crypto/vault.ts                         AES-GCM with OCTOPUS_TOKEN-derived key
    instrumentation.ts + instrumentation.node.ts
                                Next hook — runs manager.bootstrap() on boot
    middleware.ts               Single auth gate + magic-link handler

installer/                (unchanged since v0.1.24)
  cmd/octopus/
  internal/{caddy,commands,docker,source,state,stack,token,wizard,selfupdate}

.github/workflows/
  ci.yml                    lint / typecheck / build / vet on every PR
  tag.yml                   mobile-friendly "cut a tag" button
  release.yml               goreleaser: six binaries + checksums.txt
  pages.yml                 docs/pages/ → GitHub Pages
```

## Release history since v0.1.24

| Tag | What the user notices |
| --- | --- |
| v0.1.25 | middleware no longer skipping root path under basePath |
| v0.1.26 | middleware redirects preserve basePath |
| v0.1.27 | responsive AppShell — sidebar on desktop, burger on mobile |
| v0.1.28 | first no-code platform pass (nodes + traces + a Telegram trigger) |
| v0.1.29 | 3D node graph on the dashboard |
| v0.1.30 | graph refactor — state leak / delete / single source |
| v0.1.31 | stripped back to one default node + side-panel UX |
| v0.1.32 | boot drops orphans before seeding |
| v0.1.33 | Octopus Hub in the sidebar, no settings panel |
| v0.1.34 | categorised tree + camera-focus on tile click |
| v0.1.35 | octopus-pixel everywhere, single font source |
| v0.1.36 | 3D labels join the pixel font, no duplicate tooltip |
| v0.1.37 | labels always on camera-right at constant offset |
| v0.1.38 | grid backdrop behind the 3D canvas |
| v0.1.39 | magic-link login via `?token=` query param |
| v0.1.40 | 1px white frame around the canvas (reverted in v0.1.41) |
| v0.1.41 | wireframe edges on node meshes |
| v0.1.42 | audit cleanup — no visible change, type safety tightened |

## Gaps / known follow-ups

- **Only one node type ships.** The contract and every consumer
  (registry, manager, traces, sidebar, graph) are built for many —
  adding Telegram / Stripe / GitHub is a one-file drop.
- **`/api/hooks/*`** has a URL builder (`webhook.ts`) and is already
  carved out of the middleware matcher's comment, but no route handler
  exists yet. It lands with the first node type that sets
  `webhookPathSlug`.
- **`packages/`** declared in `pnpm-workspace.yaml` but does not exist.
  Reserved for shared libs.
- **No test suite** on either side (`apps/web` or `installer/`). CI runs
  static checks only (lint / typecheck / vet / build).
- **Source tarball integrity** still rides on GitHub TLS alone; the CLI
  binary has defence-in-depth via checksums.txt but the source does not.
- **No `octopus logs` command** — users still need to know about
  `docker logs octopus-web`.

## Toolchain

- pnpm 9.12.0 (via corepack), Node >=20.11.0.
- TypeScript 5.6, Next 14.2, React 18, Tailwind 3.4.
- Three 0.180 + 3d-force-graph 1.76 + three-spritetext 1.9.
- Go — stdlib only, no third-party deps.
- Docker on the host at runtime (installer will install it if missing).
