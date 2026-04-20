package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// Config is persisted to <stateDir>/config.json and describes a single
// installation. The installer is single-tenant by design — one config per
// machine per user.
type Config struct {
	Version  string `json:"version"`
	BasePath string `json:"base_path"` // e.g. "/octopus" or "" (root)
	Host     string `json:"host"`      // "127.0.0.1" or "0.0.0.0"
	Port     int    `json:"port"`      // host-side port, container is always 3000
}

// URL returns the user-facing URL of the running instance.
func (c Config) URL() string {
	host := c.Host
	if host == "0.0.0.0" {
		host = "localhost"
	}
	return fmt.Sprintf("http://%s:%d%s", host, c.Port, c.BasePath)
}

// Dir returns the per-user directory the installer stores everything in:
// config, extracted source tree, logs. Chosen to be simple and the same
// shape across platforms — a dotfile dir in $HOME.
func Dir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("locate home dir: %w", err)
	}
	return filepath.Join(home, ".octopus"), nil
}

// BinDir is where the installer binary itself lives after bootstrap, and is
// added to the user's PATH by the bootstrap shim.
func BinDir() (string, error) {
	d, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "bin"), nil
}

// SourceDir is where the Octopus source tarball is extracted on install.
// docker compose runs out of this directory.
func SourceDir() (string, error) {
	d, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "src"), nil
}

// ConfigPath is the JSON file holding the current install's settings.
func ConfigPath() (string, error) {
	d, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(d, "config.json"), nil
}

// Load reads the current install's config. Returns (nil, nil) if no install
// exists yet — callers decide whether that's an error for their command.
func Load() (*Config, error) {
	p, err := ConfigPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", p, err)
	}
	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse %s: %w", p, err)
	}
	return &c, nil
}

// Save persists config.json, creating the state dir on first use.
func Save(c *Config) error {
	d, err := Dir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(d, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", d, err)
	}
	p := filepath.Join(d, "config.json")
	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	// 0600: config has no real secrets today, but keep the door closed in
	// case we add any later (e.g. admin tokens).
	return os.WriteFile(p, data, 0o600)
}

// Remove wipes the entire state directory. Used by `octopus uninstall`.
func Remove() error {
	d, err := Dir()
	if err != nil {
		return err
	}
	return os.RemoveAll(d)
}

// ComposeProject is the stable docker compose project name. All containers,
// networks, and volumes the installer creates are scoped under it.
const ComposeProject = "octopus"

// ContainerName is the name the web container is given so logs and `docker ps`
// stay readable.
const ContainerName = "octopus-web"

// PlatformLabel is a short human string ("linux/amd64") used in log output.
func PlatformLabel() string {
	return runtime.GOOS + "/" + runtime.GOARCH
}
