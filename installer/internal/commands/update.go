package commands

import (
	"fmt"

	"github.com/mk-amorson/octopus/installer/internal/selfupdate"
	"github.com/mk-amorson/octopus/installer/internal/source"
	"github.com/mk-amorson/octopus/installer/internal/stack"
	"github.com/mk-amorson/octopus/installer/internal/state"
	"github.com/mk-amorson/octopus/installer/internal/version"
)

// Update walks the full upgrade path end-to-end:
//
//  1. If the `octopus` CLI itself is older than the latest release, it
//     downloads the new CLI binary, swaps it in for the running one, and
//     re-executes `octopus update`. The new CLI then takes over — it's
//     the only code that knows how to rebuild the app with whatever new
//     compose args / build args a given release introduces.
//  2. Otherwise the CLI is current; we just re-download the app source
//     at the latest tag and rebuild the Docker image + restart.
//
// The caller sees one command do everything. The only time this isn't
// true is the initial migration onto a CLI that ships Update — before
// that, the user re-runs the one-liner once to get the new binary in
// place.
func Update() error {
	cfg, err := requireInstalled()
	if err != nil {
		return err
	}

	latest, err := source.LatestTag()
	if err != nil {
		return err
	}
	fmt.Printf("cli:       %s\napp:       %s\nlatest:    %s\n",
		version.Current, cfg.Version, latest)

	if latest == version.Current && latest == cfg.Version && cfg.Token != "" {
		fmt.Println("already on the latest version.")
		return nil
	}

	if latest != version.Current {
		fmt.Printf("==> upgrading octopus CLI %s -> %s\n", version.Current, latest)
		if err := selfupdate.Apply(latest); err != nil {
			return fmt.Errorf("CLI self-update failed: %w", err)
		}
		fmt.Println("==> restarting with new CLI")
		// Re-exec never returns on Unix; on Windows it spawns a child
		// and os.Exit()s with its code.
		return selfupdate.ReExec("update")
	}

	// CLI is already current but the deployed app is behind.
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
	// --force-recreate so the container actually picks up env changes
	// (new OCTOPUS_TOKEN on fresh upgrades, new version label, etc).
	if err := stack.UpForce(srcDir); err != nil {
		return err
	}
	if cfg.Version != target {
		stack.RemoveImage(cfg.Version)
	}
	if err := state.Save(&next); err != nil {
		return err
	}
	fmt.Printf("updated to %s. Serving at %s\n", target, next.URL())
	if cfg.Token == "" {
		// Surface the fresh token so the user can copy it straight
		// out of the update output.
		fmt.Printf("admin token (this install had none before): %s\n", next.Token)
	}
	return nil
}
