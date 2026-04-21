package version

// Current is the installer's own version, and — by design — the exact version
// of Octopus it installs. `octopus update` compares this against the latest
// release tag on GitHub and re-bootstraps if they differ.
//
// Overridden at release time via -ldflags "-X .../version.Current=vX.Y.Z".
var Current = "v0.1.20"

// Repo is the upstream GitHub slug the installer pulls releases and source
// archives from.
const Repo = "mk-amorson/Octopus"
