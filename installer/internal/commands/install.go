package commands

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/mk-amorson/Octopus/installer/internal/caddy"
	"github.com/mk-amorson/Octopus/installer/internal/docker"
	"github.com/mk-amorson/Octopus/installer/internal/source"
	"github.com/mk-amorson/Octopus/installer/internal/stack"
	"github.com/mk-amorson/Octopus/installer/internal/state"
	"github.com/mk-amorson/Octopus/installer/internal/token"
	"github.com/mk-amorson/Octopus/installer/internal/version"
	"github.com/mk-amorson/Octopus/installer/internal/wizard"
)

// Install runs the full interactive install flow: Docker check → wizard →
// source download → image build → container start → optional Caddy setup
// → done banner. Safe to re-run; it just overwrites the previous install's
// config and rebuilds.
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
		Domain:   answers.Domain,
	}
	// Preserve the existing token on re-install so users don't have
	// to redistribute it every time they change the subpath / port.
	// Mint one only when there isn't one yet.
	if prev != nil && prev.Token != "" {
		cfg.Token = prev.Token
	} else {
		t, err := token.New()
		if err != nil {
			return fmt.Errorf("generate admin token: %w", err)
		}
		cfg.Token = t
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

	// Front Octopus with Caddy + HTTPS only after the container is up, so
	// the proxy has something to proxy to. Caddy failures shouldn't roll
	// back the install — the app still runs on the loopback port, and the
	// user can finish reverse-proxy setup by hand if need be.
	if cfg.Domain != "" {
		fmt.Printf("==> configuring Caddy to serve %s\n", cfg.Domain)
		if err := caddy.Setup(cfg.Domain, cfg.Port); err != nil {
			fmt.Printf("warning: Caddy setup failed: %v\n", err)
			fmt.Printf("Octopus is still running on http://127.0.0.1:%d%s — you can finish the proxy by hand.\n",
				cfg.Port, cfg.BasePath)
		}
	}

	if err := state.Save(cfg); err != nil {
		return err
	}

	fmt.Println()
	fmt.Println("  Octopus is up.")
	fmt.Printf("  %s\n", cfg.URL())
	fmt.Println()
	fmt.Println("  Admin token (also shown by `octopus token show`):")
	fmt.Printf("    %s\n", cfg.Token)
	fmt.Println()
	fmt.Println("  Manage it with: octopus start | stop | update | uninstall")
	fmt.Println("  Token commands: octopus token show | octopus token rotate")
	printPathHintIfNeeded()
	return nil
}

// printPathHintIfNeeded warns the user when `octopus` isn't on PATH in
// their current shell yet. The bootstrap appends an `export` to shell rc
// files, but that only takes effect on a new login. Without this hint
// "Octopus is up" is immediately followed by `octopus status` → "command
// not found", which is a confusing first experience.
//
// Skipped on Windows: the bootstrap uses SetEnvironmentVariable at User
// scope, which new terminals inherit. Already-open console windows don't,
// but there's no single one-liner that works across cmd and PowerShell.
func printPathHintIfNeeded() {
	if runtime.GOOS == "windows" {
		return
	}
	binDir, err := state.BinDir()
	if err != nil {
		return
	}
	for _, p := range strings.Split(os.Getenv("PATH"), ":") {
		if p == binDir {
			return
		}
	}
	fmt.Println()
	fmt.Println("  Note: new shells will pick up `octopus` on PATH automatically.")
	fmt.Println("  To use it in THIS shell right now, run:")
	fmt.Println()
	fmt.Printf("    export PATH=\"%s:$PATH\"\n", binDir)
}
