# 🚀 Portainer-Tailscale Deploy Action

A GitHub Action that creates a secure, temporary bridge to your private network via **Tailscale** to deploy or update stacks on a **Portainer** instance. No public ports, no VPN juggling—just secure CI/CD.

## ✨ Features

* **Zero-Config Tunneling:** Automatically joins your Tailnet using ephemeral nodes
* **Stack Lifecycle Management:** Create, update, or delete Portainer stacks via the API
* **Intelligent Connectivity Wait:** Built-in retry logic that waits for the Tailscale route to be fully routable
* **Auto-Cleanup:** Post-step ensures the ephemeral node is always logged out, even on failures
* **MagicDNS Ready:** Supports both Tailscale IPs and MagicDNS hostnames
* **Compose-First:** Seamless multi-container `docker-compose.yml` deployments

---

## 🔧 Prerequisites

### Tailscale Setup (5 min, one-time)

1. Go to [Tailscale Admin Console](https://login.tailscale.com/admin/settings/oauth) → Settings → **OAuth Clients**
2. Click **"Generate OAuth Client"**
3. Select scopes: **`devices`** and **`auth_keys`** (read + write)
4. Assign a tag like **`tag:ci`**
5. Copy the **Client ID** and **Secret** → store as GitHub Secrets:
   - `TS_OAUTH_CLIENT_ID`
   - `TS_OAUTH_SECRET`

### Portainer Setup

1. In Portainer, go to **My Account** → **Access Tokens** → generate a new API key
2. Store it as GitHub Secret: `PORTAINER_API_KEY`
3. Note your **Endpoint ID** (usually `1` for local)

### Recommended ACL Rule (Optional)

Restrict the CI node's access in your Tailscale ACL policy:

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

---

## 🚀 Usage

```yaml
- name: Deploy to Private Portainer
  uses: your-username/portainer-tailscale-deploy-action@v1
  with:
    # Tailscale (OAuth — recommended)
    ts_oauth_client_id: ${{ secrets.TS_OAUTH_CLIENT_ID }}
    ts_oauth_secret: ${{ secrets.TS_OAUTH_SECRET }}
    ts_tags: 'tag:ci'

    # Portainer
    portainer_url: 'https://my-nas.tailnet-name.ts.net:9443'
    portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}

    # Deployment
    stack_name: 'my-app'
    compose_file: './docker-compose.yml'
    endpoint_id: 1
    env_vars: |
      NODE_ENV=production
      DB_PASSWORD=${{ secrets.DB_PASS }}
```

### Using a Pre-generated Auth Key

If you prefer not to set up OAuth, you can use a pre-generated Tailscale auth key:

```yaml
- name: Deploy to Private Portainer
  uses: your-username/portainer-tailscale-deploy-action@v1
  with:
    ts_authkey: ${{ secrets.TS_AUTHKEY }}
    portainer_url: 'https://my-nas:9443'
    portainer_api_key: ${{ secrets.PORTAINER_API_KEY }}
    stack_name: 'my-app'
    compose_file: './docker-compose.yml'
```

> **Note:** Auth keys expire after 90 days max. OAuth clients don't expire.

---

## 📋 Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `ts_oauth_client_id` | No* | — | Tailscale OAuth Client ID |
| `ts_oauth_secret` | No* | — | Tailscale OAuth Client Secret |
| `ts_authkey` | No* | — | Pre-generated auth key (fallback) |
| `ts_tags` | No | `tag:ci` | ACL tags for the ephemeral node |
| `ts_hostname` | No | Auto-generated | Tailscale hostname |
| `ts_connect_timeout` | No | `60` | Seconds to wait for route |
| `portainer_url` | **Yes** | — | Portainer URL (e.g. `https://host:9443`) |
| `portainer_api_key` | **Yes** | — | Portainer API key |
| `stack_name` | **Yes** | — | Stack name to deploy |
| `compose_file` | No | `./docker-compose.yml` | Path to compose file |
| `endpoint_id` | No | `1` | Portainer endpoint ID |
| `env_vars` | No | — | Multiline `KEY=VALUE` env vars |
| `tls_skip_verify` | No | `false` | Skip TLS verification |
| `action` | No | `deploy` | `deploy` or `delete` |

*\*Either (`ts_oauth_client_id` + `ts_oauth_secret`) OR `ts_authkey` must be provided.*

## 📋 Outputs

| Output | Description |
|---|---|
| `stack_id` | Portainer stack ID after deployment |
| `stack_status` | Result: `created`, `updated`, or `deleted` |

---

## 🏗️ Development

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

## 📄 License

MIT
