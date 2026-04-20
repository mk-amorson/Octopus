// Package selfupdate replaces the running `octopus` binary with a newer
// release. It mirrors what the bootstrap shim does (download, SHA256
// verify, install), but from inside the process itself — so `octopus
// update` can upgrade both the CLI and the app in a single command.
package selfupdate

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/mk-amorson/Octopus/installer/internal/version"
)

// Apply fetches the CLI binary for `tag`, verifies its SHA256 against
// the release's checksums.txt, and atomically swaps it in over this
// process's executable on disk. Returns nil once the new file is in
// place; the caller is expected to immediately ReExec so that the old
// in-memory process hands off to the new binary.
func Apply(tag string) error {
	osName := runtime.GOOS
	arch := runtime.GOARCH
	asset := fmt.Sprintf("octopus_%s_%s", osName, arch)
	if osName == "windows" {
		asset += ".exe"
	}
	base := fmt.Sprintf("https://github.com/%s/releases/download/%s", version.Repo, tag)

	client := &http.Client{Timeout: 2 * time.Minute}

	tmpDir, err := os.MkdirTemp("", "octopus-selfupdate-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	binPath := filepath.Join(tmpDir, asset)
	if err := download(client, base+"/"+asset, binPath); err != nil {
		return err
	}
	sumsPath := filepath.Join(tmpDir, "checksums.txt")
	if err := download(client, base+"/checksums.txt", sumsPath); err != nil {
		return err
	}

	if err := verifyChecksum(binPath, sumsPath, asset); err != nil {
		return err
	}
	if err := os.Chmod(binPath, 0o755); err != nil {
		return err
	}

	self, err := os.Executable()
	if err != nil {
		return err
	}
	// Follow the symlink if `octopus` was resolved via one — we want to
	// replace the real file, not the link.
	if resolved, err := filepath.EvalSymlinks(self); err == nil {
		self = resolved
	}
	return replaceFile(binPath, self)
}

// ReExec replaces the current process with the freshly-installed binary,
// passing `args` as its argv[1:]. On Unix this is an execve — same PID,
// same terminal, no lingering process. On Windows the old exe file is
// held open, so we spawn a child, wait, and propagate its exit code.
func ReExec(args ...string) error {
	self, err := os.Executable()
	if err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		cmd := exec.Command(self, args...)
		cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
		if err := cmd.Run(); err != nil {
			if ee, ok := err.(*exec.ExitError); ok {
				os.Exit(ee.ExitCode())
			}
			return err
		}
		os.Exit(0)
	}
	return syscall.Exec(self, append([]string{self}, args...), os.Environ())
}

// replaceFile swaps src in for dst. On Unix a bare rename works: the
// kernel lets us overwrite the file a running process opened because
// the process holds its own inode. On Windows the running exe is
// locked against deletion but can be renamed, so we move the old file
// aside first and best-effort clean it up on the next run.
func replaceFile(src, dst string) error {
	if runtime.GOOS == "windows" {
		old := dst + ".old"
		_ = os.Remove(old)
		if err := os.Rename(dst, old); err != nil {
			return fmt.Errorf("move old exe: %w", err)
		}
		if err := os.Rename(src, dst); err != nil {
			// Try to put the old one back so we don't leave the user
			// with no binary at all.
			_ = os.Rename(old, dst)
			return err
		}
		return nil
	}
	return os.Rename(src, dst)
}

func verifyChecksum(binPath, sumsPath, asset string) error {
	sums, err := os.ReadFile(sumsPath)
	if err != nil {
		return err
	}
	var want string
	for _, line := range strings.Split(string(sums), "\n") {
		// goreleaser writes "<sha>  <filename>" with two spaces.
		if strings.HasSuffix(line, " "+asset) {
			if fields := strings.Fields(line); len(fields) > 0 {
				want = fields[0]
				break
			}
		}
	}
	if want == "" {
		return fmt.Errorf("no checksum entry for %s", asset)
	}
	got, err := sha256File(binPath)
	if err != nil {
		return err
	}
	if !strings.EqualFold(got, want) {
		return fmt.Errorf("checksum mismatch for %s: want %s got %s", asset, want, got)
	}
	return nil
}

func sha256File(p string) (string, error) {
	f, err := os.Open(p)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func download(c *http.Client, url, dst string) error {
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "octopus-installer/"+version.Current)
	resp, err := c.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: HTTP %s", url, resp.Status)
	}
	f, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, resp.Body)
	return err
}
