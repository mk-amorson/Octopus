#!/usr/bin/env bash
# Server-side deploy hook. Runs on the target host after files are synced.

set -euo pipefail

echo "[deploy] $(date -u +%FT%TZ) starting server-deploy on $(hostname)"
echo "[deploy] working dir: $(pwd)"

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

install_docker() {
	if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
		return
	fi
	echo "[deploy] installing Docker Engine + compose plugin"
	export DEBIAN_FRONTEND=noninteractive
	apt-get update -qq
	apt-get install -y -qq ca-certificates curl gnupg lsb-release
	install -m 0755 -d /etc/apt/keyrings
	if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
		curl -fsSL https://download.docker.com/linux/debian/gpg \
			| gpg --dearmor -o /etc/apt/keyrings/docker.gpg
		chmod a+r /etc/apt/keyrings/docker.gpg
	fi
	local codename
	codename=$(. /etc/os-release && echo "${VERSION_CODENAME:-bookworm}")
	echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/debian ${codename} stable" \
		> /etc/apt/sources.list.d/docker.list
	apt-get update -qq
	apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
		docker-buildx-plugin docker-compose-plugin
	systemctl enable --now docker
}

sync_caddyfile() {
	local src="ops/Caddyfile"
	local dst="/etc/caddy/Caddyfile"
	[ -f "$src" ] || { echo "[deploy] $src missing; skipping Caddy config"; return; }
	mkdir -p "$(dirname "$dst")"
	install -m 0644 "$src" "$dst"
	systemctl enable caddy >/dev/null 2>&1 || true
	caddy validate --config "$dst" --adapter caddyfile
	# Restart so Caddy clears any in-memory ACME backoff and retries cert
	# issuance from scratch on every deploy.
	systemctl restart caddy
}

open_http_ports() {
	if command -v ufw >/dev/null 2>&1 && ufw status | grep -qi "Status: active"; then
		echo "[deploy] ensuring ufw allows 80/tcp and 443/tcp"
		ufw allow 80/tcp  >/dev/null || true
		ufw allow 443/tcp >/dev/null || true
	fi
}

# Build and (re)start the web container via docker compose.
deploy_web_stack() {
	local compose_dir="ops"
	local env_file="$compose_dir/.env"
	# Create an empty env file if missing — docker compose `env_file:` requires
	# the path to exist, and we have no runtime secrets yet.
	[ -f "$env_file" ] || { : > "$env_file"; chmod 600 "$env_file"; }

	echo "[deploy] building octopus-web image"
	docker compose -f "$compose_dir/docker-compose.yml" build web

	echo "[deploy] (re)starting octopus-web"
	docker compose -f "$compose_dir/docker-compose.yml" up -d web

	# Drop dangling build cache so the server doesn't run out of disk after
	# a few deploys. Safe — only untagged intermediate layers are removed.
	docker image prune -f >/dev/null 2>&1 || true
}

dump_diagnostics() {
	echo "==== caddy status ===="
	systemctl is-active caddy || true
	systemctl is-enabled caddy || true

	echo "==== docker compose ps ===="
	docker compose -f ops/docker-compose.yml ps 2>/dev/null || true

	echo "==== ss -tlnp (80/443/3000) ===="
	ss -tlnp 2>/dev/null | awk 'NR==1 || /:80 |:443 |:3000 /' || true

	echo "==== caddy journal (last 40 lines) ===="
	journalctl -u caddy --no-pager -n 40 -o cat 2>/dev/null || true

	echo "==== octopus-web logs (last 40 lines) ===="
	docker logs --tail 40 octopus-web 2>&1 || true

	echo "==== self-check apex ===="
	curl -skSI -m 10 --resolve amorson.me:443:127.0.0.1 https://amorson.me/ 2>&1 | head -10 || true
}

install_caddy
install_docker
sync_caddyfile
open_http_ports
deploy_web_stack

# Give Caddy time to settle and complete at least one cert issuance attempt.
sleep 15
dump_diagnostics

echo "[deploy] done"
