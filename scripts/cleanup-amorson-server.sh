#!/usr/bin/env bash
# One-shot cleanup for the legacy amorson.me auto-deploy of Octopus.
#
# Usage (on the server, as root or via sudo):
#   curl -fsSL https://raw.githubusercontent.com/mk-amorson/Octopus/main/scripts/cleanup-amorson-server.sh | sudo bash
#
# What it does (all idempotent, safe to re-run):
#   1. Stops and removes the octopus-web docker container and image.
#   2. Prunes dangling docker images to free disk.
#   3. Drops /etc/caddy/Caddyfile (detaching amorson.me from this project)
#      and reloads Caddy so it stops answering for the domain. Caddy itself
#      is left installed — uncomment the `PURGE_CADDY=1` block below if you
#      want it gone too.
#   4. Removes /opt/octopus (including ops/.env).
#   5. Prints a final status check.

set -eu

say() { printf '\n[cleanup] %s\n' "$*"; }

DEPLOY_PATH="${DEPLOY_PATH:-/opt/octopus}"

say "stopping and removing octopus-web container"
if [ -f "$DEPLOY_PATH/ops/docker-compose.yml" ]; then
    (cd "$DEPLOY_PATH" && docker compose -f ops/docker-compose.yml down -v) || true
else
    # compose file already gone — just nuke the container by name if it's
    # still around from an older deploy.
    docker rm -f octopus-web 2>/dev/null || true
fi

say "removing built image"
docker image rm octopus-web:latest 2>/dev/null || true
docker image prune -af >/dev/null 2>&1 || true

say "detaching Caddy from amorson.me"
if [ -f /etc/caddy/Caddyfile ]; then
    rm -f /etc/caddy/Caddyfile
fi
# Reload Caddy so it drops the old site config. If Caddy isn't running
# that's fine — this is best-effort.
systemctl reload caddy 2>/dev/null || systemctl restart caddy 2>/dev/null || true

# Uncomment to also remove Caddy entirely (only if nothing else uses it):
# if [ "${PURGE_CADDY:-0}" = "1" ]; then
#     say "purging Caddy"
#     systemctl stop caddy 2>/dev/null || true
#     systemctl disable caddy 2>/dev/null || true
#     apt-get purge -y caddy 2>/dev/null || true
#     rm -rf /etc/caddy /var/lib/caddy
# fi

say "removing $DEPLOY_PATH"
rm -rf "$DEPLOY_PATH"

say "done. Final check:"
echo "  listening sockets on 80/443/3000:"
ss -tlnp 2>/dev/null | awk 'NR==1 || /:80 |:443 |:3000 /' || true
echo "  docker containers with 'octopus' in the name:"
docker ps -a --filter "name=octopus" --format 'table {{.Names}}\t{{.Status}}' || true
echo
echo "amorson.me is no longer served by this project."
