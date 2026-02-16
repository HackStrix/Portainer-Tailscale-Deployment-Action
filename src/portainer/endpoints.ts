/**
 * Portainer endpoint (environment) operations.
 */

import * as core from '@actions/core';
import { PortainerClient } from './client';

interface PortainerEndpoint {
    Id: number;
    Name: string;
    Type: number;
    Status: number;
}

/**
 * Resolves the endpoint ID to use.
 * 
 * If an endpoint ID is provided (> 0), returns it directly.
 * Otherwise, fetches all endpoints and:
 *   - If exactly one exists, uses it automatically
 *   - If multiple exist, throws with a list so the user can pick
 *   - If none exist, throws an error
 */
export async function resolveEndpointId(
    client: PortainerClient,
    providedId: number
): Promise<number> {
    if (providedId > 0) {
        return providedId;
    }

    core.info('No endpoint_id specified — auto-detecting...');

    const endpoints = await client.get<PortainerEndpoint[]>('/api/endpoints');

    if (endpoints.length === 0) {
        throw new Error('No environments found in Portainer. Create one first.');
    }

    if (endpoints.length === 1) {
        core.info(`Auto-detected endpoint: "${endpoints[0].Name}" (ID: ${endpoints[0].Id})`);
        return endpoints[0].Id;
    }

    // Multiple endpoints — can't guess, list them for the user
    const list = endpoints
        .map((e) => `  - ID ${e.Id}: "${e.Name}"`)
        .join('\n');

    throw new Error(
        `Multiple environments found. Please specify endpoint_id:\n${list}`
    );
}
