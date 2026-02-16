# Portainer-Tailscale Deploy Action

A GitHub Action that creates a secure, temporary bridge to your private network via **Tailscale** to deploy or update stacks on a **Portainer** instance. No public ports, no VPN juggling — just secure CI/CD.

## Features

* **Zero-Config Tunneling** — Automatically joins your Tailnet using ephemeral nodes
* **Stack Lifecycle Management** — Create, update, or delete Portainer stacks via the API
* **Endpoint Auto-Detection** — Automatically finds your Portainer environment (single-endpoint setups need no config)
* **Private Registry Auth** — Configures GHCR, Docker Hub, or any private registry credentials in Portainer
* **Intelligent Connectivity Wait** — Retry logic with exponential backoff waits for route availability
* **Auto-Cleanup** — Post-step ensures the ephemeral node is always logged out, even on failures
* **MagicDNS Ready** — Supports both Tailscale IPs and MagicDNS hostnames

---

## Prerequisites

### 1. Tailscale Setup

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/oauth) → Settings → **OAuth Clients**
2. Click **"Generate OAuth Client"**
3. Select scopes: **`devices`** and **`auth_keys`** (read + write)
4. Copy the **Client ID** and **Secret** → store as GitHub Secrets:
   - `TS_OAUTH_CLIENT_ID`
   - `TS_OAUTH_SECRET`

### 2. Tailscale ACL Policy

Add `tag:ci` to your [ACL policy](https://login.tailscale.com/admin/acls/file) (required for OAuth):

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"]
  }
}
```

Optionally restrict the CI node's access:

```json
{
  "acls": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:server:9443"]
    }
  ]
}
```

### 3. Portainer Setup

1. In Portainer, go to **My Account** → **Access Tokens** → generate a new API key
2. Store it as GitHub Secret: `PORTAINER_API_KEY`

### 4. Private Registry (optional)

If your compose file references private images (e.g. from GHCR):

1. Create a GitHub PAT (classic) with `read:packages` scope
2. Store it as GitHub Secret: `GHCR_TOKEN`

---

## Usage

### Basic

```yaml
steps:
  - uses: actions/checkout@v4

  - name: Install Tailscale
    run: curl -fsSL https://tailscale.com/install.sh | sh

  - name: Deploy to Portainer
    uses: hackstrix/portainer-tailscale-deployment-action@v1
    with:
      ts_oauth_client_id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
      ts_oauth_secret: ${{ secrets.TS_OAUTH_SECRET }}
      portainer_url: 'https://my-server.tailnet.ts.net:9443'
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
      portainer_url: 'https://my-server.tailnet.ts.net:9443'
      portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}
      stack_name: 'my-app'
      compose_file: './docker-compose.yml'
      registry_url: 'ghcr.io'
      registry_username: 'your-username'
      registry_token: ${{ secrets.GHCR_TOKEN }}
```

### With Environment Variables

```yaml
  - name: Deploy to Portainer
    uses: hackstrix/portainer-tailscale-deployment-action@v1
    with:
      ts_oauth_client_id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
      ts_oauth_secret: ${{ secrets.TS_OAUTH_SECRET }}
      portainer_url: 'https://my-server.tailnet.ts.net:9443'
      portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}
      stack_name: 'my-app'
      compose_file: './docker-compose.yml'
      env_vars: |
        NODE_ENV=production
        DB_PASSWORD=${{ secrets.DB_PASS }}
```

### Using a Pre-generated Auth Key

If you prefer not to set up OAuth:

```yaml
  - name: Deploy to Portainer
    uses: hackstrix/portainer-tailscale-deployment-action@v1
    with:
      ts_authkey: ${{ secrets.TS_AUTHKEY }}
      portainer_url: 'https://my-server:9443'
      portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}
      stack_name: 'my-app'
```

> **Note:** Auth keys expire after 90 days max. OAuth clients don't expire.

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `ts_oauth_client_id` | No* | — | Tailscale OAuth Client ID |
| `ts_oauth_secret` | No* | — | Tailscale OAuth Client Secret |
| `ts_authkey` | No* | — | Pre-generated auth key (fallback) |
| `ts_tags` | No | `tag:ci` | ACL tags for the ephemeral node |
| `ts_hostname` | No | auto-generated | Tailscale hostname |
| `ts_connect_timeout` | No | `60` | Seconds to wait for route |
| `portainer_url` | **Yes** | — | Portainer URL (e.g. `https://host:9443`) |
| `portainer_api_key` | **Yes** | — | Portainer API key |
| `stack_name` | **Yes** | — | Stack name to deploy |
| `compose_file` | No | `./docker-compose.yml` | Path to compose file |
| `endpoint_id` | No | `0` (auto-detect) | Portainer environment ID |
| `env_vars` | No | — | Multiline `KEY=VALUE` env vars |
| `tls_skip_verify` | No | `false` | Skip TLS verification |
| `registry_url` | No | — | Registry URL (e.g. `ghcr.io`) |
| `registry_username` | No | — | Registry username |
| `registry_token` | No | — | Registry password/PAT |
| `action` | No | `deploy` | `deploy` or `delete` |

*\*Either (`ts_oauth_client_id` + `ts_oauth_secret`) OR `ts_authkey` must be provided.*

## Outputs

| Output | Description |
|---|---|
| `stack_id` | Portainer stack ID after deployment |
| `stack_status` | Result: `created`, `updated`, or `deleted` |

---

## How It Works

1. **Authenticate** — Gets an ephemeral auth key via Tailscale OAuth (or uses a provided key)
2. **Connect** — Runs `tailscale up` to join the tailnet as an ephemeral node
3. **Wait** — Retries until Portainer is reachable over the Tailscale route
4. **Configure Registry** — If credentials provided, creates/updates registry in Portainer
5. **Auto-Detect Endpoint** — If `endpoint_id` is `0`, fetches and uses the available endpoint
6. **Deploy** — Creates a new stack or updates the existing one via Portainer API
7. **Cleanup** — Post-step always runs `tailscale logout` to remove the ephemeral node

---

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build (compile + bundle with ncc)
npm run build

# The dist/ directory must be committed
```

---

## License

MIT
