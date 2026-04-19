#!/usr/bin/env bash
# Remove OpenClaw from the server: stop running processes, disable any
# systemd units, delete its data directory. Idempotent — safe to run
# repeatedly; every step is best-effort.
#
# Does NOT touch the Claude Code CLI (/root/.local/bin/claude) — that
# binary is separate and still useful.

set -uo pipefail

echo "[purge-openclaw] start"

# Stop systemd units (all profiles), if present.
mapfile -t units < <(systemctl list-unit-files --no-legend 2>/dev/null \
	| awk '/openclaw/ {print $1}')
for u in "${units[@]}"; do
	echo "[purge-openclaw] disabling $u"
	systemctl disable --now "$u" >/dev/null 2>&1 || true
done

# Kill anything still calling itself openclaw. pgrep -f matches the full
# command line, which would also hit this very script (path contains
# "openclaw"), so we exclude our own pid/ppid and anything whose cmdline
# points at purge-openclaw.
kill_openclaw_procs() {
	local sig="$1" pid cmdline
	local mypid=$$ parentpid=$PPID
	for pid in $(pgrep -f openclaw 2>/dev/null); do
		[ "$pid" = "$mypid" ] && continue
		[ "$pid" = "$parentpid" ] && continue
		cmdline=$(tr '\0' ' ' < "/proc/$pid/cmdline" 2>/dev/null || true)
		case "$cmdline" in *purge-openclaw*) continue ;; esac
		kill "$sig" "$pid" 2>/dev/null || true
	done
}

if pgrep -f openclaw >/dev/null 2>&1; then
	echo "[purge-openclaw] killing running openclaw processes"
	kill_openclaw_procs -TERM
	sleep 2
	kill_openclaw_procs -KILL
fi

# Wipe per-user data directories.
for u in root ubuntu debian; do
	home=$(getent passwd "$u" | cut -d: -f6)
	[ -n "$home" ] || continue
	if [ -d "$home/.openclaw" ]; then
		echo "[purge-openclaw] removing $home/.openclaw"
		rm -rf "$home/.openclaw"
	fi
	if [ -d "$home/.config/openclaw" ]; then
		echo "[purge-openclaw] removing $home/.config/openclaw"
		rm -rf "$home/.config/openclaw"
	fi
done

# System-wide config, if it existed.
for d in /etc/openclaw /var/lib/openclaw /opt/openclaw; do
	if [ -e "$d" ]; then
		echo "[purge-openclaw] removing $d"
		rm -rf "$d"
	fi
done

# Remove binary if present in common locations. Kept conservative: only
# touches symlinks / files literally named `openclaw`.
for b in /usr/local/bin/openclaw /usr/bin/openclaw /root/.local/bin/openclaw; do
	if [ -e "$b" ] || [ -L "$b" ]; then
		echo "[purge-openclaw] removing $b"
		rm -f "$b"
	fi
done

echo "[purge-openclaw] done"
