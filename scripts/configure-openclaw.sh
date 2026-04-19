#!/usr/bin/env bash
# Patch OpenClaw config so the Control UI works behind the Caddy reverse
# proxy on https://claw.amorson.me. Idempotent — safe to re-run.

set -euo pipefail

CFG="${OPENCLAW_CONFIG:-$HOME/.openclaw/openclaw.json}"
ORIGIN="${OPENCLAW_PUBLIC_ORIGIN:-https://claw.amorson.me}"
TRUSTED="${OPENCLAW_TRUSTED_PROXY:-127.0.0.1/32}"

if [ ! -f "$CFG" ]; then
	echo "openclaw.json not found at $CFG" >&2
	exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
	DEBIAN_FRONTEND=noninteractive apt-get update -qq
	DEBIAN_FRONTEND=noninteractive apt-get install -y -qq jq
fi

backup="$CFG.bak.$(date +%s)"
cp "$CFG" "$backup"
echo "backup: $backup"

tmp=$(mktemp)
jq \
	--arg origin "$ORIGIN" \
	--arg trusted "$TRUSTED" \
	'
	.gateway.trustedProxies = [$trusted]
	| .gateway.controlUi.allowInsecureAuth = true
	| .gateway.controlUi.allowedOrigins = [$origin]
	| .gateway.controlUi.dangerouslyDisableDeviceAuth = true
	' "$CFG" > "$tmp"
mv "$tmp" "$CFG"

echo
echo "patched gateway config:"
jq '{trustedProxies: .gateway.trustedProxies, controlUi: .gateway.controlUi}' "$CFG"

echo
echo "Restart OpenClaw for changes to take effect."
