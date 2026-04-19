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
	install -m 0644 "$src" "$dst"
	systemctl enable caddy >/dev/null 2>&1 || true
	caddy validate --config "$dst" --adapter caddyfile
	# Restart (not reload) so Caddy drops any in-memory ACME backoff state
	# and retries cert issuance from scratch on every deploy.
	systemctl restart caddy
}

# If ufw is installed and active, make sure 80/443 are reachable. Anything
# else about the firewall is left to the operator.
open_http_ports() {
	if command -v ufw >/dev/null 2>&1 && ufw status | grep -qi "Status: active"; then
		echo "[deploy] ensuring ufw allows 80/tcp and 443/tcp"
		ufw allow 80/tcp  >/dev/null || true
		ufw allow 443/tcp >/dev/null || true
	fi
}

# Emit diagnostics into the Actions log so Caddy/TLS state is visible without
# shelling into the server. All commands are best-effort.
dump_diagnostics() {
	echo "==== caddy status ===="
	systemctl is-active caddy || true
	systemctl is-enabled caddy || true

	echo "==== ss -tlnp (80/443) ===="
	ss -tlnp 2>/dev/null | awk 'NR==1 || /:80 |:443 /' || true

	echo "==== caddy journal (last 80 lines) ===="
	journalctl -u caddy --no-pager -n 80 -o cat 2>/dev/null || true

	echo "==== self-check http ===="
	curl -sSI -m 5 -H "Host: amorson.me" http://127.0.0.1/ 2>&1 | head -5 || true

	echo "==== self-check https ===="
	curl -skSI -m 10 --resolve amorson.me:443:127.0.0.1 https://amorson.me/ 2>&1 | head -10 || true

	echo "==== dns as seen from server ===="
	getent hosts amorson.me || true
}

install_caddy
sync_caddyfile
open_http_ports

# Patch OpenClaw config so the Control UI accepts connections via Caddy.
# Idempotent — runs every deploy, no-op once keys are set. Targets common
# install users; add more if OpenClaw is owned by a different one.
configure_openclaw() {
	local script="scripts/configure-openclaw.sh"
	[ -x "$script" ] || return 0
	for u in root ubuntu debian; do
		local home
		home=$(getent passwd "$u" | cut -d: -f6)
		[ -n "$home" ] && [ -f "$home/.openclaw/openclaw.json" ] || continue
		echo "[deploy] patching OpenClaw config for user $u"
		sudo -u "$u" -H OPENCLAW_PUBLIC_ORIGIN="https://claw.amorson.me" "$PWD/$script" || \
			echo "[deploy] WARN: configure-openclaw.sh failed for $u" >&2
	done
}
configure_openclaw

# Give Caddy time to settle and complete at least one cert issuance attempt.
sleep 25
dump_diagnostics

echo "[deploy] done"
