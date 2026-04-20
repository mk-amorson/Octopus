package docker

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
)

// Ensure verifies that `docker` and the compose plugin are both usable, with
// actionable error messages when they're not. Installing Docker itself is
// out of scope — the user installs Docker Desktop (macOS/Windows) or the
// engine (Linux) themselves. We only check.
func Ensure() error {
	if _, err := exec.LookPath("docker"); err != nil {
		return fmt.Errorf("docker not found in PATH. Install Docker Desktop (https://www.docker.com/products/docker-desktop/) on macOS/Windows, or Docker Engine on Linux, then re-run")
	}
	// `docker compose version` exits 0 only when both the daemon is reachable
	// and the compose plugin is present. Treat both failure modes the same —
	// the fix is on the user's side either way.
	var stderr bytes.Buffer
	cmd := exec.Command("docker", "compose", "version")
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("docker compose not usable: %w\n%s", err, stderr.String())
	}
	return nil
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
