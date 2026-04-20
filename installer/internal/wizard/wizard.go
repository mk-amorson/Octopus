package wizard

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"github.com/mk-amorson/Octopus/installer/internal/state"
)

// Answers holds everything the install wizard needs to collect before it
// starts building.
type Answers struct {
	BasePath string
	Host     string
	Port     int
}

// Run asks the installation questions on stdin and returns the collected
// answers. `prev` is the last-used config if Octopus was already installed,
// used to pre-fill sensible defaults on re-install.
func Run(prev *state.Config) (Answers, error) {
	r := bufio.NewReader(os.Stdin)
	fmt.Println()
	fmt.Println("  Octopus installer")
	fmt.Println("  -----------------")
	fmt.Println()

	defHost := "127.0.0.1"
	defBase := "/octopus"
	defPort := 3000
	if prev != nil {
		defHost = prev.Host
		defBase = prev.BasePath
		if prev.Port != 0 {
			defPort = prev.Port
		}
	}

	host, err := askHost(r, defHost)
	if err != nil {
		return Answers{}, err
	}
	base, err := askBasePath(r, defBase)
	if err != nil {
		return Answers{}, err
	}
	port, err := askPort(r, defPort)
	if err != nil {
		return Answers{}, err
	}
	return Answers{BasePath: base, Host: host, Port: port}, nil
}

func askHost(r *bufio.Reader, def string) (string, error) {
	fmt.Println("  How will you reach Octopus?")
	fmt.Println("    1) localhost only  (bind 127.0.0.1 — invisible to other machines)")
	fmt.Println("    2) all interfaces  (bind 0.0.0.0 — reachable from LAN / domain if you set up a reverse proxy yourself)")
	defChoice := "1"
	if def == "0.0.0.0" {
		defChoice = "2"
	}
	for {
		s, err := prompt(r, fmt.Sprintf("  choice [%s]: ", defChoice))
		if err != nil {
			return "", err
		}
		if s == "" {
			s = defChoice
		}
		switch s {
		case "1":
			return "127.0.0.1", nil
		case "2":
			return "0.0.0.0", nil
		}
		fmt.Println("  please enter 1 or 2")
	}
}

func askBasePath(r *bufio.Reader, def string) (string, error) {
	fmt.Println()
	fmt.Println("  What subpath should Octopus be served under?")
	fmt.Println("    press Enter to keep the default, or type a new one (e.g. /app, /hub).")
	fmt.Println("    Type / for the site root.")
	for {
		s, err := prompt(r, fmt.Sprintf("  subpath [%s]: ", displayBase(def)))
		if err != nil {
			return "", err
		}
		if s == "" {
			s = def
		}
		if s == "/" {
			return "", nil
		}
		if !strings.HasPrefix(s, "/") {
			s = "/" + s
		}
		// Strip trailing slash so Next.js basePath is happy.
		s = strings.TrimRight(s, "/")
		if s == "" {
			return "", nil
		}
		return s, nil
	}
}

func displayBase(b string) string {
	if b == "" {
		return "/"
	}
	return b
}

func askPort(r *bufio.Reader, def int) (int, error) {
	fmt.Println()
	fmt.Println("  Which host port should Octopus listen on?")
	for {
		s, err := prompt(r, fmt.Sprintf("  port [%d]: ", def))
		if err != nil {
			return 0, err
		}
		if s == "" {
			return def, nil
		}
		n, err := strconv.Atoi(s)
		if err != nil || n < 1 || n > 65535 {
			fmt.Println("  port must be a number between 1 and 65535")
			continue
		}
		return n, nil
	}
}

// Confirm prints the answers back and asks for a yes/no before we start
// doing anything irreversible (docker build, writing state).
func Confirm(a Answers) (bool, error) {
	r := bufio.NewReader(os.Stdin)
	fmt.Println()
	fmt.Println("  Ready to install with:")
	fmt.Printf("    host:    %s\n", a.Host)
	fmt.Printf("    port:    %d\n", a.Port)
	fmt.Printf("    subpath: %s\n", displayBase(a.BasePath))
	fmt.Println()
	for {
		s, err := prompt(r, "  proceed? [Y/n]: ")
		if err != nil {
			return false, err
		}
		s = strings.ToLower(s)
		if s == "" || s == "y" || s == "yes" {
			return true, nil
		}
		if s == "n" || s == "no" {
			return false, nil
		}
		fmt.Println("  please answer y or n")
	}
}

func prompt(r *bufio.Reader, q string) (string, error) {
	fmt.Print(q)
	line, err := r.ReadString('\n')
	if err != nil && err != io.EOF {
		return "", err
	}
	return strings.TrimSpace(line), nil
}
