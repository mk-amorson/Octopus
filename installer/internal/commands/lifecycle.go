package commands

import (
	"fmt"

	"github.com/mk-amorson/Octopus/installer/internal/stack"
	"github.com/mk-amorson/Octopus/installer/internal/state"
)

// Start brings the web service back up after an `octopus stop`. It refuses
// to run before an install exists, because there's nothing to start — better
// to say so than to bury the user in a confusing compose error.
func Start() error {
	cfg, err := requireInstalled()
	if err != nil {
		return err
	}
	srcDir, err := state.SourceDir()
	if err != nil {
		return err
	}
	if err := stack.Up(srcDir); err != nil {
		return err
	}
	fmt.Printf("octopus running at %s\n", cfg.URL())
	return nil
}

// Stop shuts the container down but preserves the built image and state,
// so Start is fast.
func Stop() error {
	if _, err := requireInstalled(); err != nil {
		return err
	}
	srcDir, err := state.SourceDir()
	if err != nil {
		return err
	}
	if err := stack.Down(srcDir); err != nil {
		return err
	}
	fmt.Println("octopus stopped")
	return nil
}

// Status prints whether Octopus is currently up and, if so, its URL. Cheap
// command for checking in without touching compose.
func Status() error {
	cfg, err := state.Load()
	if err != nil {
		return err
	}
	if cfg == nil {
		fmt.Println("octopus: not installed")
		return nil
	}
	up, err := stack.Running()
	if err != nil {
		return err
	}
	if up {
		fmt.Printf("octopus: running at %s (version %s)\n", cfg.URL(), cfg.Version)
	} else {
		fmt.Printf("octopus: stopped (version %s, would serve at %s)\n", cfg.Version, cfg.URL())
	}
	return nil
}

// requireInstalled is the common guard for commands that operate on an
// existing install.
func requireInstalled() (*state.Config, error) {
	cfg, err := state.Load()
	if err != nil {
		return nil, err
	}
	if cfg == nil {
		return nil, fmt.Errorf("octopus is not installed yet. Run `octopus install` first")
	}
	return cfg, nil
}
