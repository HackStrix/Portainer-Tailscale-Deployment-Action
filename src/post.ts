/**
 * Post-action entry point.
 * Cleans up the Tailscale connection — runs even if the main action failed.
 */

import * as core from '@actions/core';
import { disconnectTailscale } from './tailscale/cleanup';

async function post(): Promise<void> {
    const wasConnected = core.getState('tailscale_connected');

    if (wasConnected !== 'true') {
        core.info('Tailscale was not connected — skipping cleanup');
        return;
    }

    core.startGroup('🧹 Tailscale Cleanup');
    await disconnectTailscale();
    core.endGroup();
}

post();
