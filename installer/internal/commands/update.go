package commands

import (
	"fmt"

	"github.com/mk-amorson/Octopus/installer/internal/source"
	"github.com/mk-amorson/Octopus/installer/internal/stack"
	"github.com/mk-amorson/Octopus/installer/internal/state"
)

// Update checks GitHub for a newer release tag and, if one exists, re-fetches
// the source tree at that tag and rebuilds the stack in place. Preserves the
// user's current host/port/subpath choices — they only get re-asked on a
// full reinstall.
//
// If no newer tag exists, Update still rebuilds the current version (useful
// when the installer binary has moved versions but the running stack hasn't).
func Update() error {
	cfg, err := requireInstalled()
	if err != nil {
		return err
	}

	latest, err := source.LatestTag()
	if err != nil {
		return err
	}
	fmt.Printf("installed: %s   latest: %s\n", cfg.Version, latest)
	if latest == cfg.Version {
		fmt.Println("already on the latest version. Nothing to do.")
		return nil
	}

	target := latest
	srcDir, err := state.SourceDir()
	if err != nil {
		return err
	}
	if err := source.Download(target, srcDir); err != nil {
		return err
	}

	next := *cfg
	next.Version = target
	if err := stack.Render(srcDir, next); err != nil {
		return err
	}
	fmt.Println("==> rebuilding web image")
	if err := stack.Build(srcDir); err != nil {
		return err
	}
	fmt.Println("==> restarting Octopus")
	if err := stack.Up(srcDir); err != nil {
		return err
	}
	// Drop the old image tag so the disk doesn't accumulate one per upgrade.
	if cfg.Version != target {
		stack.RemoveImage(cfg.Version)
	}
	if err := state.Save(&next); err != nil {
		return err
	}
	fmt.Printf("updated to %s. Serving at %s\n", target, next.URL())
	fmt.Println()
	fmt.Println("  note: this updated the app. To update the `octopus` CLI itself, re-run")
	fmt.Println("  the install one-liner from https://mk-amorson.github.io/Octopus/")
	return nil
}
