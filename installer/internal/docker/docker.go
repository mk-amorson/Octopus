package docker

import (
	"bufio"
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// Ensure verifies that `docker` and the compose plugin are both usable. If
// they're not, it offers to install them automatically — the details differ
// by OS:
//
//   - Linux:   runs the official get.docker.com script via sudo.
//   - macOS:   uses `brew install --cask docker` if Homebrew is available,
//             otherwise opens the Docker Desktop download page.
//   - Windows: uses `winget install Docker.DockerDesktop` if winget is
//             available, otherwise opens the Docker Desktop download page.
//
// The caller (install command) invokes this once up front so the wizard
// doesn't get interrupted halfway through by a missing-docker error.
func Ensure() error {
	if ok, err := check(); ok {
		return err
	}
	fmt.Println()
	fmt.Println("  Docker is required but wasn't found on this machine.")
	if err := tryInstall(); err != nil {
		return err
	}
	// Re-check after install.
	ok, err := check()
	if err != nil {
		return fmt.Errorf("docker still not usable after install: %w", err)
	}
	if !ok {
		return fmt.Errorf("docker still not usable after install. Open the Docker app (macOS/Windows) or log out and back in (Linux) and re-run `octopus install`")
	}
	return nil
}

// check tests that the docker binary is on PATH AND that `docker compose
// version` exits zero (proving both the daemon is reachable and the compose
// plugin is installed). It returns (false, nil) when docker is simply
// absent, and (false, err) when it's present but broken — we distinguish
// so we know whether to offer install or give a different message.
func check() (bool, error) {
	if _, err := exec.LookPath("docker"); err != nil {
		return false, nil
	}
	var stderr bytes.Buffer
	cmd := exec.Command("docker", "compose", "version")
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return false, fmt.Errorf("docker compose not usable: %w\n%s", err, stderr.String())
	}
	return true, nil
}

func tryInstall() error {
	switch runtime.GOOS {
	case "linux":
		return installLinux()
	case "darwin":
		return installDarwin()
	case "windows":
		return installWindows()
	default:
		return fmt.Errorf("unsupported OS for auto-install: %s", runtime.GOOS)
	}
}

// installLinux uses the official `get.docker.com` convenience script, which
// handles every major distro (Debian/Ubuntu, Fedora, RHEL, Arch, etc). It
// requires sudo — we prompt first so the user isn't surprised.
func installLinux() error {
	fmt.Println("  I can install Docker Engine automatically via the official")
	fmt.Println("  script at https://get.docker.com. This requires sudo and")
	fmt.Println("  will add the docker-ce and docker-compose-plugin packages.")
	if !confirm("  install now? [Y/n]: ") {
		fmt.Println("  Skipping auto-install. Install Docker manually and re-run `octopus install`.")
		return fmt.Errorf("docker install declined")
	}

	// A single bash pipeline so we don't keep re-prompting for sudo password
	// and so failures short-circuit.
	script := `set -e
echo "==> downloading get-docker.sh"
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
echo "==> running installer (sudo)"
sudo sh /tmp/get-docker.sh
sudo systemctl enable --now docker || true
# Put the current user in the docker group so they can run docker without
# sudo after a re-login. Best-effort — on WSL or non-systemd setups this
# may be a no-op.
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  sudo usermod -aG docker "$SUDO_USER" || true
elif [ -n "${USER:-}" ] && [ "$USER" != "root" ]; then
  sudo usermod -aG docker "$USER" || true
fi
rm -f /tmp/get-docker.sh
`
	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("docker install failed: %w", err)
	}

	// After usermod the current shell session doesn't get the new group until
	// it re-logs in. If docker is only reachable via sudo we'd fail on the
	// first compose call — warn the user now rather than later.
	if err := exec.Command("docker", "info").Run(); err != nil {
		fmt.Println()
		fmt.Println("  Docker installed, but your current shell isn't in the `docker` group yet.")
		fmt.Println("  Log out and back in (or run `newgrp docker` in this shell), then re-run:")
		fmt.Println("    octopus install")
		return fmt.Errorf("re-login required so the docker group membership takes effect")
	}
	fmt.Println("  Docker is ready.")
	return nil
}

