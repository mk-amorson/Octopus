package source

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mk-amorson/Octopus/installer/internal/version"
)

// Download fetches the source tarball for tag `tag` (e.g. "v0.1.0") from
// GitHub's automatic archive endpoint and extracts it into destDir, stripping
// the top-level `<repo>-<sha>/` directory so destDir ends up containing the
// repo root directly (package.json at destDir/package.json, etc).
//
// Uses the codeload endpoint because it's the same URL GitHub shows in the UI
// and doesn't require auth for public repos.
func Download(tag, destDir string) error {
	url := fmt.Sprintf("https://codeload.github.com/%s/tar.gz/refs/tags/%s", version.Repo, tag)
	fmt.Printf("==> fetching source %s\n", url)

	client := &http.Client{Timeout: 120 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "octopus-installer/"+version.Current)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch tarball: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch tarball: HTTP %s (tag %q may not exist yet)", resp.Status, tag)
	}

	if err := os.RemoveAll(destDir); err != nil {
		return fmt.Errorf("clean %s: %w", destDir, err)
	}
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", destDir, err)
	}

	gz, err := gzip.NewReader(resp.Body)
	if err != nil {
		return fmt.Errorf("gunzip: %w", err)
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("read tar: %w", err)
		}
		// Strip the "<repo>-<sha>/" prefix GitHub adds.
		parts := strings.SplitN(h.Name, "/", 2)
		if len(parts) < 2 || parts[1] == "" {
			continue
		}
		rel := parts[1]
		// Defend against tar entries that try to escape destDir.
		if strings.Contains(rel, "..") {
			return fmt.Errorf("refusing tar entry with ..: %s", h.Name)
		}
		target := filepath.Join(destDir, rel)

		switch h.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0o755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
				return err
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(h.Mode)&0o777)
			if err != nil {
				return err
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return err
			}
			f.Close()
		case tar.TypeSymlink:
			// Next.js source doesn't have symlinks, but skip them defensively
			// rather than creating dangling ones.
			continue
		}
	}
	return nil
}

// LatestTag resolves the newest release tag on GitHub for Repo. Uses the
// unauthenticated `/releases/latest` JSON endpoint — 60 req/hr per IP is
// plenty for an end-user machine.
func LatestTag() (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases/latest", version.Repo)
	client := &http.Client{Timeout: 20 * time.Second}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "octopus-installer/"+version.Current)
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch latest release: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fetch latest release: HTTP %s", resp.Status)
	}
	var body struct {
		TagName string `json:"tag_name"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", fmt.Errorf("parse release json: %w", err)
	}
	if body.TagName == "" {
		return "", fmt.Errorf("release json had empty tag_name")
	}
	return body.TagName, nil
}
