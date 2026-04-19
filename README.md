# Octopus

AI Hub.

## Auto-deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which syncs the
repository to the target server over SSH and runs `scripts/server-deploy.sh`.
The workflow can also be started manually from the Actions tab
(`workflow_dispatch`).

### One-time setup

Add the following **Secrets** under
`Settings → Secrets and variables → Actions → Secrets`:

| Name                        | Required               | Purpose                                    |
| --------------------------- | ---------------------- | ------------------------------------------ |
| `DEPLOY_HOST`               | yes                    | Target host / IP (e.g. `152.53.249.230`)   |
| `DEPLOY_USER`               | yes                    | SSH user (e.g. `root`)                     |
| `DEPLOY_PASSWORD`           | one of password / key  | SSH password                               |
| `DEPLOY_SSH_KEY`            | one of password / key  | Private key (PEM), preferred over password |
| `DEPLOY_SSH_KEY_PASSPHRASE` | optional               | Passphrase for `DEPLOY_SSH_KEY`            |

And optionally under **Variables**:

| Name          | Default        | Purpose                       |
| ------------- | -------------- | ----------------------------- |
| `DEPLOY_PATH` | `/opt/octopus` | Remote directory for the code |
| `DEPLOY_PORT` | `22`           | SSH port                      |

> Prefer an SSH key over a password. Generate a key pair
> (`ssh-keygen -t ed25519 -C deploy@octopus`), append the public key to
> `~/.ssh/authorized_keys` on the server, and paste the private key into
> `DEPLOY_SSH_KEY`.

### Server-side hook

Stack-specific deploy steps (install, build, restart) live in
`scripts/server-deploy.sh`. It runs on the server after each successful sync.

Currently it installs [Caddy](https://caddyserver.com/) if missing and applies
`ops/Caddyfile`, which terminates HTTPS for `amorson.me` (auto Let's Encrypt).
To route the domain to an app (e.g. OpenClaw panel on `127.0.0.1:8080`),
uncomment the `reverse_proxy` line in `ops/Caddyfile` and push to `main`.
