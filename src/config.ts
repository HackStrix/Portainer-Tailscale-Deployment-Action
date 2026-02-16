/**
 * Configuration module — reads and validates GitHub Action inputs.
 */

import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

export interface TailscaleConfig {
    /** OAuth Client ID (if using OAuth flow) */
    oauthClientId: string;
    /** OAuth Client Secret (if using OAuth flow) */
    oauthSecret: string;
    /** Pre-generated auth key (fallback) */
    authKey: string;
    /** ACL tags for the ephemeral node */
    tags: string;
    /** Hostname for the ephemeral node */
    hostname: string;
    /** Seconds to wait for route availability */
    connectTimeout: number;
}

export interface PortainerConfig {
    /** Full base URL (e.g. https://host:9443) */
    url: string;
    /** API key for authentication */
    apiKey: string;
}

export interface DeploymentConfig {
    /** Stack name in Portainer */
    stackName: string;
    /** Path to the compose file */
    composeFilePath: string;
    /** Content of the compose file (read at config time) */
    composeFileContent: string;
    /** Portainer endpoint/environment ID */
    endpointId: number;
    /** Raw multiline env vars string */
    envVarsRaw: string;
    /** Skip TLS certificate verification */
    tlsSkipVerify: boolean;
    /** Action to perform */
    action: 'deploy' | 'delete';
}

export interface ActionConfig {
    tailscale: TailscaleConfig;
    portainer: PortainerConfig;
    deployment: DeploymentConfig;
}

/**
 * Reads and validates all GitHub Action inputs.
 * @returns Validated ActionConfig
 * @throws Error if required inputs are missing or invalid
 */
export function getConfig(): ActionConfig {
    // --- Tailscale ---
    const oauthClientId = core.getInput('ts_oauth_client_id');
    const oauthSecret = core.getInput('ts_oauth_secret');
    const authKey = core.getInput('ts_authkey');
    const tags = core.getInput('ts_tags') || '';
    const hostnameInput = core.getInput('ts_hostname');
    const connectTimeout = parseInt(core.getInput('ts_connect_timeout') || '60', 10);

    // Validate: check partial OAuth first for better error messages
    if (oauthClientId !== '' && oauthSecret === '') {
        throw new Error('ts_oauth_secret is required when ts_oauth_client_id is provided');
    }

    if (oauthClientId === '' && oauthSecret !== '') {
        throw new Error('ts_oauth_client_id is required when ts_oauth_secret is provided');
    }

    // Validate: need either OAuth creds or authkey
    const hasOAuth = oauthClientId !== '' && oauthSecret !== '';
    const hasAuthKey = authKey !== '';

    if (!hasOAuth && !hasAuthKey) {
        throw new Error(
            'Authentication required: provide either (ts_oauth_client_id + ts_oauth_secret) or ts_authkey'
        );
    }

    // Generate default hostname from GitHub run context
    const hostname =
        hostnameInput ||
        `gha-${process.env.GITHUB_REPOSITORY?.replace('/', '-') || 'ci'}-${process.env.GITHUB_RUN_ID || Date.now()}`;

    // --- Portainer ---
    const portainerUrl = core.getInput('portainer_url', { required: true });
    const portainerApiKey = core.getInput('portainer_api_key', { required: true });

    // --- Deployment ---
    const stackName = core.getInput('stack_name', { required: true });
    const composeFilePath = core.getInput('compose_file') || './docker-compose.yml';
    const endpointId = parseInt(core.getInput('endpoint_id') || '1', 10);
    const envVarsRaw = core.getInput('env_vars') || '';
    const tlsSkipVerify = core.getInput('tls_skip_verify') === 'true';
    const actionInput = core.getInput('action') || 'deploy';

    // Validate action
    if (actionInput !== 'deploy' && actionInput !== 'delete') {
        throw new Error(`Invalid action "${actionInput}" — must be "deploy" or "delete"`);
    }

    // Validate endpoint_id
    if (isNaN(endpointId) || endpointId < 1) {
        throw new Error(`Invalid endpoint_id "${core.getInput('endpoint_id')}" — must be a positive integer`);
    }

    // Validate connect timeout
    if (isNaN(connectTimeout) || connectTimeout < 1) {
        throw new Error(`Invalid ts_connect_timeout — must be a positive integer`);
    }

    // Read compose file
    const resolvedComposePath = path.resolve(composeFilePath);
    if (!fs.existsSync(resolvedComposePath)) {
        throw new Error(`Compose file not found: ${resolvedComposePath}`);
    }
    const composeFileContent = fs.readFileSync(resolvedComposePath, 'utf-8');

    return {
        tailscale: {
            oauthClientId,
            oauthSecret,
            authKey,
            tags,
            hostname,
            connectTimeout,
        },
        portainer: {
            url: portainerUrl.replace(/\/+$/, ''), // Strip trailing slashes
            apiKey: portainerApiKey,
        },
        deployment: {
            stackName,
            composeFilePath: resolvedComposePath,
            composeFileContent,
            endpointId,
            envVarsRaw,
            tlsSkipVerify,
            action: actionInput,
        },
    };
}
