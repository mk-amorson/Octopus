package commands

import (
	"fmt"
	"os"
	"runtime"

	"github.com/mk-amorson/Octopus/installer/internal/docker"
	"github.com/mk-amorson/Octopus/installer/internal/source"
	"github.com/mk-amorson/Octopus/installer/internal/stack"
	"github.com/mk-amorson/Octopus/installer/internal/state"
	"github.com/mk-amorson/Octopus/installer/internal/version"
	"github.com/mk-amorson/Octopus/installer/internal/wizard"
)

// Install runs the full interactive install flow: Docker check → wizard →
// source download → image build → container start → done banner. Safe to
// re-run; it just overwrites the previous install's config and rebuilds.
func Install() error {
	fmt.Printf("Octopus installer %s (%s)\n", version.Current, state.PlatformLabel())

	if err := docker.Ensure(); err != nil {
		return err
	}

	prev, err := state.Load()
	if err != nil {
		return err
	}
	answers, err := wizard.Run(prev)
	if err != nil {
		return err
	}
	ok, err := wizard.Confirm(answers)
	if err != nil {
		return err
	}
	if !ok {
		fmt.Println("cancelled.")
		return nil
	}

	cfg := &state.Config{
		Version:  version.Current,
		BasePath: answers.BasePath,
		Host:     answers.Host,
		Port:     answers.Port,
	}

	srcDir, err := state.SourceDir()
	if err != nil {
		return err
	}
	if err := source.Download(version.Current, srcDir); err != nil {
		return err
	}
	if err := stack.Render(srcDir, *cfg); err != nil {
		return fmt.Errorf("render compose: %w", err)
	}

	fmt.Println("==> building web image (first run takes a couple of minutes)")
	if err := stack.Build(srcDir); err != nil {
		return fmt.Errorf("docker build failed: %w", err)
	}
	fmt.Println("==> starting Octopus")
	if err := stack.Up(srcDir); err != nil {
		return fmt.Errorf("docker up failed: %w", err)
	}
	if err := state.Save(cfg); err != nil {
		return err
	}

	fmt.Println()
	fmt.Println("  Octopus is up.")
	fmt.Printf("  %s\n", cfg.URL())
	fmt.Println()
	fmt.Println("  Manage it with: octopus start | stop | update | uninstall")
	printPathHintIfNeeded()
	return nil
}

// printPathHintIfNeeded warns the user when `octopus` isn't on PATH in
// their current shell yet. The bootstrap appends an `export` to shell rc
// files, but that only takes effect on a new login. Without this hint the
// user sees "Octopus is up" and then `octopus status` → "command not
// found", which is a confusing first experience.
func printPathHintIfNeeded() {
	if runtime.GOOS == "windows" {
		// On Windows, the bootstrap already uses SetEnvironmentVariable at
		// User scope; new terminals inherit it. Console windows that were
		// already open don't, but there's no equivalent one-liner to
		// suggest here that works across cmd/PowerShell, so we stay quiet.
		return
	}
	binDir, err := state.BinDir()
	if err != nil {
		return
	}
	// If the binary is currently on PATH via the resolution the user's
	// shell will do, there's nothing to warn about.
	if onPath := os.Getenv("PATH"); containsDir(onPath, binDir) {
		return
	}
	fmt.Println()
	fmt.Println("  Note: new shells will pick up `octopus` on PATH automatically.")
	fmt.Println("  To use it in THIS shell right now, run:")
	fmt.Println()
	fmt.Printf("    export PATH=\"%s:$PATH\"\n", binDir)
}

func containsDir(path, dir string) bool {
	if path == "" || dir == "" {
		return false
	}
	sep := ":"
	if runtime.GOOS == "windows" {
		sep = ";"
	}
	for _, p := range splitList(path, sep) {
		if p == dir {
			return true
		}
	}
	return false
}

func splitList(s, sep string) []string {
	// tiny helper to avoid a strings import here; two lines is cheaper than
	// yet another import block.
	out := []string{}
	cur := ""
	for i := 0; i < len(s); i++ {
		if string(s[i]) == sep {
			out = append(out, cur)
			cur = ""
			continue
		}
		cur += string(s[i])
	}
	out = append(out, cur)
	return out
}
