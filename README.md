# Octopus — amorson.me

Personal hub and no-code agent editor. Modular monorepo so future
modules (agent runtime wrapping Claude Code CLI, Telegram channel,
persistence, etc.) plug in without rewrites.

## Layout

```
apps/web/            Next.js 14 + Tailwind. Public site, auth, agent editor UI.
ops/                 Caddyfile, docker-compose, .env.example for the server.
scripts/             server-deploy.sh (runs on the host after each deploy).
.github/workflows/   deploy.yml — push to main → rsync + run server-deploy.sh.
```

## Develop locally

Requires Node 20+ and pnpm 9.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # fill GitHub OAuth creds
pnpm dev                                       # http://localhost:3000
```

## Deploy

Push to `main` → GitHub Actions runs `scripts/server-deploy.sh` on the
server. That script installs Caddy + Docker if missing, writes
`/etc/caddy/Caddyfile`, and runs `docker compose -f ops/docker-compose.yml
up -d web`.

### One-time server setup

1. Create a GitHub OAuth app:
   - Homepage URL: `https://amorson.me`
   - Authorization callback URL: `https://amorson.me/api/auth/callback/github`
2. SSH into the server and create `ops/.env` under the deploy path
   (default `/opt/octopus`) by copying `ops/.env.example`. Fill
   `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, and
   `AUTH_ALLOWED_GITHUB_LOGINS`.
3. Point `amorson.me` DNS at the server.
4. Trigger a deploy (push or `workflow_dispatch`).

The first deploy installs Docker; subsequent deploys just rebuild + swap
the container. Caddy terminates TLS on 443 and proxies to
`127.0.0.1:3000` inside the container.
