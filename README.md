# Octopus

Self-hosted. One-command install. Runs under Docker on your machine — no
hosted control plane, no account, no data leaves the host.

## Install

**Linux / macOS**

```sh
curl -fsSL https://mk-amorson.github.io/Octopus/install | sh
```

**Windows (PowerShell)**

```powershell
iwr -useb https://mk-amorson.github.io/Octopus/install.ps1 | iex
```

Both one-liners download the `octopus` CLI, add `~/.octopus/bin` (or
`%LOCALAPPDATA%\Octopus\bin`) to your PATH, and run `octopus install`. The
installer asks three questions — bind address, subpath, port — then builds
and starts the app under Docker.

Prerequisite: Docker must be installed and running (Docker Desktop on
macOS/Windows, Docker Engine on Linux). The installer checks and fails
clearly if it isn't.

## Commands

```
octopus install      interactive install (choose host / subpath / port)
octopus start        start the local stack if it was stopped
octopus stop         stop the local stack (state kept)
octopus status       show whether Octopus is running and its URL
octopus update       upgrade the app to the latest GitHub release
octopus uninstall    remove the container, image, and all local state
```

`octopus update` checks GitHub for a newer tag and, if there is one,
re-downloads the source, rebuilds the Docker image, and restarts the
container. Updating the `octopus` CLI itself is done by re-running the
install one-liner — the new binary replaces the old.

## Defaults

- Subpath: `/octopus` — override during install, or press Enter to accept,
  or type `/` to serve at the site root.
- Bind: `127.0.0.1` (localhost only) — choose option 2 in the wizard to
  bind `0.0.0.0` if you want to reach it from your LAN or put a reverse
  proxy in front of it.
- Port: `3000`.

All three live in `~/.octopus/config.json` and are re-asked (with your
last choice as the default) on every `octopus install`.

## Repository layout

- `apps/web` — the Next.js 14 landing page the installer actually ships.
- `installer/` — Go CLI (`cmd/octopus`) + internals. `go build ./...` works
  standalone; no external dependencies.
- `docs/pages/` — content served by GitHub Pages at
  `mk-amorson.github.io/Octopus` (the `install` / `install.ps1` shims and
  the landing page).
- `.github/workflows/release.yml` — goreleaser on tag push; builds six
  binaries and `checksums.txt`, attaches them to the GitHub Release.
- `.github/workflows/pages.yml` — publishes `docs/pages/`.

See `CLAUDE.md` for a deeper architecture walkthrough.

## Releasing

1. Bump `installer/internal/version/version.go` if you want the `-dev`
   default to match the upcoming tag (not required — `-X` overrides it).
2. Tag and push:

   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```

3. The `Release` workflow builds binaries, uploads them with a
   `checksums.txt`, and creates the GitHub Release automatically. The
   bootstrap shims find it via the `/releases/latest` redirect.

## Status

`v0.1.0` — first cut. Ships a single-page landing app behind a configurable
Next.js basePath. Future work lives in `docs/superpowers/specs/`.