// installDarwin prefers Homebrew (`brew install --cask docker`) when it's
// available. Docker Desktop still needs to be launched once to accept its
// terms of service, so we open the app and stop — the user re-runs
// `octopus install` once Docker is running.
func installDarwin() error {
	url := "https://www.docker.com/products/docker-desktop/"
	if _, err := exec.LookPath("brew"); err == nil {
		fmt.Println("  Homebrew is available. I can install Docker Desktop via:")
		fmt.Println("    brew install --cask docker")
		if confirm("  install now? [Y/n]: ") {
			cmd := exec.Command("brew", "install", "--cask", "docker")
			cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
			if err := cmd.Run(); err == nil {
				fmt.Println("  Docker Desktop installed. Opening it now — accept the TOS,")
				fmt.Println("  wait until the whale icon stops animating, then re-run `octopus install`.")
				_ = exec.Command("open", "-a", "Docker").Start()
				return fmt.Errorf("start Docker Desktop, then re-run `octopus install`")
			}
			fmt.Println("  brew install failed — falling back to manual install.")
		}
	}

	fmt.Println("  On macOS, install Docker Desktop from:")
	fmt.Println("    " + url)
	fmt.Println("  Opening that page now. Launch Docker Desktop once it's installed,")
	fmt.Println("  then re-run `octopus install`.")
	_ = exec.Command("open", url).Start()
	return fmt.Errorf("install and launch Docker Desktop, then re-run `octopus install`")
}

// installWindows mirrors installDarwin but uses winget, which ships with
// every supported Windows 10+ build.
func installWindows() error {
	url := "https://www.docker.com/products/docker-desktop/"
	if _, err := exec.LookPath("winget"); err == nil {
		fmt.Println("  winget is available. I can install Docker Desktop via:")
		fmt.Println("    winget install --id Docker.DockerDesktop")
		if confirm("  install now? [Y/n]: ") {
			cmd := exec.Command("winget", "install",
				"--id", "Docker.DockerDesktop",
				"--accept-package-agreements", "--accept-source-agreements")
			cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
			if err := cmd.Run(); err == nil {
				fmt.Println("  Docker Desktop installed. Launch it from the Start menu,")
				fmt.Println("  wait until it reports Running, open a new terminal,")
				fmt.Println("  and re-run `octopus install`.")
				return fmt.Errorf("start Docker Desktop and re-run `octopus install` in a new terminal")
			}
			fmt.Println("  winget install failed — falling back to manual install.")
		}
	}

	fmt.Println("  On Windows, install Docker Desktop from:")
	fmt.Println("    " + url)
	fmt.Println("  Opening that page now. Launch Docker Desktop once installed,")
	fmt.Println("  then re-run `octopus install` in a new terminal.")
	_ = exec.Command("cmd", "/c", "start", url).Start()
	return fmt.Errorf("install and launch Docker Desktop, then re-run `octopus install`")
}

func confirm(prompt string) bool {
	fmt.Print(prompt)
	r := bufio.NewReader(os.Stdin)
	line, err := r.ReadString('\n')
	if err != nil && err != io.EOF {
		return false
	}
	s := strings.TrimSpace(strings.ToLower(line))
	return s == "" || s == "y" || s == "yes"
}

// Run executes a docker command with stdout/stderr piped to the user's
// terminal. Used for the long-running build/up steps where live output is
// the whole point.
func Run(dir string, args ...string) error {
	cmd := exec.Command("docker", args...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

// RunQuiet is like Run but captures output instead of streaming it. Used for
// short status checks where the raw output would just be noise.
func RunQuiet(dir string, args ...string) (string, error) {
	cmd := exec.Command("docker", args...)
	cmd.Dir = dir
	var out bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &out
	err := cmd.Run()
	return out.String(), err
}

// Compose wraps `docker compose -p <project>` so all our calls end up in the
// same docker compose project namespace.
func Compose(dir, project string, args ...string) error {
	full := append([]string{"compose", "-p", project}, args...)
	return Run(dir, full...)
}

// ComposeQuiet is Compose + RunQuiet.
func ComposeQuiet(dir, project string, args ...string) (string, error) {
	full := append([]string{"compose", "-p", project}, args...)
	return RunQuiet(dir, full...)
}

// Discard is a sink for when we don't want to surface subprocess noise.
var Discard io.Writer = io.Discard
