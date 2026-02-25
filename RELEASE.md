# Portainer-Tailscale Deploy Action v1.0.0

Deploy Docker Compose stacks to a private Portainer instance through a secure, ephemeral Tailscale tunnel. No public ports or VPN configuration required.

## Features

- **Secure Tailscale Tunneling** — Creates an ephemeral node that auto-cleans up after each run
- **Tailscale OAuth Support** — No manual key rotation; generates short-lived auth keys via OAuth
- **Stack Lifecycle Management** — Automatically creates new stacks or updates existing ones
- **Endpoint Auto-Detection** — Finds your Portainer environment automatically for single-endpoint setups
- **Private Registry Auth** — Configures GHCR, Docker Hub, or any private registry credentials in Portainer
- **Environment Variables** — Inject `KEY=VALUE` pairs into your stack at deploy time
- **Retry with Backoff** — Resilient to transient network issues during tunnel setup and API calls
- **Post-Step Cleanup** — `tailscale logout` always runs, even if the deployment fails

## Quick Start

```yaml
- name: Install Tailscale
  run: curl -fsSL https://tailscale.com/install.sh | sh

- name: Deploy to Portainer
  uses: hackstrix/portainer-tailscale-deployment-action@v1
  with:
    ts_oauth_client_id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    ts_oauth_secret: ${{ secrets.TS_OAUTH_SECRET }}
    portainer_url: https://my-server.tailnet.ts.net:9443
    portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}
    stack_name: 'my-app'
    compose_file: './docker-compose.yml'
```

### With Private Registry (GHCR)

```yaml
- name: Deploy to Portainer
  uses: hackstrix/portainer-tailscale-deployment-action@v1
  with:
    ts_oauth_client_id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    ts_oauth_secret: ${{ secrets.TS_OAUTH_SECRET }}
    portainer_url: https://my-server.tailnet.ts.net:9443
    portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}
    stack_name: 'my-app'
    compose_file: './docker-compose.yml'
    registry_url: 'ghcr.io'
    registry_username: 'your-username'
    registry_token: ${{ secrets.GHCR_TOKEN }}
```

## Prerequisites

1. **Tailscale**: Create an [OAuth client](https://login.tailscale.com/admin/settings/oauth) with `auth_keys` and `devices` scopes
2. **Tailscale ACL**: Add `"tag:ci": ["autogroup:admin"]` to your [ACL policy](https://login.tailscale.com/admin/acls/file) `tagOwners`
3. **Portainer**: Generate an API key under My Account → Access Tokens
4. **GitHub Secrets**: Add `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `PORTAINER_API_KEY`, and optionally `GHCR_TOKEN`

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `ts_oauth_client_id` | No | — | Tailscale OAuth Client ID |
| `ts_oauth_secret` | No | — | Tailscale OAuth Client Secret |
| `ts_authkey` | No | — | Pre-generated auth key (fallback) |
| `ts_tags` | No | `tag:ci` | ACL tags for ephemeral node |
| `ts_hostname` | No | auto | Tailscale node hostname |
| `ts_connect_timeout` | No | `60` | Seconds to wait for route |
| `portainer_url` | **Yes** | — | Portainer URL with port |
| `portainer_api_key` | **Yes** | — | Portainer API key |
| `stack_name` | **Yes** | — | Stack name in Portainer |
| `compose_file` | No | `./docker-compose.yml` | Compose file path |
| `endpoint_id` | No | `0` (auto) | Portainer environment ID |
| `env_vars` | No | — | Multiline `KEY=VALUE` env vars |
| `tls_skip_verify` | No | `false` | Skip TLS verification |
| `registry_url` | No | — | Registry URL (e.g. `ghcr.io`) |
| `registry_username` | No | — | Registry username |
| `registry_token` | No | — | Registry password/PAT |
| `action` | No | `deploy` | `deploy` or `delete` |

## Outputs

| Output | Description |
|---|---|
| `stack_id` | Portainer stack ID |
| `stack_status` | `created`, `updated`, or `deleted` |
