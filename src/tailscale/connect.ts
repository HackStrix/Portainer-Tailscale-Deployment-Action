/**
 * Tailscale connection module.
 * Handles `tailscale up` and waits for the route to become available.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as http from '@actions/http-client';
import { retry } from '../utils/retry';

interface TailscaleStatus {
    BackendState: string;
    Self: {
        TailscaleIPs: string[];
        Online: boolean;
    };
}

interface ConnectConfig {
    authKey: string;
    hostname: string;
    connectTimeout: number;
    portainerUrl: string;
    tlsSkipVerify: boolean;
}

/**
 * Connects to Tailscale using the provided auth key.
 *
 * 1. Runs `tailscale up` with ephemeral mode
 * 2. Waits until the Tailscale interface is online
 * 3. Verifies connectivity to the Portainer URL
 *
 * @param config - Connection configuration
 */
export async function connectTailscale(config: ConnectConfig): Promise<void> {
    core.info(`Connecting to Tailscale as "${config.hostname}"...`);

    // Start tailscale
    const args = [
        'up',
        `--authkey=${config.authKey}`,
        `--hostname=${config.hostname}`,
        '--accept-routes',
    ];

    const exitCode = await exec.exec('sudo', ['tailscale', ...args], {
        silent: true, // Don't leak the authkey in logs
    });

    if (exitCode !== 0) {
        throw new Error(
            `tailscale up failed with exit code ${exitCode}. ` +
            'Ensure tailscale is installed on the runner (install via: curl -fsSL https://tailscale.com/install.sh | sh).'
        );
    }

    core.info('Tailscale started. Waiting for route to become available...');

    // Wait for tailscale to be fully connected
    await waitForTailscaleOnline(config.connectTimeout);

    // Verify we can reach the Portainer URL
    await waitForPortainerReachable(
        config.portainerUrl,
        config.connectTimeout,
        config.tlsSkipVerify
    );

    core.info('✅ Tailscale connected and Portainer is reachable');
}

/**
 * Waits for the Tailscale backend to report "Running" status.
 */
async function waitForTailscaleOnline(timeoutSeconds: number): Promise<void> {
    const maxAttempts = Math.ceil(timeoutSeconds / 2);

    await retry(
        async () => {
            let stdout = '';
            await exec.exec('tailscale', ['status', '--json'], {
                listeners: {
                    stdout: (data: Buffer) => {
                        stdout += data.toString();
                    },
                },
                silent: true,
            });

            const status: TailscaleStatus = JSON.parse(stdout);

            if (status.BackendState !== 'Running') {
                throw new Error(`Tailscale backend state: ${status.BackendState} (waiting for "Running")`);
            }

            if (!status.Self?.Online) {
                throw new Error('Tailscale node is not yet online');
            }

            core.info(
                `Tailscale online — IPs: ${status.Self.TailscaleIPs?.join(', ') || 'unknown'}`
            );
        },
        {
            maxAttempts,
            initialDelayMs: 2000,
            maxDelayMs: 4000,
            backoffMultiplier: 1.5,
            onRetry: (attempt, error) => {
                core.info(`[${attempt}/${maxAttempts}] ${error.message}`);
            },
        }
    );
}

/**
 * Waits for the Portainer URL to respond (even with a self-signed cert error).
 * This confirms the Tailscale route is fully established.
 */
async function waitForPortainerReachable(
    portainerUrl: string,
    timeoutSeconds: number,
    tlsSkipVerify: boolean
): Promise<void> {
    const maxAttempts = Math.ceil(timeoutSeconds / 3);

    // Temporarily allow self-signed certs for the reachability check
    const originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (tlsSkipVerify) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    try {
        await retry(
            async () => {
                const client = new http.HttpClient('portainer-tailscale-action', undefined, {
                    allowRetries: false,
                });

                try {
                    const response = await client.get(`${portainerUrl}/api/status`);
                    const statusCode = response.message.statusCode || 0;

                    if (statusCode >= 500) {
                        throw new Error(`Portainer responded with HTTP ${statusCode}`);
                    }

                    core.info(`Portainer reachable (HTTP ${statusCode})`);
                } catch (error) {
                    // If TLS verification is being skipped, rethrow connection errors
                    // but accept cert errors as "reachable"
                    if (
                        error instanceof Error &&
                        error.message.includes('ECONNREFUSED')
                    ) {
                        throw new Error(
                            `Cannot connect to Portainer at ${portainerUrl} — ` +
                            'the route may not be available yet'
                        );
                    }
                    throw error;
                }
            },
            {
                maxAttempts,
                initialDelayMs: 2000,
                maxDelayMs: 5000,
                backoffMultiplier: 2,
                onRetry: (attempt, error) => {
                    core.info(`[${attempt}/${maxAttempts}] Waiting for Portainer: ${error.message}`);
                },
            }
        );
    } finally {
        // Restore original TLS setting
        if (originalTlsReject !== undefined) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject;
        } else if (tlsSkipVerify) {
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
        }
    }
}
