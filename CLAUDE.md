# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root. Package manager is pnpm 9.12.0 (enforced via `packageManager` in `package.json` and `corepack` in the Dockerfile); Node >=20.11.0.

- `pnpm install` — install workspace deps.
- `pnpm dev` — run the web app on `http://localhost:3000` (proxied to `@octopus/web`).
- `pnpm build` — production Next.js build (uses `output: "standalone"`).
- `pnpm start` — run the built server on `0.0.0.0:3000`.
- `pnpm lint` — `next lint` on `apps/web`.
- `pnpm typecheck` — `tsc --noEmit` across the whole workspace (`pnpm -r`).

There is no test runner configured yet.

To work inside a single workspace package directly, use pnpm filters, e.g. `pnpm --filter @octopus/web build`. The root scripts are thin wrappers around these filters.

## Architecture

### Monorepo layout

pnpm workspace defined in `pnpm-workspace.yaml`:

- `apps/*` — deployable applications. Currently only `apps/web`.
- `packages/*` — shared libraries. **Directory does not exist yet**; create it before adding the first shared package.

TypeScript config is layered: `tsconfig.base.json` at the root defines strict settings (including `noUncheckedIndexedAccess` and `noImplicitOverride`); each package extends it. The web app also adds the `@/*` → `./src/*` path alias.

### Web app (`apps/web`)

Next.js 14 App Router + React 18 + Tailwind. Today it is a single-page landing site that renders "Octopus" in a bundled pixel font (`basis33`). Key conventions:

- `src/app/layout.tsx` loads `basis33.ttf` via `next/font/local` and exposes it as the `--font-basis33` CSS var → `font-basis33` Tailwind utility. `globals.css` disables font smoothing for that class to keep the pixel font crisp.
- `next.config.mjs` sets `output: "standalone"` and points `experimental.outputFileTracingRoot` at the monorepo root so the standalone bundle captures the correct slice of root `node_modules`. Do not remove this — the Dockerfile depends on it.
- Dark theme is baked in via `color-scheme: dark` and hard-coded black/white in `globals.css`.

### Deploy pipeline

Production is a single VPS serving `amorson.me`. There is no staging.

1. `.github/workflows/deploy.yml` runs on every push to `main` (and manual dispatch). It validates secrets, wipes the remote deploy path (`/opt/octopus` by default, preserving only `ops/.env`), scps the repo, and runs `scripts/server-deploy.sh` over SSH.
2. `scripts/server-deploy.sh` is idempotent: installs Caddy + Docker if missing, syncs `ops/Caddyfile` to `/etc/caddy/Caddyfile`, opens ufw 80/443 if active, then `docker compose build && up -d` the `web` service. It **restarts Caddy every deploy** on purpose — that clears in-memory ACME backoff so cert issuance retries from scratch. Ends with a diagnostics dump (caddy status, compose ps, listening ports, logs, self-curl).
3. `ops/docker-compose.yml` builds `apps/web/Dockerfile` with the **repo root as build context** (so the Dockerfile can read the workspace manifests) and binds container port 3000 to `127.0.0.1:3000` only. Caddy on the host terminates TLS and reverse-proxies in.
4. `ops/Caddyfile` is the full reverse-proxy config: auto-HTTPS via Let's Encrypt for `amorson.me` → `127.0.0.1:3000`.
5. `apps/web/Dockerfile` is a 3-stage build (`deps` → `builder` → `runner`). The runner stage copies `.next/standalone`, `.next/static`, and `public` into place and runs `node apps/web/server.js` as a non-root user. When touching this file, remember the standalone output path is `apps/web/server.js` inside the container because of the `outputFileTracingRoot` setting above.

### Secrets

- `ops/.env` on the server holds runtime secrets; the deploy workflow explicitly preserves it when wiping the deploy path. `ops/.env.example` is the committed template (currently empty — the landing page has no runtime secrets).
- `apps/web/.env.local` for local dev overrides; `apps/web/.env.example` is the template.
- Deploy-time secrets (`DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PASSWORD` or `DEPLOY_SSH_KEY`, optional `DEPLOY_SSH_KEY_PASSPHRASE`) live in the GitHub `production` environment. `DEPLOY_PATH` and `DEPLOY_PORT` are variables, not secrets.

### In-flight design

`docs/superpowers/specs/2026-04-20-installer-design.md` is a **draft spec** (status "awaiting user approval") for a cross-platform Go CLI installer that would replace the current GitHub-Actions-driven pipeline with a user-run `octopus install` wizard. None of the `installer/` tree described in that spec exists yet. Treat the spec as design intent, not implemented code — if work on the installer is requested, confirm scope against the spec before changing the existing deploy pipeline.
