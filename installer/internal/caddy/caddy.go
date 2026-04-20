package caddy

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// Setup installs Caddy (if missing) and writes a Caddyfile that reverse-
// proxies domain → 127.0.0.1:port. TLS is handled by Caddy's built-in
// Let's Encrypt integration — as long as the domain's A/AAAA record
// points at this machine and port 80/443 are free, a cert is issued
// automatically on first request.
//
// Linux-only. On other platforms we bail out with a no-op error the
// caller surfaces as a warning; those platforms don't have a universal
// systemd-style reverse-proxy flow worth automating.
func Setup(domain string, port int) error {
	if runtime.GOOS != "linux" {
		return fmt.Errorf("caddy auto-setup only supported on Linux")
	}
	if !hasSudo() {
		return fmt.Errorf("caddy setup needs sudo; install it or run the installer as root")
	}

	if _, err := exec.LookPath("caddy"); err != nil {
		fmt.Println("==> installing Caddy")
		if err := installCaddy(); err != nil {
			return fmt.Errorf("install caddy: %w", err)
		}
	}

	if err := writeCaddyfile(domain, port); err != nil {
		return err
	}

	fmt.Println("==> enabling and restarting Caddy")
	if err := sudoRun("systemctl", "enable", "caddy"); err != nil {
		// enable can legitimately fail on systems without systemd (uncommon
		// for Debian/Ubuntu/RHEL/Fedora where caddy's package ships a unit,
		// but we don't want to fail the install over it).
		fmt.Printf("warning: systemctl enable caddy failed: %v\n", err)
	}
	if err := sudoRun("systemctl", "restart", "caddy"); err != nil {
		return fmt.Errorf("systemctl restart caddy: %w", err)
	}
	return nil
}

// Remove drops the Caddyfile written by Setup and reloads Caddy so it
// stops serving the domain. Best-effort — if Caddy is gone or the file
// never existed we don't care.
func Remove() error {
	if runtime.GOOS != "linux" {
		return nil
	}
	_ = sudoRun("rm", "-f", caddyfilePath)
	_ = sudoRun("systemctl", "reload", "caddy")
	return nil
}

const caddyfilePath = "/etc/caddy/Caddyfile"

// marker is dropped into every Caddyfile we generate so a re-install can
// tell whether it's overwriting one of our files or a user's custom
// config. If a non-marker file is found, Setup makes a .bak first.
const marker = "# managed by the Octopus installer"

func writeCaddyfile(domain string, port int) error {
	content := fmt.Sprintf("%s\n%s {\n    reverse_proxy 127.0.0.1:%d\n}\n",
		marker, domain, port)

	if existing, err := os.ReadFile(caddyfilePath); err == nil {
		if !strings.Contains(string(existing), marker) && len(strings.TrimSpace(string(existing))) > 0 {
			fmt.Printf("==> existing %s is not ours; backing it up to %s.bak\n",
				caddyfilePath, caddyfilePath)
			if err := sudoRun("cp", caddyfilePath, caddyfilePath+".bak"); err != nil {
				return fmt.Errorf("backup existing Caddyfile: %w", err)
			}
		}
	}

	// Write via `sudo tee` so we don't need to exec as root ourselves —
	// keeps the one-time password prompt visible to the user.
	fmt.Printf("==> writing %s (reverse-proxy %s → 127.0.0.1:%d)\n",
		caddyfilePath, domain, port)
	cmd := exec.Command("sudo", "tee", caddyfilePath)
	cmd.Stdin = strings.NewReader(content)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("write %s: %w", caddyfilePath, err)
	}
	return nil
}

// installCaddy runs the commands from the official Caddy apt repo
// instructions. We stick to apt (Debian/Ubuntu) because that's the
// overwhelmingly common VPS case. On other distros we bail and tell the
// user to install Caddy themselves — trying to cover apt+dnf+pacman in
// Go is more complexity than it's worth for v0.1.
func installCaddy() error {
	if _, err := exec.LookPath("apt-get"); err != nil {
		return fmt.Errorf("caddy auto-install only supports apt-based distros (Debian/Ubuntu). Install caddy manually and re-run")
	}
	script := `set -e
apt-get update -qq
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl gnupg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  > /etc/apt/sources.list.d/caddy-stable.list
apt-get update -qq
apt-get install -y -qq caddy
`
	cmd := exec.Command("sudo", "bash", "-c", script)
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	return cmd.Run()
}

func hasSudo() bool {
	_, err := exec.LookPath("sudo")
	return err == nil || os.Geteuid() == 0
}

func sudoRun(args ...string) error {
	bin := args[0]
	rest := args[1:]
	if os.Geteuid() != 0 {
		rest = append([]string{bin}, rest...)
		bin = "sudo"
	}
	cmd := exec.Command(bin, rest...)
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	return cmd.Run()
}
