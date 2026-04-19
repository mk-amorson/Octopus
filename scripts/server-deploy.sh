#!/usr/bin/env bash
# Server-side deploy hook. Runs on the target host after files are synced.
# Extend this with your stack-specific steps (install deps, migrate db, restart services).

set -euo pipefail

echo "[deploy] $(date -u +%FT%TZ) starting server-deploy on $(hostname)"
echo "[deploy] working dir: $(pwd)"

# Example steps — uncomment / adapt as the project grows:
#
# if [ -f package.json ]; then
#   command -v npm >/dev/null && npm ci --omit=dev
#   command -v npm >/dev/null && npm run build
# fi
#
# if [ -f requirements.txt ]; then
#   python3 -m venv .venv
#   ./.venv/bin/pip install -r requirements.txt
# fi
#
# if [ -f docker-compose.yml ]; then
#   docker compose pull
#   docker compose up -d --remove-orphans
# fi
#
# if systemctl list-units --type=service | grep -q '^octopus\.service'; then
#   systemctl restart octopus
# fi

echo "[deploy] done"
