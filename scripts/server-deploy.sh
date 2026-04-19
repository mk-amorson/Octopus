#!/usr/bin/env bash
# Server-side deploy hook. Runs on the target host after files are synced.

set -euo pipefail

echo "[deploy] $(date -u +%FT%TZ) starting server-deploy on $(hostname)"
echo "[deploy] working dir: $(pwd)"

# Ensure Caddy is installed and configured to serve amorson.me.
install_caddy() {
	if command -v caddy >/dev/null 2>&1; then
		return
	fi
	echo "[deploy] installing Caddy"
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -qq
	apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
	curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
		| gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
	curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
		> /etc/apt/sources.list.d/caddy-stable.list
	apt-get update -qq
	apt-get install -y -qq caddy
}

sync_caddyfile() {
	local src="ops/Caddyfile"
	local dst="/etc/caddy/Caddyfile"
	[ -f "$src" ] || { echo "[deploy] $src missing; skipping Caddy config"; return; }
	mkdir -p "$(dirname "$dst")"
	if ! cmp -s "$src" "$dst"; then
		echo "[deploy] updating $dst"
		install -m 0644 "$src" "$dst"
		systemctl enable --now caddy >/dev/null 2>&1 || true
		caddy validate --config "$dst" --adapter caddyfile
		systemctl reload caddy
	else
		echo "[deploy] $dst already up to date"
		systemctl enable --now caddy >/dev/null 2>&1 || true
	fi
}

install_caddy
sync_caddyfile

echo "[deploy] done"
