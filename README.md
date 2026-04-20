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

### Docker

The installer needs Docker. If it isn't already on the machine, the
installer offers to install it for you:

- **Linux** — runs the official `get.docker.com` script via `sudo` after
  your confirmation.
- **macOS** — uses `brew install --cask docker` when Homebrew is present,
  otherwise opens the Docker Desktop download page. You launch Docker
  Desktop once to accept the TOS, then re-run `octopus install`.
- **Windows** — uses `winget install Docker.DockerDesktop` when winget is
  present, otherwise opens the Docker Desktop download page. Same re-run
  flow as macOS.

If you'd rather install Docker yourself, just do so before running the
one-liner and the installer will skip the prompt.

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
- `.github/workflows/tag.yml` — mobile-friendly "Run workflow" button that
  creates a release tag without needing a local clone.

See `CLAUDE.md` for a deeper architecture walkthrough.

## Releasing

From any browser (no local clone needed):

1. Open https://github.com/mk-amorson/Octopus/actions/workflows/tag.yml
2. Click **Run workflow**, type the version (e.g. `v0.1.0`), submit.
3. `tag.yml` creates the tag, which triggers `release.yml` — goreleaser
   builds six binaries + `checksums.txt` and attaches them to a new GitHub
   Release.

From a local clone:

```sh
git tag v0.1.0
git push origin v0.1.0
```

## Status

`v0.1.0` — first cut. Ships a single-page landing app behind a configurable
Next.js basePath. Future work lives in `docs/superpowers/specs/`.
