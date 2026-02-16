/**
 * Tailscale cleanup module.
 * Ensures the ephemeral node is properly logged out.
 */

import * as core from '@actions/core';
import * as exec from '@actions/exec';

/**
 * Disconnects from Tailscale and cleans up the ephemeral node.
 *
 * This runs in the post-action step and is designed to be resilient —
 * errors during cleanup are logged as warnings, not failures.
 */
export async function disconnectTailscale(): Promise<void> {
    core.info('Cleaning up Tailscale connection...');

    try {
        // First, bring the interface down
        const downExit = await exec.exec('sudo', ['tailscale', 'down'], {
            ignoreReturnCode: true,
            silent: true,
        });

        if (downExit !== 0) {
            core.warning(`tailscale down exited with code ${downExit} (non-fatal)`);
        }

        // Then logout to remove the node from the tailnet
        const logoutExit = await exec.exec('sudo', ['tailscale', 'logout'], {
            ignoreReturnCode: true,
            silent: true,
        });

        if (logoutExit !== 0) {
            core.warning(`tailscale logout exited with code ${logoutExit} (non-fatal)`);
        }

        core.info('✅ Tailscale cleanup complete');
    } catch (error) {
        // Don't fail the entire action on cleanup errors
        const message = error instanceof Error ? error.message : String(error);
        core.warning(`Tailscale cleanup encountered an error: ${message}`);
    }
}
