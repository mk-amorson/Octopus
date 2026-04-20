# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

This is the **private product repo** for Octopus, a commercial self-hosted web app. The code here never ships to end users directly — it only exits the repo as a compiled, minified Docker image published to GitHub Container Registry.

End users interact with two public surfaces that live in *other* repos:

- **`mk-amorson/octopus-installer`** (public) — the `octopus` Go CLI (`install`, `start`, `stop`, `status`, `update`, `uninstall`) plus the `curl | sh` / PowerShell bootstrap served from GitHub Pages. The installer pulls the product image from GHCR, renders a `docker-compose.yml` into the user's state dir, and runs it locally under Docker.
- **`ghcr.io/mk-amorson/octopus-web`** (public package) — the compiled product. Built by this repo's `build-image.yml` workflow.

Keeping the product repo private is what enables a commercial sale: customers get a runnable image, not the source. The installer and its hosting (Pages) stay public because they need to be — free hosting and public auditability.

## Commands

Run from the repo root. Package manager is pnpm 9.12.0 (enforced via `packageManager` in `package.json` and `corepack` in the Dockerfile); Node >=20.11.0.

- `pnpm install` — install workspace deps.
- `pnpm dev` — run the web app on `http://localhost:3000`.
- `pnpm build` — production Next.js build (`output: "standalone"`).
- `pnpm start` — run the built server on `0.0.0.0:3000`.
- `pnpm lint` — `next lint` on `apps/web`.
- `pnpm typecheck` — `tsc --noEmit` across the workspace.

No test runner wired up yet. Use pnpm filters to target a single workspace, e.g. `pnpm --filter @octopus/web build`.

## Architecture

### Monorepo layout

pnpm workspace defined in `pnpm-workspace.yaml`:

- `apps/*` — deployable applications. Only `apps/web` today.
- `packages/*` — shared libraries. Directory doesn't exist yet; create it before adding the first shared package.

TypeScript config is layered: `tsconfig.base.json` at the root sets strict options (`noUncheckedIndexedAccess`, `noImplicitOverride`); each package extends it. The web app adds `@/*` → `./src/*`.

### Web app (`apps/web`)

Next.js 14 App Router + React 18 + Tailwind. Today it is a single-page landing site that renders "Octopus" in a bundled pixel font (`basis33`).

- `src/app/layout.tsx` loads `basis33.ttf` via `next/font/local` and exposes it as the `--font-basis33` CSS var → `font-basis33` Tailwind utility. `globals.css` disables font smoothing for that class.
- `next.config.mjs` reads `OCTOPUS_BASE_PATH` at build time and feeds it into `basePath`. Default `""`.
- `next.config.mjs` also sets `output: "standalone"` and points `experimental.outputFileTracingRoot` at the monorepo root so the standalone bundle captures the correct slice of root `node_modules`. **Do not remove** — the Dockerfile depends on the output path `apps/web/server.js`.
- Dark theme is baked in via `color-scheme: dark` and hard-coded black/white in `globals.css`.

### Image build (`apps/web/Dockerfile`)

Three-stage (`deps` → `builder` → `runner`). The builder stage accepts `OCTOPUS_BASE_PATH` as a build arg; the default is `/octopus`, matching what the installer expects consumers to get. The runner stage is `node:20-alpine` running as a non-root user.

The published image is built multi-arch (amd64 + arm64) by GitHub Actions — don't rely on local single-arch builds for anything you push.

### Release pipeline

`.github/workflows/build-image.yml` is the only release path. Triggers:

- Push of a tag matching `v*` → builds and pushes `ghcr.io/<owner>/octopus-web` tagged with `<tag>`, `<major>.<minor>`, and `latest`.
- Manual `workflow_dispatch` → builds with the given tag, or the commit SHA if blank. Useful for pushing a one-off image for debugging without minting a version.

**First-time setup** (once per repo lifetime): after the first successful push, manually set the package visibility to Public at `github.com/users/<owner>/packages/container/octopus-web/settings`. Private GHCR packages require auth for `docker pull` — the installer uses anonymous pulls, so the package must be public.

The workflow uses GHA build cache (`type=gha`) so incremental builds stay fast.

### basePath policy

The public image is baked with `basePath=/octopus`. This is deliberate: Next.js `basePath` is build-time, so supporting arbitrary subpaths would either mean (a) shipping a matrix of image tags, or (b) making customers rebuild the image locally, which defeats the point of a closed-source product. If a customer needs a different path, the supported answer is "put a reverse proxy in front of it".

### Relation to the public installer repo

The installer (in the companion public repo) expects to find the image at `ghcr.io/mk-amorson/octopus-web:<version>` for whatever version it's pinned to. When you cut a new `v*` tag here, also cut a matching `v*` tag in the installer repo so `octopus update` on end-user machines picks up the new product image. The two versions **must stay in sync** — the installer encodes that assumption.

### History

Earlier revisions of this repo had:
- An `amorson.me` VPS auto-deploy via `.github/workflows/deploy.yml` and `scripts/server-deploy.sh` (removed).
- A monorepo version with `installer/` and `docs/pages/` inside this same private repo (moved out to `mk-amorson/octopus-installer` so GitHub Pages can serve from a public repo on the free tier).

Don't re-introduce either pattern without explicit direction — the product's commercial model depends on the current split.
