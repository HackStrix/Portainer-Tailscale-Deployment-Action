/**
 * Portainer stack operations module.
 * Handles listing, creating, updating, and deleting stacks.
 */

import * as core from '@actions/core';
import { PortainerClient } from './client';
import {
    PortainerStack,
    CreateStackRequest,
    UpdateStackRequest,
    DeployResult,
} from './types';
import { StackEnvVar } from '../utils/env-parser';

/**
 * Lists all stacks for a given endpoint.
 */
export async function listStacks(
    client: PortainerClient,
    endpointId: number
): Promise<PortainerStack[]> {
    const stacks = await client.get<PortainerStack[]>(
        `/api/stacks?filters={"EndpointId":${endpointId}}`
    );
    core.debug(`Found ${stacks.length} stacks on endpoint ${endpointId}`);
    return stacks;
}

/**
 * Finds a stack by name on the specified endpoint.
 * Returns the stack if found, or null.
 */
export async function findStackByName(
    client: PortainerClient,
    name: string,
    endpointId: number
): Promise<PortainerStack | null> {
    const stacks = await listStacks(client, endpointId);
    const stack = stacks.find(
        (s) => s.Name === name && s.EndpointId === endpointId
    );

    if (stack) {
        core.info(`Found existing stack "${name}" (ID: ${stack.Id}, Status: ${stack.Status})`);
    } else {
        core.info(`Stack "${name}" does not exist on endpoint ${endpointId}`);
    }

    return stack || null;
}

/**
 * Creates a new standalone compose stack.
 */
export async function createStack(
    client: PortainerClient,
    endpointId: number,
    name: string,
    composeContent: string,
    envVars: StackEnvVar[]
): Promise<PortainerStack> {
    core.info(`Creating stack "${name}"...`);

    const body: CreateStackRequest = {
        name,
        stackFileContent: composeContent,
        env: envVars,
        fromAppTemplate: false,
    };

    // type=2 = standalone compose stack
    const stack = await client.post<PortainerStack>(
        `/api/stacks/create/standalone/string?endpointId=${endpointId}`,
        body
    );

    core.info(`✅ Stack "${name}" created (ID: ${stack.Id})`);
    return stack;
}

/**
 * Updates an existing stack with new compose content and env vars.
 */
export async function updateStack(
    client: PortainerClient,
    stackId: number,
    endpointId: number,
    composeContent: string,
    envVars: StackEnvVar[]
): Promise<PortainerStack> {
    core.info(`Updating stack ID ${stackId}...`);

    const body: UpdateStackRequest = {
        stackFileContent: composeContent,
        env: envVars,
        prune: true,     // Remove services no longer in compose file
        pullImage: true,  // Pull latest images
    };

    const stack = await client.put<PortainerStack>(
        `/api/stacks/${stackId}?endpointId=${endpointId}`,
        body
    );

    core.info(`✅ Stack "${stack.Name}" updated (ID: ${stack.Id})`);
    return stack;
}

/**
 * Deletes a stack by ID.
 */
export async function deleteStack(
    client: PortainerClient,
    stackId: number,
    endpointId: number
): Promise<void> {
    core.info(`Deleting stack ID ${stackId}...`);

    await client.delete(`/api/stacks/${stackId}?endpointId=${endpointId}`);

    core.info(`✅ Stack ${stackId} deleted`);
}

/**
 * Orchestrates stack deployment: finds the stack, then either creates or updates.
 */
export async function deployStack(
    client: PortainerClient,
    endpointId: number,
    stackName: string,
    composeContent: string,
    envVars: StackEnvVar[]
): Promise<DeployResult> {
    const existing = await findStackByName(client, stackName, endpointId);

    if (existing) {
        const updated = await updateStack(
            client,
            existing.Id,
            endpointId,
            composeContent,
            envVars
        );
        return { stackId: updated.Id, status: 'updated' };
    } else {
        const created = await createStack(
            client,
            endpointId,
            stackName,
            composeContent,
            envVars
        );
        return { stackId: created.Id, status: 'created' };
    }
}

/**
 * Orchestrates stack deletion: finds the stack by name and deletes it.
 */
export async function removeStack(
    client: PortainerClient,
    endpointId: number,
    stackName: string
): Promise<DeployResult> {
    const existing = await findStackByName(client, stackName, endpointId);

    if (!existing) {
        core.warning(`Stack "${stackName}" not found — nothing to delete`);
        return { stackId: 0, status: 'deleted' };
    }

    await deleteStack(client, existing.Id, endpointId);
    return { stackId: existing.Id, status: 'deleted' };
}
