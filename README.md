# Octopus

Self-hosted single-user web app. Installer pulls the source for the latest GitHub release, builds it under Docker on your machine, and runs it locally. No hosted control plane, no telemetry.

## Install

**Linux / macOS**

```sh
curl -fsSL https://mk-amorson.github.io/octopus/install | sh
```

**Windows (PowerShell)**

```powershell
iwr -useb https://mk-amorson.github.io/octopus/install.ps1 | iex
```

## Commands

| | |
| --- | --- |
| `octopus install`      | interactive install (host / subpath / port) |
| `octopus start`        | start the container |
| `octopus stop`         | stop the container (state kept) |
| `octopus status`       | show whether it's running and its URL |
| `octopus update`       | upgrade CLI and app to the latest release |
| `octopus token show`   | print the current admin token |
| `octopus token rotate` | mint a new admin token and restart |
| `octopus uninstall`    | remove container, image, and local state |
