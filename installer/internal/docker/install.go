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

// Ensure verifies that `docker` and the compose plugin are both usable on
// this machine. If either is missing it offers to install Docker
// interactively — the details vary by OS, but the commitment is the same:
// the installer either hands back a working Docker or a clear error with
// a next step.
//
//   - Linux:   runs the official https://get.docker.com script via sudo.
//   - macOS:   uses `brew install --cask docker` when Homebrew is present,
//              otherwise opens the Docker Desktop download page.
//   - Windows: uses `winget install Docker.DockerDesktop` when winget is
//              present, otherwise opens the Docker Desktop download page.
//
// On macOS/Windows Docker Desktop must be launched once by the user (TOS
// acceptance + background daemon start); Ensure returns an error telling
// them to re-run after that.
func Ensure() error {
	if ok, err := check(); ok {
		return err
	}
	fmt.Println()
	fmt.Println("  Docker is required but wasn't found on this machine.")
	if err := tryInstall(); err != nil {
		return err
	}
	ok, err := check()
	if err != nil {
		return fmt.Errorf("docker still not usable after install: %w", err)
	}
	if !ok {
		return fmt.Errorf("docker still not usable after install. Open the Docker app (macOS/Windows) or log out and back in (Linux), then re-run `octopus install`")
	}
	return nil
}

// check returns (true, nil) when docker AND a compose implementation
// are usable. Returns (false, nil) when docker is simply missing from
// PATH — that's the signal to offer install. Returns (false, err) when
// docker is present but compose isn't (daemon not running, no v2
// plugin and no v1 binary) — we surface the underlying message instead
// of offering install, since reinstalling won't help.
func check() (bool, error) {
	if _, err := exec.LookPath("docker"); err != nil {
		return false, nil
	}
	// Prefer the v2 plugin; accept v1 standalone as a fallback so users
	// on older distros without docker-compose-plugin aren't stranded.
	if err := exec.Command("docker", "compose", "version").Run(); err == nil {
		return true, nil
	}
	if _, err := exec.LookPath("docker-compose"); err == nil {
		return true, nil
	}
	var stderr bytes.Buffer
	cmd := exec.Command("docker", "compose", "version")
	cmd.Stderr = &stderr
	err := cmd.Run()
	return false, fmt.Errorf("docker compose not usable (tried v2 plugin and v1 standalone): %w\n%s", err, stderr.String())
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

func installLinux() error {
	fmt.Println("  I can install Docker Engine automatically via the official")
	fmt.Println("  script at https://get.docker.com. This requires sudo and")
	fmt.Println("  will add the docker-ce and docker-compose-plugin packages.")
	if !confirm("  install now? [Y/n]: ") {
		return fmt.Errorf("docker install declined")
	}
	// One bash pipeline so a single sudo prompt covers all steps and a
	// failure short-circuits instead of leaving half a Docker install.
	script := `set -e
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sudo sh /tmp/get-docker.sh
sudo systemctl enable --now docker || true
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  sudo usermod -aG docker "$SUDO_USER" || true
elif [ -n "${USER:-}" ] && [ "$USER" != "root" ]; then
  sudo usermod -aG docker "$USER" || true
fi
rm -f /tmp/get-docker.sh`
	cmd := exec.Command("bash", "-c", script)
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("docker install failed: %w", err)
	}
	// After usermod the current shell isn't in the docker group until
	// re-login; surface that now, not as a confusing compose failure later.
	if err := exec.Command("docker", "info").Run(); err != nil {
		fmt.Println()
		fmt.Println("  Docker installed, but your current shell isn't in the `docker` group yet.")
		fmt.Println("  Log out and back in (or run `newgrp docker`), then re-run `octopus install`.")
		return fmt.Errorf("re-login required for docker group membership")
	}
	return nil
}

func installDarwin() error {
	const url = "https://www.docker.com/products/docker-desktop/"
	if _, err := exec.LookPath("brew"); err == nil {
		fmt.Println("  Homebrew is available. I can install Docker Desktop via:")
		fmt.Println("    brew install --cask docker")
		if confirm("  install now? [Y/n]: ") {
			cmd := exec.Command("brew", "install", "--cask", "docker")
			cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
			if err := cmd.Run(); err == nil {
				_ = exec.Command("open", "-a", "Docker").Start()
				return fmt.Errorf("Docker Desktop installed. Launch it once to accept the TOS, then re-run `octopus install`")
			}
			fmt.Println("  brew install failed — falling back to manual install.")
		}
	}
	fmt.Println("  Install Docker Desktop from:")
	fmt.Println("    " + url)
	_ = exec.Command("open", url).Start()
	return fmt.Errorf("install Docker Desktop and launch it once, then re-run `octopus install`")
}

func installWindows() error {
	const url = "https://www.docker.com/products/docker-desktop/"
	if _, err := exec.LookPath("winget"); err == nil {
		fmt.Println("  winget is available. I can install Docker Desktop via:")
		fmt.Println("    winget install --id Docker.DockerDesktop")
		if confirm("  install now? [Y/n]: ") {
			cmd := exec.Command("winget", "install",
				"--id", "Docker.DockerDesktop",
				"--accept-package-agreements", "--accept-source-agreements")
			cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
			if err := cmd.Run(); err == nil {
				return fmt.Errorf("Docker Desktop installed. Launch it once, then re-run `octopus install` in a new terminal")
			}
			fmt.Println("  winget install failed — falling back to manual install.")
		}
	}
	fmt.Println("  Install Docker Desktop from:")
	fmt.Println("    " + url)
	_ = exec.Command("cmd", "/c", "start", url).Start()
	return fmt.Errorf("install Docker Desktop and launch it once, then re-run `octopus install`")
}

func confirm(prompt string) bool {
	fmt.Print(prompt)
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && err != io.EOF {
		return false
	}
	s := strings.TrimSpace(strings.ToLower(line))
	return s == "" || s == "y" || s == "yes"
}
