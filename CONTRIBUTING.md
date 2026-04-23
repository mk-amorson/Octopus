# Contributing

Short rules for how work moves through this repo. These sit alongside
`MANIFEST.md` (engineering principles) — read that first; this file
only covers branching and releases.

## Branches

- **`main`** — release-only. Every commit maps 1:1 to a `vX.Y.Z` tag.
  Direct pushes forbidden; updates arrive exclusively via PRs from
  `dev`. Configure branch protection in GitHub to enforce this.
- **`dev`** — integration. All feature and fix work converges here
  through PRs from short-lived branches.
- **`feature/<slug>`, `fix/<slug>`** — per-task branches cut off
  `dev`, merged back into `dev` via PR, then deleted.

## Daily cycle

```sh
git checkout dev && git pull
git checkout -b feature/my-thing
# … work, respecting MANIFEST.md (≤200 LOC/file, zero hardcode, …)
git commit -m "describe what the user will notice"
git push -u origin feature/my-thing
# open PR → dev; CI must be green; squash-merge
```

Never edit `.github/RELEASE_VERSION` or
`installer/internal/version/version.go` on a feature branch. The
first is the single source of truth for the release version, bumped
only as part of a `dev → main` PR. The second is injected by
goreleaser from the tag at release time and is never edited by hand.

## Cutting a release

When `dev` has enough for the next version:

```sh
git checkout dev && git pull
echo "v0.1.1" > .github/RELEASE_VERSION
git add .github/RELEASE_VERSION
git commit -m "v0.1.1: <what the user will notice>"
git push
```

Then open a PR `dev → main`. After it merges:

1. `tag.yml` sees `.github/RELEASE_VERSION` changed on `main`, creates
   the tag, pushes it, and dispatches `release.yml`.
2. `release.yml` runs goreleaser against the new tag and publishes a
   GitHub Release with signed binaries for every supported OS/arch.
3. Every existing install running `octopus update` picks up the new
   tag automatically.

The whole release is triggered by one line in one file — `dev → main`
merge is the only path that can set it off, because `main` is the
only branch `tag.yml` watches for that file.

## Hotfix

Only when production breaks and you can't wait for `dev`:

```sh
git checkout main && git pull
git checkout -b fix/<slug>
# … minimal fix …
echo "v0.1.<next>" > .github/RELEASE_VERSION
git commit -am "v0.1.<next>: <what the user will notice>"
git push -u origin fix/<slug>
# PR → main (reviewed, CI green, merged)
# then back-merge main into dev so the two don't diverge:
git checkout dev && git pull
git merge origin/main
git push
```

## Forbidden

- Pushing to `main` directly (use PRs from `dev` or hotfix branches).
- Bumping `RELEASE_VERSION` on anything other than the final commit of
  a `dev → main` (or hotfix → main) PR. Doing it earlier triggers a
  release the moment that commit lands on main.
- Editing `installer/internal/version/version.go` by hand. Goreleaser
  owns `version.Current`.
- `--no-verify`, `@ts-ignore`, `eslint-disable`, silent `catch {}`. See
  `MANIFEST.md` — these are not style preferences, they're blockers.
- Committing `.claude/`, `CLAUDE.md`, `.cursor/`, `AGENTS.md`. Already
  in `.gitignore`; don't defeat it.

## Branch protection (one-time GitHub setting)

In `Settings → Branches → Add rule` on `main`:

- Require a pull request before merging (1 approval if you want, or 0
  for a solo repo — but the PR itself is mandatory).
- Require status checks to pass: `CI / Web` and `CI / Installer`.
- Require linear history.
- Restrict who can push to matching branches: nobody (or only admins
  for emergency overrides).

Same rule on `dev` with `Require status checks to pass` is optional
but recommended — keeps `dev` always green.
