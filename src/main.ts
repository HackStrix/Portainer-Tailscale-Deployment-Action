/**
 * Main entry point for the GitHub Action.
 * Orchestrates: Tailscale connect → Portainer deploy → Report.
 */

import * as core from '@actions/core';
import { getConfig } from './config';
import { getAuthKey } from './tailscale/auth';
import { connectTailscale } from './tailscale/connect';
import { PortainerClient } from './portainer/client';
import { deployStack, removeStack } from './portainer/stacks';
import { parseEnvVars } from './utils/env-parser';

async function run(): Promise<void> {
    try {
        // Step 1: Parse and validate inputs
        core.startGroup('📋 Configuration');
        const config = getConfig();
        core.info(`Stack: ${config.deployment.stackName}`);
        core.info(`Portainer: ${config.portainer.url}`);
        core.info(`Action: ${config.deployment.action}`);
        core.info(`TLS Skip Verify: ${config.deployment.tlsSkipVerify}`);
        core.endGroup();

        // Step 2: Authenticate with Tailscale
        core.startGroup('🔑 Tailscale Authentication');
        const authKey = await getAuthKey(config.tailscale);
        core.endGroup();

        // Step 3: Connect to Tailscale
        core.startGroup('🌐 Tailscale Connection');
        await connectTailscale({
            authKey,
            hostname: config.tailscale.hostname,
            connectTimeout: config.tailscale.connectTimeout,
            portainerUrl: config.portainer.url,
            tlsSkipVerify: config.deployment.tlsSkipVerify,
        });
        // Save state so the post-step knows we connected
        core.saveState('tailscale_connected', 'true');
        core.endGroup();

        // Step 4: Create Portainer client
        const portainerClient = new PortainerClient(
            config.portainer.url,
            config.portainer.apiKey,
            config.deployment.tlsSkipVerify
        );

        // Step 5: Parse env vars
        const envVars = parseEnvVars(config.deployment.envVarsRaw);
        if (envVars.length > 0) {
            core.info(`📦 ${envVars.length} environment variable(s) configured`);
        }

        // Step 6: Execute deployment action
        core.startGroup(`🚀 ${config.deployment.action === 'deploy' ? 'Deploying' : 'Deleting'} Stack`);

        let result;
        if (config.deployment.action === 'deploy') {
            result = await deployStack(
                portainerClient,
                config.deployment.endpointId,
                config.deployment.stackName,
                config.deployment.composeFileContent,
                envVars
            );
        } else {
            result = await removeStack(
                portainerClient,
                config.deployment.endpointId,
                config.deployment.stackName
            );
        }

        core.endGroup();

        // Step 7: Set outputs
        core.setOutput('stack_id', result.stackId.toString());
        core.setOutput('stack_status', result.status);

        core.info(`\n🎉 Done! Stack "${config.deployment.stackName}" — ${result.status} (ID: ${result.stackId})`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        core.setFailed(`❌ Deployment failed: ${message}`);
    }
}

run();
