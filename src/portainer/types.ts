/**
 * Portainer API type definitions.
 * Targets Portainer CE/BE v2.x API.
 */

/** Environment variable in Portainer stack format */
export interface StackEnvVar {
    name: string;
    value: string;
}

/** Stack status enum */
export enum StackStatus {
    Active = 1,
    Inactive = 2,
}

/** Stack type enum */
export enum StackType {
    Swarm = 1,
    Compose = 2,
}

/** Portainer stack resource (from GET /api/stacks) */
export interface PortainerStack {
    Id: number;
    Name: string;
    Type: StackType;
    EndpointId: number;
    Status: StackStatus;
    Env: StackEnvVar[];
    CreationDate: number;
    UpdateDate: number;
}

/** Request body for POST /api/stacks/create/standalone/string */
export interface CreateStackRequest {
    name: string;
    stackFileContent: string;
    env: StackEnvVar[];
    fromAppTemplate?: boolean;
}

/** Request body for PUT /api/stacks/{id} */
export interface UpdateStackRequest {
    stackFileContent: string;
    env: StackEnvVar[];
    prune: boolean;
    pullImage: boolean;
}

/** Portainer API error response */
export interface PortainerError {
    message: string;
    details?: string;
}

/** Result of a deploy operation */
export interface DeployResult {
    stackId: number;
    status: 'created' | 'updated' | 'deleted';
}
