// Command octopus is the Octopus installer and lifecycle CLI. It runs on
// Linux, macOS, and Windows, uses Docker on the host to actually run the
// app, and talks only to GitHub — no home server, no hosted control plane.
package main

import (
	"fmt"
	"os"

	"github.com/mk-amorson/octopus/installer/internal/commands"
	"github.com/mk-amorson/octopus/installer/internal/version"
)

const usage = `octopus — self-hosted installer for the Octopus app

usage:
  octopus install         interactive install (choose host / subpath / port)
  octopus start           start the local stack if it was stopped
  octopus stop            stop the local stack (state kept)
  octopus status          show whether Octopus is running and its URL
  octopus update          upgrade the app to the latest GitHub release
  octopus uninstall       remove the container, image, and all local state
  octopus token show      print the current admin token
  octopus token rotate    mint a new admin token and restart the container
  octopus version         print installer version and exit
  octopus help            show this message

Everything runs under Docker on this machine. No data leaves it.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Print(usage)
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "install":
		err = commands.Install()
	case "start":
		err = commands.Start()
	case "stop":
		err = commands.Stop()
	case "status":
		err = commands.Status()
	case "update", "upgrade":
		err = commands.Update()
	case "uninstall":
		err = commands.Uninstall()
	case "token":
		err = commands.Token(os.Args[2:])
	case "version", "-v", "--version":
		fmt.Println(version.Current)
	case "help", "-h", "--help":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", os.Args[1])
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}
