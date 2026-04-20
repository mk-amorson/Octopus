# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Octopus is a self-hosted app distributed as a cross-platform CLI installer. It has no hosted control plane. A user runs one `curl | sh` (or PowerShell equivalent) on their own machine; the installer fetches the source tarball for the latest GitHub release, builds the web app under Docker, and runs it locally. There is no remote/server install mode — if a user wants `amorson.me` in front of their instance they set up their own reverse proxy to the bound port.

The repo has two products:

- **The app** — `apps/web`, a Next.js 14 landing page that gets shipped to end users.
- **The installer** — `installer/`, a Go CLI (`octopus`) that manages the app's lifecycle on the end user's machine.

Both are released together under the same version tag (`v0.1.0`, etc). The installer's own version is the version of the app it installs — they do not drift.

## Commands

### Web app (`apps/web`)

Run from the repo root. Package manager is pnpm 9.12.0 (enforced via `packageManager` in `package.json` and `corepack` in the Dockerfile); Node >=20.11.0.

- `pnpm install` — install workspace deps.
- `pnpm dev` — run the web app on `http://localhost:3000` (proxied to `@octopus/web`).
- `pnpm build` — production Next.js build (`output: "standalone"`).
- `pnpm start` — run the built server on `0.0.0.0:3000`.
- `pnpm lint` — `next lint` on `apps/web`.
- `pnpm typecheck` — `tsc --noEmit` across the whole workspace (`pnpm -r`).

No test runner is configured yet. To target a single workspace, use pnpm filters, e.g. `pnpm --filter @octopus/web build`.

### Installer (`installer/`)

Run from `installer/`. Zero external Go dependencies — stdlib only.

- `go build ./...` — compile the CLI and all internal packages.
- `go vet ./...` — static checks.
- `go build -o /tmp/octopus ./cmd/octopus && /tmp/octopus help` — smoke test.
- `go build -ldflags "-X github.com/mk-amorson/Octopus/installer/internal/version.Current=vX.Y.Z" -o /tmp/octopus ./cmd/octopus` — build with a specific version baked in (mirrors what goreleaser does).

There is no test suite for the installer yet either.

## Architecture

### Monorepo layout

pnpm workspace defined in `pnpm-workspace.yaml`:

- `apps/*` — deployable applications. Currently only `apps/web`.
- `packages/*` — shared libraries. **Directory does not exist yet**; create it before adding the first shared package.
- `installer/` — Go module, **not** part of the pnpm workspace. Kept as a sibling tree so goreleaser can run `workdir: installer` without pulling Node tooling.

TypeScript config is layered: `tsconfig.base.json` at the repo root defines strict settings (including `noUncheckedIndexedAccess` and `noImplicitOverride`); each package extends it. The web app adds the `@/*` → `./src/*` path alias.

### Web app (`apps/web`)

Next.js 14 App Router + React 18 + Tailwind. Today it is a single-page landing site that renders "Octopus" in a bundled pixel font (`basis33`). Key conventions:

- `src/app/layout.tsx` loads `octopus-pixel.ttf` via `next/font/local` and exposes it as the `--font-octopus-pixel` CSS var → `font-pixel` Tailwind utility. `globals.css` disables font smoothing for that class to keep the pixel font crisp. `octopus-pixel.ttf` is a derivative of `basis33.ttf` (MIT) — letters are proportional with exactly one "pixel" (192 font-units) of horizontal gap; digits stay monospace.
- `next.config.mjs` reads `OCTOPUS_BASE_PATH` at build time and feeds it into Next's `basePath`. The installer passes this value via `--build-arg OCTOPUS_BASE_PATH=...` when it runs `docker compose build`. Default is `""` (site root). The installer also passes `OCTOPUS_VERSION`, which is baked in as `NEXT_PUBLIC_OCTOPUS_VERSION` and shown under the logo so users can see which release they're on.
- `next.config.mjs` also sets `output: "standalone"` and points `experimental.outputFileTracingRoot` at the monorepo root so the standalone bundle captures the correct slice of root `node_modules`. **Do not remove** — the Dockerfile depends on the path `apps/web/server.js`.
- Dark theme is baked in via `color-scheme: dark` and hard-coded black/white in `globals.css`.

