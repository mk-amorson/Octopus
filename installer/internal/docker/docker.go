// Package docker is a tiny wrapper around the host's `docker` CLI. We keep
// the surface minimal on purpose — the installer never speaks to the Docker
// Engine API directly, only through the binary that's already on PATH, which
// makes it trivial to reason about and means no Go dependency on the Docker
// client.
//
// Run/RunQuiet execute one-shot docker subcommands; Compose/ComposeQuiet
// prepend "compose -p <project>" so every call the installer makes lands in
// the same docker-compose project namespace (state.ComposeProject). That
// scoping is what makes `octopus uninstall` a clean wipe.
package docker

import (
	"bytes"
	"os"
	"os/exec"
	"sync"
)

// Run streams docker subcommand output to the user's terminal. For long
// operations (build, up) where the live progress is the whole point.
func Run(dir string, args ...string) error {
	cmd := exec.Command("docker", args...)
	cmd.Dir = dir
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	return cmd.Run()
}

// RunQuiet captures stdout+stderr instead of streaming them. For short
// status probes where raw output would just be noise.
func RunQuiet(dir string, args ...string) (string, error) {
	cmd := exec.Command("docker", args...)
	cmd.Dir = dir
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	return out.String(), err
}

// composeBinOnce resolves which binary speaks compose on this host and
// caches the answer. Modern Docker ships `docker compose` (v2 plugin)
// as a subcommand; older hosts only have the standalone `docker-compose`
// (v1) binary. We prefer v2 but transparently fall back so the rest of
// the installer never has to care which is present.
var (
	composeBinOnce sync.Once
	composeBin     []string // e.g. ["docker", "compose"] or ["docker-compose"]
)

func resolveCompose() []string {
	composeBinOnce.Do(func() {
		if err := exec.Command("docker", "compose", "version").Run(); err == nil {
			composeBin = []string{"docker", "compose"}
			return
		}
		if _, err := exec.LookPath("docker-compose"); err == nil {
			composeBin = []string{"docker-compose"}
			return
		}
		// Fall back to the v2 invocation so the error message the user
		// sees mentions the documented subcommand form.
		composeBin = []string{"docker", "compose"}
	})
	return composeBin
}

// composeArgs builds the full arg vector for a `compose` invocation,
// independent of whether the host speaks v2-plugin or v1-standalone.
func composeArgs(project string, args []string) (string, []string) {
	bin := resolveCompose()
	full := append([]string{}, bin[1:]...)
	full = append(full, "-p", project)
	full = append(full, args...)
	return bin[0], full
}

// Compose prepends `compose -p <project>` to keep every call scoped to the
// same docker-compose project.
func Compose(dir, project string, args ...string) error {
	name, full := composeArgs(project, args)
	cmd := exec.Command(name, full...)
	cmd.Dir = dir
	cmd.Stdout, cmd.Stderr, cmd.Stdin = os.Stdout, os.Stderr, os.Stdin
	return cmd.Run()
}

// ComposeQuiet is Compose + RunQuiet.
func ComposeQuiet(dir, project string, args ...string) (string, error) {
	name, full := composeArgs(project, args)
	cmd := exec.Command(name, full...)
	cmd.Dir = dir
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	return out.String(), err
}
