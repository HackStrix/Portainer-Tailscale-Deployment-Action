/**
 * Tailscale authentication module.
 * Handles OAuth client credentials flow and direct auth key passthrough.
 */

import * as core from '@actions/core';
import * as http from '@actions/http-client';

const TAILSCALE_OAUTH_TOKEN_URL = 'https://api.tailscale.com/api/v2/oauth/token';
const TAILSCALE_KEYS_URL = 'https://api.tailscale.com/api/v2/tailnet/-/keys';

interface OAuthTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
}

interface TailscaleKeyResponse {
    id: string;
    key: string;
    created: string;
    expires: string;
}

interface TailscaleAuthConfig {
    oauthClientId: string;
    oauthSecret: string;
    authKey: string;
    tags: string;
}

/**
 * Gets a Tailscale auth key for joining the tailnet.
 *
 * If a pre-generated auth key is provided, returns it directly.
 * Otherwise, uses the OAuth client credentials flow to:
 *   1. Get an access token
 *   2. Generate an ephemeral, single-use auth key
 *
 * @param config - Tailscale authentication configuration
 * @returns The auth key string
 */
export async function getAuthKey(config: TailscaleAuthConfig): Promise<string> {
    // Direct auth key passthrough
    if (config.authKey) {
        core.info('Using pre-generated Tailscale auth key');
        core.setSecret(config.authKey);
        return config.authKey;
    }

    core.info('Generating ephemeral auth key via Tailscale OAuth...');

    // Step 1: Get OAuth access token
    const accessToken = await getOAuthToken(config.oauthClientId, config.oauthSecret);

    // Step 2: Generate ephemeral auth key with tags
    const authKey = await generateAuthKey(accessToken, config.tags);

    // Mask the key from logs
    core.setSecret(authKey);

    return authKey;
}

/**
 * Gets an OAuth access token using client credentials grant.
 */
async function getOAuthToken(clientId: string, clientSecret: string): Promise<string> {
    const client = new http.HttpClient('portainer-tailscale-action');

    // Tailscale uses HTTP Basic auth with client_id:client_secret
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await client.post(
        TAILSCALE_OAUTH_TOKEN_URL,
        'grant_type=client_credentials',
        {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    );

    const statusCode = response.message.statusCode || 0;
    const body = await response.readBody();

    if (statusCode !== 200) {
        throw new Error(
            `Failed to get Tailscale OAuth token (HTTP ${statusCode}): ${body}. ` +
            'Check that your ts_oauth_client_id and ts_oauth_secret are correct.'
        );
    }

    const tokenResponse: OAuthTokenResponse = JSON.parse(body);
    core.setSecret(tokenResponse.access_token);
    return tokenResponse.access_token;
}

/**
 * Generates an ephemeral, single-use auth key using the Tailscale API.
 */
async function generateAuthKey(accessToken: string, tags: string): Promise<string> {
    const client = new http.HttpClient('portainer-tailscale-action');

    // Parse tags: "tag:ci,tag:deploy" → ["tag:ci", "tag:deploy"]
    const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t !== '');

    const createOptions: Record<string, unknown> = {
        reusable: false,
        ephemeral: true,
        preauthorized: true,
    };

    // Only include tags if provided — allows running without ACL tags configured
    if (tagList.length > 0) {
        createOptions.tags = tagList;
    } else {
        core.info('No tags specified — generating auth key without ACL tags');
    }

    const requestBody = {
        capabilities: {
            devices: {
                create: createOptions,
            },
        },
        expirySeconds: 300, // 5 minute expiry — plenty for a CI run
    };

    const response = await client.post(
        TAILSCALE_KEYS_URL,
        JSON.stringify(requestBody),
        {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        }
    );

    const statusCode = response.message.statusCode || 0;
    const body = await response.readBody();

    if (statusCode !== 200) {
        throw new Error(
            `Failed to generate Tailscale auth key (HTTP ${statusCode}): ${body}. ` +
            `Tags are REQUIRED for OAuth-generated keys. ` +
            `Add this to your Tailscale ACL policy under "tagOwners": { "${tags || 'tag:ci'}": ["autogroup:admin"] }. ` +
            'Also ensure your OAuth client has the "auth_keys" (write) and "devices" scopes.'
        );
    }

    const keyResponse: TailscaleKeyResponse = JSON.parse(body);
    core.info(`Generated ephemeral auth key (expires: ${keyResponse.expires})`);
    return keyResponse.key;
}
