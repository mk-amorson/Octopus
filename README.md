# Octopus — product repository (private)

This repo holds the source of the Octopus web application. It is intentionally
private. End users never see it. They interact with two other surfaces:

1. The public installer at `github.com/mk-amorson/octopus-installer` — a Go
   CLI (`octopus install`, `start`, `stop`, `update`, `uninstall`) plus the
   `curl | sh` bootstrap hosted on GitHub Pages.
2. The public Docker image at `ghcr.io/mk-amorson/octopus-web` — built from
   `apps/web` by this repo's `Build image` workflow on every `v*` tag, and
   pulled by the installer at install time.

That split is what lets the product stay closed-source while the installer
(and the free-tier GitHub Pages it uses) stays open.

## Layout

- `apps/web/` — the Next.js 14 product. Closed-source.
- `.github/workflows/build-image.yml` — on each `v*` tag, builds
  `apps/web/Dockerfile` for linux/amd64 + linux/arm64 and pushes to GHCR
  as `ghcr.io/<owner>/octopus-web:<tag>` (plus `:latest` and
  `:<major>.<minor>`). Uses `OCTOPUS_BASE_PATH=/octopus`.

## Commands

Run from the repo root. Requires pnpm 9.12.0 (via corepack) and Node 20+.

- `pnpm install` — install workspace deps.
- `pnpm dev` — run the web app on `http://localhost:3000`.
- `pnpm build` — production Next.js build (`output: "standalone"`).
- `pnpm start` — run the built server on `0.0.0.0:3000`.
- `pnpm lint` / `pnpm typecheck`.

No tests yet.

## Releasing a new product version

1. Merge your changes to `main`.
2. Push a tag:

   ```sh
   git tag v0.1.0 && git push origin v0.1.0
   ```

3. The `Build image` workflow publishes `ghcr.io/<owner>/octopus-web:v0.1.0`
   (and `:latest`, `:0.1`).
4. **First-time only**: after the first successful push, go to
   `github.com/users/mk-amorson/packages/container/octopus-web/settings`
   and set package visibility to **Public**. Without this step the
   installer's anonymous `docker pull` will fail with 401.
5. Cut a matching release of the public installer (separate repo) so
   `octopus update` on end-user machines picks up `v0.1.0`.

## basePath

The public image is baked with `basePath=/octopus`. If you need a different
subpath, either build a parallel image tag with a different
`OCTOPUS_BASE_PATH` or tell users to set up a reverse proxy that rewrites
the path. Kept single-subpath on purpose — multiple variants is an
operational and support cost not worth paying for v0.1.

## History

Before v0.1.0 this repo held a GitHub-Actions-driven auto-deploy to
`amorson.me` and then a monorepo-with-Go-installer setup. Both approaches
were deprecated once the product became a commercial self-hosted target.
The installer code now lives in the companion public repo.
