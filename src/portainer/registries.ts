/**
 * Portainer registry management — ensures private registries are configured
 * so Docker can pull images during stack deployment.
 */

import * as core from '@actions/core';
import { PortainerClient } from './client';

interface PortainerRegistry {
    Id: number;
    Name: string;
    URL: string;
    Type: number;
    Authentication: boolean;
    Username: string;
}

/**
 * Ensures a container registry is configured in Portainer.
 *
 * - If a registry with the same URL already exists, updates credentials
 * - If not, creates a new registry entry
 *
 * @param client - Portainer API client
 * @param registryUrl - Registry URL (e.g. "ghcr.io")
 * @param username - Registry username
 * @param password - Registry password or token
 */
export async function ensureRegistry(
    client: PortainerClient,
    registryUrl: string,
    username: string,
    password: string
): Promise<void> {
    core.info(`Configuring registry: ${registryUrl}`);

    // Check if registry already exists
    const registries = await client.get<PortainerRegistry[]>('/api/registries');
    const existing = registries.find(
        (r) => r.URL === registryUrl || r.URL === `https://${registryUrl}`
    );

    if (existing) {
        core.info(`Registry "${registryUrl}" already exists (ID: ${existing.Id}) — updating credentials`);
        await client.put(`/api/registries/${existing.Id}`, {
            Name: existing.Name,
            URL: registryUrl,
            Authentication: true,
            Username: username,
            Password: password,
        });
        core.info('Registry credentials updated');
        return;
    }

    // Create new registry — Type 3 = Custom registry
    await client.post('/api/registries', {
        Name: `${registryUrl} (auto-configured by CI)`,
        URL: registryUrl,
        Type: 3,
        Authentication: true,
        Username: username,
        Password: password,
    });

    core.info(`Registry "${registryUrl}" configured successfully`);
}
