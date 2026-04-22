# Octopus — engineering principles

The rules every change to this repo must honour. Non-negotiable unless the
user explicitly says otherwise for a specific task.

## Code rules

- **Zero hardcode.** Strings, numbers, colours, paths, URLs, timings — if
  something is used more than once, it lives in one named constant or one
  module and every call-site reads from there.
- **Zero hacks.** No `eslint-disable`, `@ts-ignore`, `as any`, silent
  try/catch, dead code "for later", or fallbacks for cases that cannot
  happen. If a rule gets in the way, fix the real problem — don't paper
  over it.
- **One source of truth.** Every concept (a node definition, a cookie
  name, a palette, a webhook URL, a font family, a schema) has exactly
  one module that owns it. Everyone else imports, nobody duplicates.
- **Unify duplicated logic.** If two call-sites do the same thing,
  extract a function. If two files diverge only by a constant, they're
  the same file with a parameter.
- **Stay under 200 LOC per file.** When a file crosses that line, it's
  doing too much — split it by responsibility, not by line count.
- **Prefer deleting over adding.** A refactor that removes 50 lines is
  better than a feature that adds 50. Simple beats clever.

## Architecture rules

- **Modular by responsibility.** Each folder has a clear job — runtime,
  UI, persistence, protocol. No cross-dependencies that aren't on the
  domain contract.
- **Self-describing nodes.** A new node type is one file under
  `apps/web/src/lib/nodes/<slug>/` plus one line in `registry.ts`. No
  per-type branching in the shell, the sidebar, or the graph.
- **Data shapes live next to their module** — not in a shared `types/`
  dumping ground. Types follow usage.
- **No bespoke state where context or props suffice.** If React can
  thread the value, use React. Don't build a second event bus.
- **Server owns truth; client renders.** Reads go through
  `lib/nodes/store`; serialisation goes through `lib/nodes/serialize`.
  Never reach into the store from a client component.

## Release rules

- **Every shipped change goes to `refs/heads/main` through a feature
  branch and a server-side CI check** (`~/octopus-ci` on the Debian
  build box); direct pushes to `main` that skip the build-box run are
  not acceptable.
- **Version bump + commit message describe behaviour, not files.**
  "v0.X.Y: what the user will notice", not "update file foo.ts".
- **Every release is observable end-to-end.** After `octopus update`
  on the server, smoke-test the affected flow via curl + container
  introspection and paste the result in the reply.

## Style rules

- **Comments explain why, not what.** A comment that restates the code
  is noise; one that records the non-obvious decision is an archive.
  Lean toward writing them.
- **Russian in conversation, English in code and docs.** Commit
  messages, identifiers, comments, file names — English. Anything the
  user reads in the chat — Russian.

## UX rules

- **Octopus-pixel everywhere.** One font stack (the bundled TTF) drives
  every text surface, including 3D labels on the graph. No system-font
  fallback unless the pixel font genuinely can't render a codepoint.
- **The 3D map is the primary surface.** The sidebar describes; the
  canvas is where the user interacts.
- **One tile expanded at a time.** Multi-expand is visual noise;
  selection is single.
