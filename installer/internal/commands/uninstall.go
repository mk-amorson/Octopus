package commands

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/mk-amorson/Octopus/installer/internal/caddy"
	"github.com/mk-amorson/Octopus/installer/internal/stack"
	"github.com/mk-amorson/Octopus/installer/internal/state"
)

// Uninstall tears everything down: container, image, state directory, and
// the Caddyfile we installed (if any). It prompts first because the
// action is destructive and irreversible.
func Uninstall() error {
	cfg, err := state.Load()
	if err != nil {
		return err
	}
	if cfg == nil {
		fmt.Println("octopus is not installed — nothing to remove")
		return nil
	}

	fmt.Printf("This will remove the Octopus container, its image, and everything under %s.\n", mustDir())
	if cfg.Domain != "" {
		fmt.Println("It will also delete /etc/caddy/Caddyfile (Caddy itself stays installed).")
	}
	fmt.Print("type 'yes' to confirm: ")
	r := bufio.NewReader(os.Stdin)
	line, _ := r.ReadString('\n')
	if strings.TrimSpace(strings.ToLower(line)) != "yes" {
		fmt.Println("cancelled.")
		return nil
	}

	srcDir, err := state.SourceDir()
	if err != nil {
		return err
	}
	// Best-effort: if compose is missing or already torn down, keep going —
	// we still want to wipe the state dir.
	if err := stack.DownHard(srcDir); err != nil {
		fmt.Printf("warning: docker compose down failed: %v\n", err)
	}
	stack.RemoveImage(cfg.Version)

	if cfg.Domain != "" {
		if err := caddy.Remove(); err != nil {
			fmt.Printf("warning: Caddy cleanup failed: %v\n", err)
		}
	}

	if err := state.Remove(); err != nil {
		return fmt.Errorf("remove state dir: %w", err)
	}
	fmt.Println("octopus fully removed.")
	fmt.Println("note: the installer binary itself is still in ~/.octopus/bin (now deleted) / your PATH entry — the shell rc line is harmless.")
	return nil
}

func mustDir() string {
	d, _ := state.Dir()
	return d
}
