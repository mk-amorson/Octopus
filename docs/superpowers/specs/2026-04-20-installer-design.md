# Octopus Installer — Design

Status: draft — awaiting user approval
Date: 2026-04-20
Scope: a cross-platform CLI installer that deploys Octopus to the user's own machine (`Local` mode) or to their own server (`Server` mode). Replaces the GitHub-Actions-driven auto-deploy pipeline. No hosted multi-tenant component — every install is a self-hosted instance.

## 1. Goals

1. **One-command install.** Any user, on Linux / macOS / Windows, can run a single shell/PowerShell line and reach a working Octopus instance.
2. **Same installer for local and remote.** Same binary, same wizard, same contract — the only difference is where the Docker stack runs (here vs over SSH).
3. **No hard-coded environment assumptions.** The installer must not assume ownership of a server, a domain, ports 80/443, or a reverse proxy. It must integrate with what is already there or stay out of its way.
4. **Version-locked deliverable.** Installer `vX.Y.Z` always installs Octopus `vX.Y.Z` — no drift between installer code and app code.
5. **Reproducible, offline-capable install.** Once the installer is downloaded, it must be able to install without network except for pulling Docker base images. No git clone required on the target, no "download source at install time."

## 2. Non-goals (v0.1)

- Self-update of installed Octopus instances (`octopus upgrade` on the target). v0.1 ships "uninstall + reinstall."
- Multi-tenant control plane / license keys / billing.
- Windows Server support. Target Windows 10/11 (user workstations).
- Non-systemd Linux distros (init.d, OpenRC, s6). Debian/Ubuntu, RHEL/Fedora, Arch — all systemd.
- Non-Docker local runtimes (bare Node, Podman, nerdctl). Docker only.

These become roadmap items, not v0.1 requirements.

## 3. Distribution

### 3.1 Bootstrap scripts (GitHub Pages)

A tiny shim lives at a stable, public URL so the one-liner is readable:

```
Linux/macOS:  curl -fsSL https://mk-amorson.github.io/Octopus/install    | sh
Windows:      iwr -useb          https://mk-amorson.github.io/Octopus/install.ps1 | iex
```

The shim does exactly three things:

1. Detect `OS` (`linux`/`darwin`/`windows`) and `ARCH` (`amd64`/`arm64`). Fail with a clear message on unsupported combos.
2. Query `https://api.github.com/repos/mk-amorson/Octopus/releases/latest` for the newest tag. A `--version X` flag lets users pin.
3. Download `octopus-installer_<os>_<arch>[.exe]` from that release, verify the SHA256 checksum against the release's `checksums.txt` (also signed with Sigstore cosign, verified if `cosign` is on PATH; optional), mark executable, `exec` it.

The shim is the *only* part of the system hosted on GitHub Pages. GitHub Pages serves static files over HTTPS for free. No app logic.

### 3.2 Binaries (GitHub Releases)

For each tag `vX.Y.Z`, the release contains:

- `octopus-installer_linux_amd64`
- `octopus-installer_linux_arm64`
- `octopus-installer_darwin_amd64`
- `octopus-installer_darwin_arm64`
- `octopus-installer_windows_amd64.exe`
- `octopus-installer_windows_arm64.exe`
- `checksums.txt` + `checksums.txt.sig` (cosign keyless, optional verify)

Built by `goreleaser` on tag push (CI described in §15).

### 3.3 Why not amorson.me for bootstrap

`amorson.me` is the user's own production instance. If bootstrap hosting lived there, every Octopus user would depend on one unmaintained VPS. GitHub Pages removes that single point of failure and is free.

## 4. Installer architecture

### 4.1 Module layout