### Installer (`installer/`)

Go module `github.com/mk-amorson/Octopus/installer`. Layout:

```
cmd/octopus/main.go                Tiny switch over os.Args[1]; no cobra/flag magic.
internal/version/version.go        Version string; overridden at release time via -ldflags -X.
internal/state/state.go            ~/.octopus layout, config.json schema, paths.
internal/docker/docker.go          Ensure(), Run(), Compose() helpers.
internal/source/source.go          Downloads GitHub codeload tarball + resolves LatestTag.
internal/wizard/wizard.go          stdin prompts for host / subpath / port.
internal/stack/stack.go            Renders docker-compose.octopus.yml, wraps build/up/down.
internal/commands/install.go       install flow: docker check → wizard → download → build → up → save.
internal/commands/lifecycle.go     start, stop, status.
internal/commands/update.go        Compares version.Current to latest tag; rebuilds if newer.
internal/commands/uninstall.go     down -v + image rm + RemoveAll state dir.
```

Design choices worth knowing:

- **One install per user**, keyed off `~/.octopus`. Same on Linux, macOS, Windows (Windows actually uses `%USERPROFILE%\.octopus` via `os.UserHomeDir`).
- **Source-tarball flow, not pre-built image.** The installer pulls `https://codeload.github.com/mk-amorson/Octopus/tar.gz/refs/tags/vX.Y.Z` and builds the Docker image locally. This is what lets `/octopus` (or any custom subpath) be baked into the build without shipping a matrix of pre-built images.
- **Docker compose project name is `octopus`** and the single container is `octopus-web` (see `state.ComposeProject` / `state.ContainerName`). Every compose call pins `-p octopus`, so the installer's containers/networks/volumes stay in one namespace and can be wiped cleanly.
- **Rendered compose file is `docker-compose.octopus.yml` inside the extracted source tree.** It is overwritten on every install/update — never hand-edit it.
- **No third-party Go deps** (go.sum is empty). Keep it that way unless there's a real reason; it makes release auditing trivial.

### Release pipeline

Two workflows drive distribution:

1. `.github/workflows/release.yml` runs on any `v*` tag push. It invokes goreleaser in `installer/` (config at `installer/.goreleaser.yaml`). goreleaser builds six binaries (linux/darwin/windows × amd64/arm64), writes `checksums.txt`, and attaches them to a GitHub Release named after the tag. The `-X .../version.Current={{ .Tag }}` ldflag is what makes the shipped binary report its version.
2. `.github/workflows/pages.yml` publishes `docs/pages/` to GitHub Pages on pushes to `main` that touch that directory. The site serves:
   - `install` (shell shim) at `https://mk-amorson.github.io/Octopus/install`
   - `install.ps1` at `https://mk-amorson.github.io/Octopus/install.ps1`
   - `index.html` at the root.

The bootstrap shims know only one repo name (hardcoded `mk-amorson/Octopus`), resolve the latest release tag by following the `/releases/latest` HTML redirect, download the matching binary + `checksums.txt`, verify SHA256, drop the binary in `~/.octopus/bin` (or `%LOCALAPPDATA%\Octopus\bin`), add it to PATH, and exec `octopus install`.

### Legacy pipeline (removed)

Before v0.1.0 this repo had a GitHub-Actions-driven auto-deploy to a VPS at `amorson.me` (`.github/workflows/deploy.yml`, `scripts/server-deploy.sh`, `ops/Caddyfile`, `ops/docker-compose.yml`). All of that is gone. `amorson.me` is no longer connected to this project — the domain belongs to the maintainer for personal use. Do not re-introduce server-side deploy code without explicit direction.

### In-flight design

`docs/superpowers/specs/2026-04-20-installer-design.md` was the original design doc. The implemented MVP (this codebase) diverges from the spec in three ways on purpose:
- **No bubbletea TUI** — plain stdin prompts are enough for three questions.
- **No server/SSH mode** — local-only by user request; remote users set up their own reverse proxy.
- **No embedded tarball** — the installer downloads from `codeload.github.com` at install time rather than embedding the source in the binary.

Treat the spec as historical context; the code is the source of truth.
