# Octopus — Status

_Snapshot as of 2026-04-21 (v0.1.23)._

## What this project is

A single-user, self-hosted web app with a one-command installer. Users run
`curl | sh` (or the PowerShell equivalent), the installer downloads the
source tarball for the latest GitHub release, builds it under Docker, and
starts it on their own machine. No hosted control plane, no account, no
telemetry.

Two products ship together under the same `vX.Y.Z` tag:

- `apps/web` — the Next.js 14 App Router frontend users see.
- `installer/` — the Go CLI (`octopus`) that manages the app's lifecycle.

## Current release: v0.1.23

Active feature track is the **TokenGate**: a single-input admin gate shown
under the logo on the landing page. The server holds the expected token in
`OCTOPUS_TOKEN` (injected into the container by the installer) and
compares it in constant time via `node:crypto.timingSafeEqual`. Client
never sees the expected value.

Recent releases (v0.1.14 → v0.1.23) have all been TokenGate iterations:
mint-on-upgrade, base-path prefix fix, single-input redesign, em-scoped
geometry, retry/success lock, overlay alignment, and pixel-width fixes.

## Repo layout

```
apps/web/              Next.js 14 + React 18 + Tailwind
  src/app/             App Router routes
    api/verify-token/  Constant-time token check
    page.tsx           Landing: <Logo> + <TokenGate>
    layout.tsx         Loads octopus-pixel.ttf via next/font/local
  src/components/      Logo, TokenGate
  Dockerfile           Standalone Next build, bakes basePath + version
docs/pages/            Bootstrap shims + landing, served via GitHub Pages
  install              curl | sh shim (Linux/macOS)
  install.ps1          iwr | iex shim (Windows)
installer/             Go module, stdlib only (go.sum stays empty on purpose)
  cmd/octopus/         Entry point
  internal/commands/   install, lifecycle, update, uninstall, token
  internal/{docker,caddy,source,selfupdate,stack,state,token,wizard,version}/
.github/
  workflows/tag.yml     Mobile-friendly "cut a tag" button → dispatches release
  workflows/release.yml goreleaser: linux/darwin/windows × amd64/arm64
  workflows/pages.yml   Publishes docs/pages/ to GitHub Pages
  RELEASE_VERSION       Auto-release trigger file (v0.1.23)
```

## Release pipeline

1. `tag.yml` creates + pushes a git tag on `main`, then dispatches
   `release.yml` against it.
2. `release.yml` runs goreleaser to build six binaries + `checksums.txt`
   and attaches them to a GitHub Release.
3. `pages.yml` publishes `docs/pages/` on every push to `main` that
   touches that directory.
4. Bootstrap shims resolve the latest tag via the `/releases/latest` HTML
   redirect (no API rate limits), download + SHA256-verify the matching
   binary, drop it in `~/.octopus/bin` (or `%LOCALAPPDATA%\Octopus\bin`),
   and `exec octopus install` with stdin wired to `/dev/tty`.

## Notable architecture decisions

- **One install per user** keyed off `~/.octopus` (`%USERPROFILE%\.octopus`
  on Windows).
- **Source-tarball flow.** Installer pulls
  `https://codeload.github.com/<repo>/tar.gz/refs/tags/vX.Y.Z` and builds
  locally so the user's chosen subpath can be baked into the build
  (`OCTOPUS_BASE_PATH` → Next's `basePath`).
- **`octopus update`** is the single upgrade command. If the CLI itself is
  out of date, `selfupdate` SHA256-verifies + atomically replaces the
  running binary and `syscall.Exec`s into it; then the new CLI rebuilds
  the app.
- **Docker compose project = `octopus`**, container = `octopus-web`. Every
  call pins `-p octopus`, so `octopus uninstall` wipes everything.
- **Domain → Caddy** (Linux only). Wizard domain answer → Caddyfile
  `reverse_proxy 127.0.0.1:<port>` + LE TLS on first request. Mac/Windows
  skip the domain question.
- **Installer uses stdlib only.** `go.sum` stays empty on purpose — trivial
  release audit.

## Gaps / known follow-ups

- **No test suite** on either side (`apps/web` or `installer/`).
- **`packages/`** directory is declared in `pnpm-workspace.yaml` but does
  not exist yet — reserved for shared libs.
- Landing page is a single route; no multi-page app yet.
- TokenGate only gates the landing page. There is no admin area behind it
  to access once the token matches — "ok" is currently a dead end.

## Toolchain

- pnpm 9.12.0 (via corepack), Node >=20.11.0.
- Go — stdlib only, no third-party deps.
- Docker on the host at runtime (installer will install it if missing).
