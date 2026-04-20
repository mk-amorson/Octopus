package commands

import (
	"fmt"

	"github.com/mk-amorson/Octopus/installer/internal/stack"
	"github.com/mk-amorson/Octopus/installer/internal/state"
	"github.com/mk-amorson/Octopus/installer/internal/token"
)

// Token dispatches `octopus token <sub>`. Kept as a nested switch
// rather than a separate subcommand library — stdlib-only, and the
// number of verbs here will stay small.
//
//	octopus token show     print the current admin token
//	octopus token rotate   generate a new token, recreate the
//	                       container so the new value is live
func Token(args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("usage: octopus token <show|rotate>")
	}
	switch args[0] {
	case "show":
		return tokenShow()
	case "rotate":
		return tokenRotate()
	default:
		return fmt.Errorf("unknown token subcommand %q (want show|rotate)", args[0])
	}
}

func tokenShow() error {
	cfg, err := requireInstalled()
	if err != nil {
		return err
	}
	if cfg.Token == "" {
		return fmt.Errorf("this install has no token yet. Run `octopus token rotate` to mint one")
	}
	fmt.Println(cfg.Token)
	return nil
}

func tokenRotate() error {
	cfg, err := requireInstalled()
	if err != nil {
		return err
	}
	newToken, err := token.New()
	if err != nil {
		return fmt.Errorf("generate token: %w", err)
	}
	next := *cfg
	next.Token = newToken

	srcDir, err := state.SourceDir()
	if err != nil {
		return err
	}
	if err := stack.Render(srcDir, next); err != nil {
		return fmt.Errorf("render compose: %w", err)
	}
	// `up -d` with a changed environment recreates the container —
	// docker compose diffs the env and notices the change. Build is
	// not needed because OCTOPUS_TOKEN is runtime, not build-time.
	if err := stack.Up(srcDir); err != nil {
		return fmt.Errorf("restart container: %w", err)
	}
	if err := state.Save(&next); err != nil {
		return err
	}
	fmt.Println(newToken)
	return nil
}
