// Package token generates and validates Octopus admin tokens. The token
// lives in ~/.octopus/config.json, is handed to the running container as
// an OCTOPUS_TOKEN environment variable, and is what the web UI checks
// against when a user types it into the TokenGate input.
package token

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
)

// byteLen is deliberately 32: hex-encoded that's 64 characters, enough
// entropy that offline guessing is out of scope without making the
// string awkward to read aloud when you have to.
const byteLen = 32

// New returns a freshly generated token suitable for storage and for
// passing into the container via its environment.
func New() (string, error) {
	b := make([]byte, byteLen)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("read random: %w", err)
	}
	return hex.EncodeToString(b), nil
}
