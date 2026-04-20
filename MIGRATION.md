# Migration guide — split into private product + public installer

This file is a one-time checklist for finishing the `mk-amorson/Octopus`
(private product) ⇄ `mk-amorson/octopus-installer` (public) split. Delete
this file once both repos are live.

## What this repo already is

After the current branch merges, `mk-amorson/Octopus` (private) contains:

- `apps/web/` — the product
- `apps/web/Dockerfile` — builds the image, basePath default `/octopus`
- `.github/workflows/build-image.yml` — publishes
  `ghcr.io/mk-amorson/octopus-web:<tag>` on every `v*` tag
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.base.json`
- `README.md`, `CLAUDE.md`
- `MIGRATION.md` (this file)

No installer code, no Pages site, no legacy deploy scripts.

## First release of the private product

1. From `main`:
   ```sh
   git tag v0.1.0
   git push origin v0.1.0
   ```
2. The `Build image` workflow pushes `ghcr.io/mk-amorson/octopus-web:v0.1.0`
   (plus `:latest` and `:0.1`).
3. **One-time**: go to
   `https://github.com/users/mk-amorson/packages/container/octopus-web/settings`,
   set visibility to **Public**. Without this, `docker pull` fails with 401
   for end users.

## Setting up `mk-amorson/octopus-installer` (public)

Create the repo manually in GitHub UI (New repository → Public, no README).

Then seed it with the six files listed under "Files to copy" below. The
contents were already written in the previous branches of the private repo
(before the split) and are preserved in this repo's git history if you
need to diff them. They're also summarized here so you don't have to dig.

### Files to copy into the new public repo

```
installer/go.mod
installer/cmd/octopus/main.go
installer/internal/version/version.go
installer/internal/state/state.go
installer/internal/docker/docker.go           # with auto-install flow
installer/internal/source/source.go           # REPLACE with image/image.go — see below
installer/internal/wizard/wizard.go
installer/internal/stack/stack.go             # REPLACE to use pre-built image — see below
installer/internal/commands/install.go
installer/internal/commands/lifecycle.go
installer/internal/commands/uninstall.go
installer/internal/commands/update.go
installer/.goreleaser.yaml
.github/workflows/release.yml
.github/workflows/pages.yml
.github/workflows/tag.yml
docs/pages/install                            # shell bootstrap
docs/pages/install.ps1                        # windows bootstrap
docs/pages/index.html                         # landing
README.md
```

Every file with the full content is in this repo's history — on branch
`claude/add-claude-documentation-3LDDD` at commit `c5493e4` (or any later
commit of `main` before this split merged). You can `git show <sha>:path`
to recover any file.

### Two files that need rewriting for the split

The previous installer built the product Docker image from a source
tarball it downloaded from GitHub. That doesn't work now — the source is
private. The installer must pull the pre-built image from GHCR instead.

**`installer/internal/image/image.go`** (replaces `source/source.go`):

```go
package image

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/mk-amorson/octopus-installer/internal/version"
)

// Ref returns the fully-qualified image ref for a given tag, e.g.
// "ghcr.io/mk-amorson/octopus-web:v0.1.0".
func Ref(tag string) string {
	return fmt.Sprintf("ghcr.io/mk-amorson/octopus-web:%s", tag)
}

// Pull pulls the image for the given tag. Streaming output so the user
// sees progress bars for a multi-hundred-MB download.
func Pull(tag string) error {
	cmd := exec.Command("docker", "pull", Ref(tag))
	cmd.Stdout, cmd.Stderr = nil, nil // inherit
	return cmd.Run()
}

// LatestTag still resolves from GitHub releases of the installer repo —
// product tags and installer tags are 1:1. If that contract ever changes,
// point this at the container registry's tag listing instead.
func LatestTag() (string, error) {
	// identical to the old source.LatestTag(), but against the installer repo
	_ = version.Repo
	return "", fmt.Errorf("copy source.LatestTag verbatim")
}

var _ = strings.TrimPrefix
```

**`installer/internal/stack/stack.go`** — change `composeTemplate` so it
uses `image:` instead of `build:`:

```yaml
services:
  web:
    image: ghcr.io/mk-amorson/octopus-web:<tag>
    container_name: octopus-web
    restart: unless-stopped
    ports:
      - "<host>:<port>:3000"
```

Delete the `Build()` function — there's no local build anymore. `install.go`
calls `image.Pull()` followed by `stack.Up()`.

### Constants to rename

In the public repo, change:
- `version.Repo = "mk-amorson/Octopus"` → `"mk-amorson/octopus-installer"`
- `state.ComposeProject = "octopus"` — unchanged
- All Go import paths `github.com/mk-amorson/Octopus/installer/...` →
  `github.com/mk-amorson/octopus-installer/internal/...`
- Bootstrap shims (`docs/pages/install` and `install.ps1`):
  `REPO="mk-amorson/octopus-installer"` / `$Repo = 'mk-amorson/octopus-installer'`
- `installer/.goreleaser.yaml`:
  `github.owner: mk-amorson`, `github.name: octopus-installer`
- `docs/pages/index.html` — source link points at the public repo.

### Pages setup

Once the public repo has `docs/pages/` committed, go to
**Settings → Pages → Source: GitHub Actions**. The first push to `main`
touching `docs/pages/**` publishes the site.

### First release of the installer

Actions → Tag release → Run workflow → `v0.1.0`. goreleaser ships six
binaries + `checksums.txt` to the public repo's Releases page. Same
version tag as the product image.

## End-to-end install smoke test

From any machine (Docker installed):

```sh
curl -fsSL https://mk-amorson.github.io/octopus-installer/install | sh
```

Expected flow:
1. Bootstrap downloads the `octopus` binary, verifies its checksum, adds
   `~/.octopus/bin` to PATH, execs `octopus install`.
2. Wizard asks host / subpath (default `/octopus`, since that's what the
   image has baked) / port.
3. `docker pull ghcr.io/mk-amorson/octopus-web:v0.1.0`.
4. `docker compose up -d` against the generated compose file.
5. Prints `http://localhost:3000/octopus`.

If any step fails, the installer exits with a message — the transcript is
enough to debug.