```
installer/
├── cmd/octopus/main.go               Tiny entrypoint. Parses flags, starts wizard.
├── internal/
│   ├── wizard/                       Bubbletea models — one per step, composed.
│   │   ├── app.go                    Top-level model (holds shared state).
│   │   ├── mode.go                   Local vs Server picker.
│   │   ├── input_host.go
│   │   ├── input_auth.go             Password / key file / agent
│   │   ├── input_path.go             Sub-path name, default "octopus"
│   │   ├── input_domain.go           Optional
│   │   ├── confirm.go                Summary before execution
│   │   ├── progress.go               Progress view, streams events from executor
│   │   └── done.go
│   ├── executor/                     Orchestrates the actual install.
│   │   ├── executor.go               Interface + event stream to wizard
│   │   ├── local.go                  Implements for local Docker
│   │   └── server.go                 Implements for remote (wraps ssh.Client)
│   ├── docker/                       "Is docker here? Can I install it?"
│   │   ├── detector.go
│   │   ├── installer_linux.go        get.docker.com via Shell
│   │   └── installer_manual.go       Windows / macOS → print docs URL
│   ├── proxy/                        Reverse-proxy adapter.
│   │   ├── detector.go               Finds caddy/nginx/apache/none
│   │   ├── caddy.go                  Native integration
│   │   ├── nginx.go                  Snippet-only mode
│   │   ├── apache.go                 Snippet-only mode
│   │   └── none.go                   Installs Caddy ourselves
│   ├── stack/                        The app stack we ship.
│   │   ├── embed.go                  go:embed of app tarball + templates
│   │   ├── render.go                 Renders .env + compose from wizard state
│   │   └── verify.go                 Curls the endpoint after start
│   ├── ssh/
│   │   ├── client.go                 Wraps golang.org/x/crypto/ssh
│   │   ├── auth.go                   Password / key / agent / known_hosts TOFU
│   │   └── sftp.go                   File upload
│   ├── hostfs/                       Cross-platform paths (local mode).
│   ├── version/
│   │   └── version.go                -ldflags "-X ..."
│   └── config/                       ~/.octopus/config.json — remembers last install.
└── go.mod
```

Each package has a single responsibility. Packages talk through interfaces (e.g. `executor.Executor`, `proxy.Adapter`, `docker.Installer`) so tests mock at the boundary. No package imports another `internal/` package cyclically.

### 4.2 Why Bubbletea

- Native TUI for Go. Event-driven Elm architecture = testable (send a `tea.Msg`, assert on the returned model).
- First-class on Windows — renders through `termenv`, which handles the conhost/Windows Terminal split.
- Composable: one model per step, top-level model dispatches between them.

### 4.3 Language / toolchain

- Go 1.23+.
- Single static binary per OS/arch (no CGo dependencies).
- `goreleaser` for release builds.
- `cosign` keyless for checksum signing (optional verification — we don't want to hard-fail installs if cosign isn't on PATH).

## 5. Wizard flow

Both modes share the same top-level model and reuse the same input steps where they overlap. Each step is its own `tea.Model`. The top-level model holds a shared `State` struct that every step reads/writes.

### 5.1 Local mode

```
Welcome
  → Mode picker: [Local] Server
  → Path name  (default "octopus", validator: /[a-z0-9-]+/)
  → Port       (default 3000, validator: 1-65535, not in use locally)
  → Confirm
  → Progress:
      · detect docker
      · if missing & linux  → offer install via get.docker.com
      · if missing & win/mac → show docs URL, exit
      · write ~/.octopus/stack/{docker-compose.yml, .env, app.tar.gz}
      · docker compose up -d --build
      · curl localhost:<port>/<path> — expect Octopus HTML
  → Done: "Open http://localhost:<port>/<path>"
```

### 5.2 Server mode

```
Welcome
  → Mode picker: Local [Server]
  → Host           (IP or FQDN)
  → SSH port       (default 22)
  → User           (default "root")
  → Auth method: [Password] [Key file] [SSH agent]
      - Password: prompt, never echoed, wiped after use
      - Key file: path + optional passphrase
      - Agent:   use SSH_AUTH_SOCK
  → TOFU known-hosts confirm: show fingerprint, Y/N
  → Path name      (default "octopus")
  → Domain         (optional, Enter to skip)
  → Confirm
  → Progress:
      · SSH dial & verify sudo/root
      · Detect docker — install via get.docker.com if missing
      · Detect reverse proxy  (caddy / nginx / apache / none)
      · Path collision probe   — curl http(s)://<host>/<path>
      · SFTP stack to /opt/octopus/stack
      · docker compose up -d --build
      · Configure proxy (see §7)
      · Verify endpoint
  → Done: "Open https://<domain>/<path>" or "http://<host>:<port>/<path>"
```

### 5.3 Non-interactive mode

For CI and scripted installs:

```
octopus install --mode=server --host=... --user=root --auth=password --path=octopus --domain=... --non-interactive
```

Reads `OCTOPUS_SSH_PASSWORD` from env when `--auth=password` to keep secrets off argv. Same executor, no wizard.

## 6. Target machine layout

### 6.1 Server (Linux target)

```
/opt/octopus/
├── stack/
│   ├── docker-compose.yml     (rendered from template; references .env)
│   ├── .env                   (OCTOPUS_BASE_PATH, OCTOPUS_PORT, OCTOPUS_VERSION)
│   └── app.tar.gz             (source tarball — Dockerfile unpacks this)
└── logs/                      (install logs; docker logs stay in docker)

/etc/caddy/conf.d/octopus.caddy   (only when caddy adapter used — a single import target)
```

