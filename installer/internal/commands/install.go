package commands

import (
	"fmt"

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
	return nil
}