**Why `/opt/octopus/stack/` not `/opt/octopus/` as before:** separates Octopus's own state (logs, future DB dumps) from the deploy artifacts. Makes `rm -rf stack/` safe and `rm -rf /opt/octopus/` the full uninstall.

### 6.2 Local

```
Linux/macOS:  ~/.octopus/stack/…          (same structure as above)
Windows:      %LOCALAPPDATA%\Octopus\stack\…
```

### 6.3 User-side (where the installer runs)

```
~/.octopus/config.json   — last-used values, per-target record
~/.octopus/logs/         — install-YYYY-MM-DD-HHMMSS.log  (redacted passwords)
```

## 7. Reverse-proxy adapter

The adapter is an interface:

```go
type Adapter interface {
    Name() string
    SnippetPath() string          // for display
    Apply(cfg Config) error       // install / render / reload
    Verify(cfg Config) error      // curl the endpoint afterwards
    Rollback(cfg Config) error    // remove snippet on failure
}
```

Implementations:

### 7.1 `caddy.go` — native integration

Invariant: we never overwrite the user's existing `/etc/caddy/Caddyfile`. We only add ourselves as a conf.d module.

1. Check `systemctl is-active caddy`.
2. If `Caddyfile` does not contain `import conf.d/*.caddy` or `import conf.d/*`, append it. (Idempotent — check first.)
3. Write `/etc/caddy/conf.d/octopus.caddy` with one of two blocks:

   **With domain:**
   ```
   <domain> {
       handle_path /<path>/* {
           reverse_proxy 127.0.0.1:<port>
       }
   }
   ```
   (Caddy's `handle_path` strips the prefix before proxying — Next.js basePath handles the rest.)

   **Without domain:**
   ```
   :80 {
       handle_path /<path>/* {
           reverse_proxy 127.0.0.1:<port>
       }
   }
   ```
   Note: without a domain we don't get automatic TLS. The user opens `http://<IP>/<path>`.

4. `caddy validate` against the live config.
5. `systemctl reload caddy` (no downtime).

### 7.2 `nginx.go` / `apache.go` — snippet-only

We do **not** touch the nginx/Apache config. Too many competing conventions (`sites-available`, `conf.d`, vhost files). Instead we print a ready-to-paste snippet and exit the wizard successfully with a clear "Manual step required" banner:

```
Nginx detected. Paste the following into your server block, then reload:

    location /<path>/ {
        proxy_pass         http://127.0.0.1:<port>/;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    }

(sudo nginx -t && sudo systemctl reload nginx)
```

### 7.3 `none.go` — we install Caddy

If no proxy is present **and** the user provided a domain, we install Caddy ourselves via the official apt/dnf repo (per Caddy's install docs), then fall into `caddy.go`.

If no proxy **and** no domain, we skip proxy entirely and tell the user the direct `http://<host>:<port>/<path>` URL. Docker already exposes the port.

### 7.4 Path collision

Before we `Apply`, the adapter does:

```
curl -skI --max-time 5 http(s)://<host>/<path>/
```

If the response is anything other than connection-refused / 404, the wizard pauses and says:

```
Something is already responding at https://<host>/<path>/ (HTTP 200).
Pick a different path or abort.
```

User re-enters path and we retry. No silent overwrites.

## 8. App packaging — how the installer carries the app

### 8.1 Strategy: embed a source tarball

At release time, a CI step runs:

```
git archive --format=tar.gz \
            --prefix=octopus-<version>/ \
            -o installer/internal/stack/embedded/app.tar.gz \
            HEAD -- apps ops/docker-compose.yml package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json
```

The tarball is embedded into the binary with `//go:embed`. At install time the installer writes it to the target filesystem (or SFTPs it to the remote), and `docker compose build` consumes it.

### 8.2 Why not download-at-install-time

- Avoids a second network round-trip that can fail mid-install on a flaky VPS.
- Version locking is automatic: there's no race between "latest tag" and "what the installer was built against."
- Reproducibility: the bytes you deploy are the bytes you built.

The tradeoff is binary size. Current project source ~~0.5 MB compressed. Even at 10 MB the binary stays under GitHub's 100 MB release asset cap by a wide margin.

### 8.3 Why not embed `node_modules`

Platform-specific artifacts (esbuild binary, etc.) would bloat by ~200 MB and break cross-platform. `docker compose build` already runs `pnpm install` inside the container — that's the right place.

## 9. Next.js `basePath` wiring

`next.config.mjs` reads `OCTOPUS_BASE_PATH`:

```js
const basePath = process.env.OCTOPUS_BASE_PATH
  ? (process.env.OCTOPUS_BASE_PATH.startsWith("/")
      ? process.env.OCTOPUS_BASE_PATH
      : `/${process.env.OCTOPUS_BASE_PATH}`)
  : "";

const nextConfig = {
  basePath,
  output: "standalone",
  ...
};
```

`docker-compose.yml` reads it from `.env` (which the installer renders) and passes it both at **build time** (Next.js bakes the base path into the bundle — needs to be an `ARG`) and **run time**:

```yaml
services:
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        OCTOPUS_BASE_PATH: ${OCTOPUS_BASE_PATH}
    environment:
      OCTOPUS_BASE_PATH: ${OCTOPUS_BASE_PATH}
      PORT: ${OCTOPUS_PORT}
    ports:
      - "127.0.0.1:${OCTOPUS_PORT}:3000"
    restart: unless-stopped
```

**Note for reviewers:** basePath must be available at Next.js build time. That's why it's an `ARG` in the Dockerfile in addition to a runtime env. Changing the path means rebuilding the image, which the installer handles automatically (`docker compose up -d --build`).

## 10. Docker detection & install

### 10.1 Detection

```
docker info --format '{{.ServerVersion}}'
```

Nonzero exit / connection refused → docker not present or daemon not running.

### 10.2 Install — Linux (local or server)

Use the official convenience script per Docker's docs:

```
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
```

Confirm with the user before running. Privileged: requires root; the executor already has it on server mode, for local mode we shell out via `sudo`.

### 10.3 Install — Windows / macOS

Docker Desktop is a GUI app with a license click-through; scripting it cleanly is not worth the edge cases. We print:

```
Docker not found. Install Docker Desktop from
https://docs.docker.com/get-docker/ and re-run `octopus`.
```

… and exit 0. Not a failure — just a prerequisite.

## 11. Persistence, state, and rollback

### 11.1 On the target

Only what's needed to run:

- `stack/docker-compose.yml`
- `stack/.env`
- `stack/app.tar.gz`

Everything else is in Docker (images, container state). Docker volumes are not used in v0.1 (no database yet).

### 11.2 On the user's machine

`~/.octopus/config.json`:

```json
{
  "version": 1,
  "installs": [
    {
      "id": "amorson.me",
      "mode": "server",
      "host": "amorson.me",
      "port": 22,
      "user": "root",
      "path": "octopus",
      "domain": "amorson.me",
      "installed_at": "2026-04-20T12:34:56Z",
      "installer_version": "v0.1.0"
    }
  ]
}
```

Re-running the installer with an existing entry offers: `Reinstall`, `Uninstall`, `New install`.

### 11.3 Rollback

Every step returns a `Rollback func()`. On error, we run all previously-recorded rollbacks in reverse:

- Proxy snippet written → delete snippet, reload proxy.
- Stack uploaded → `docker compose down` + `rm -rf stack/`.
- Docker installed by us → *do not* remove. Installation is expensive; leaving it is friendly. Log says "Docker was installed by Octopus and left in place."

Partial-failure semantics are explicit in the executor's log: "step 4/7 failed, rolled back 3 of 3 previous steps."

## 12. Version & self-update

- `octopus version` → prints the baked `-X main.Version=vX.Y.Z` + commit SHA.
- On startup, if `TERM` is a tty, the installer does a *non-blocking* check against the GitHub Releases API with a 2-second timeout. If a newer tag exists, it prints a one-line banner:

  ```
  ▲ v0.2.0 available (you are on v0.1.0). Re-run the one-liner to update.
  ```

  Never blocks; never auto-updates.

## 13. Security

- SSH passwords pass through a `memguard`-locked buffer; wiped after auth.
- Known-hosts TOFU: first connection shows fingerprint, user confirms, fingerprint written to `~/.octopus/known_hosts`. Subsequent connects require match. A `--insecure-ignore-host-key` flag exists but warns loudly.
- Bootstrap script downloads the binary over HTTPS and verifies SHA256 against `checksums.txt` from the same release. Keyless cosign verification is attempted if `cosign` is on PATH but is optional (best-effort).
- No third-party analytics, telemetry, error reporting. Ever. Every byte the installer sends is visible in the logs under `~/.octopus/logs/`.
- Logs are scrubbed of auth material before being written.

## 14. Testing

### 14.1 Unit

- `wizard/`: table tests per step — feed `tea.Msg`s, assert on resulting model state. Bubbletea's `teatest` helper.
- `proxy/`: each adapter has table tests with a fake `exec.Cmd` runner.
- `docker/`: fake `exec` runner.
- `ssh/`: spin a `golang.org/x/crypto/ssh` test server in the test binary.

### 14.2 Integration

- `make test-integration-local`: runs `octopus install --mode=local` against the real Docker on the CI runner. Asserts `curl localhost:3000/octopus` returns the Octopus HTML.
- `make test-integration-server`: boots a rootful `rockylinux:9` container, exposes sshd inside it, runs `octopus install --mode=server --host=127.0.0.1 --port=<mapped>`. Same curl assertion.

Both integration tests run in the release workflow — a broken tag never ships.

### 14.3 Manual smoke

The author's own install on `amorson.me` is the release acceptance test for v0.1.

## 15. Release pipeline

`.github/workflows/installer-release.yml`:

```yaml
on:
  push:
    tags: ['v*']
permissions:
  contents: write
  id-token: write  # cosign keyless
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: '1.23' }
      - name: Bake source tarball
        run: |
          mkdir -p installer/internal/stack/embedded
          git archive --format=tar.gz --prefix=octopus-${{ github.ref_name }}/ \
                      -o installer/internal/stack/embedded/app.tar.gz \
                      HEAD -- apps ops/docker-compose.yml package.json \
                              pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json
      - uses: sigstore/cosign-installer@v3
      - uses: goreleaser/goreleaser-action@v6
        with: { args: release --clean }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`.github/workflows/pages-deploy.yml` publishes `bootstrap/` (containing `install`, `install.ps1`, `index.html`) to GitHub Pages on every push to `main`.

## 16. Removal of the old pipeline

The following happens as part of the implementation plan (first step, before any installer code):

1. Wipe `amorson.me`: stop `octopus-web` container, remove `/opt/octopus/`, remove `/etc/caddy/Caddyfile`, stop and disable `caddy.service`, `docker system prune -af --volumes`. DNS record is left untouched.
2. Delete repo files: `.github/workflows/deploy.yml`, `scripts/server-deploy.sh`.
3. Delete repo secrets used by the old workflow: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PASSWORD`, `DEPLOY_SSH_KEY*`.
4. Remove the GitHub `production` environment if it holds only deploy secrets.

After this step, the repository has **no deploy automation at all.** Installer PRs start from a clean slate.

## 17. v0.1 exit criteria

- A freshly-pulled repo can build the installer with `go build ./installer/cmd/octopus`.
- The release workflow produces 6 signed binaries on tag push.
- `curl -fsSL https://mk-amorson.github.io/Octopus/install | sh` lands a user in the wizard on Linux and macOS.
- The PowerShell equivalent lands a user in the wizard on Windows 10/11.
- Local mode: `Octopus` page accessible at `http://localhost:3000/octopus` within 3 minutes of first run (cold Docker cache).
- Server mode: author can install onto `amorson.me` and reach `https://amorson.me/octopus` without touching the server by hand.
- No hard-coded IPs, hostnames, paths, or ports anywhere in the codebase — everything is either a wizard input or a default with an override.

## 18. Appendix — wizard mockup

```
┌─ Octopus installer ──────────────── v0.1.0 ─┐
│                                              │
│   Where do we install?                       │
│                                              │
│     > Local    On this machine (Docker)      │
│       Server   On a remote server (SSH)      │
│                                              │
│   ↑/↓ move   ↵ select   ctrl-c quit          │
└──────────────────────────────────────────────┘

┌─ Octopus installer ─ Server ──────── 3 / 7 ─┐
│                                              │
│   Authenticate as root@amorson.me            │
│                                              │
│     > Password                               │
│       Private key file                       │
│       SSH agent                              │
│                                              │
│   Your choice will not be stored on disk.    │
└──────────────────────────────────────────────┘

┌─ Octopus installer ─ Server ─ Running ──────┐
│                                              │
│   ✓ Connected to amorson.me (debian 13)      │
│   ✓ Docker 29.4.0 already installed          │
│   ✓ Caddy detected — will integrate          │
│   ✓ Path /octopus is free                    │
│   ⠋ Building image (3m 12s)                  │
│   ·  Starting container                      │
│   ·  Configuring reverse proxy               │
│   ·  Verifying endpoint                      │
│                                              │
│   [▆▆▆▆▆▆▆▆▆░░░░░░░░░░]  50%                │
└──────────────────────────────────────────────┘
```
