/**
 * Tests for Portainer stack operations.
 * Mocks the PortainerClient for all HTTP interactions.
 */

import {
    listStacks,
    findStackByName,
    createStack,
    updateStack,
    deleteStack,
    deployStack,
    removeStack,
} from '../../portainer/stacks';
import { PortainerStack, StackStatus, StackType } from '../../portainer/types';

// Mock @actions/core
jest.mock('@actions/core', () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warning: jest.fn(),
}));

import * as core from '@actions/core';
const mockWarning = core.warning as jest.Mock;

// Create a mock PortainerClient
function createMockClient() {
    return {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        delete: jest.fn(),
        postFormData: jest.fn(),
    };
}

const mockStack: PortainerStack = {
    Id: 42,
    Name: 'my-app',
    Type: StackType.Compose,
    EndpointId: 1,
    Status: StackStatus.Active,
    Env: [{ name: 'NODE_ENV', value: 'production' }],
    CreationDate: 1700000000,
    UpdateDate: 1700001000,
};

describe('listStacks', () => {
    it('should return stacks for an endpoint', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([mockStack]);

        const result = await listStacks(client as any, 1);

        expect(result).toEqual([mockStack]);
        expect(client.get).toHaveBeenCalledWith(
            '/api/stacks?filters={"EndpointId":1}'
        );
    });

    it('should return empty array when no stacks exist', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([]);

        const result = await listStacks(client as any, 1);
        expect(result).toEqual([]);
    });
});

describe('findStackByName', () => {
    it('should find a stack by name', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([mockStack]);

        const result = await findStackByName(client as any, 'my-app', 1);
        expect(result).toEqual(mockStack);
    });

    it('should return null when stack is not found', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([mockStack]);

        const result = await findStackByName(client as any, 'nonexistent', 1);
        expect(result).toBeNull();
    });

    it('should match endpoint ID', async () => {
        const client = createMockClient();
        const stackOnDifferentEndpoint = { ...mockStack, EndpointId: 2 };
        client.get.mockResolvedValue([stackOnDifferentEndpoint]);

        const result = await findStackByName(client as any, 'my-app', 1);
        expect(result).toBeNull();
    });
});

describe('createStack', () => {
    it('should create a new stack with correct request body (no config files)', async () => {
        const client = createMockClient();
        client.post.mockResolvedValue({ ...mockStack, Id: 99 });

        const envVars = [{ name: 'KEY', value: 'val' }];
        const result = await createStack(
            client as any,
            1,
            'new-stack',
            'version: "3"\nservices:\n  web:\n    image: nginx',
            envVars
        );

        expect(result.Id).toBe(99);
        expect(client.post).toHaveBeenCalledWith(
            '/api/stacks/create/standalone/string?endpointId=1',
            {
                name: 'new-stack',
                stackFileContent: 'version: "3"\nservices:\n  web:\n    image: nginx',
                env: envVars,
                fromAppTemplate: false,
            }
        );
        expect(client.postFormData).not.toHaveBeenCalled();
    });

    it('should use multipart form-data endpoint when config files are provided', async () => {
        const client = createMockClient();
        client.postFormData.mockResolvedValue({ ...mockStack, Id: 101 });

        const envVars = [{ name: 'KEY', value: 'val' }];
        const configFiles = [
            { remotePath: 'traefik.yml', content: 'entryPoints:\n  web:\n    address: ":80"' },
            { remotePath: 'configs/app.conf', content: 'server { listen 80; }' },
        ];

        const result = await createStack(
            client as any,
            1,
            'new-stack',
            'version: "3"',
            envVars,
            configFiles
        );

        expect(result.Id).toBe(101);
        expect(client.postFormData).toHaveBeenCalledWith(
            '/api/stacks/create/standalone/file?endpointId=1',
            expect.any(FormData)
        );
        expect(client.post).not.toHaveBeenCalled();
    });
});

describe('updateStack', () => {
    it('should update an existing stack', async () => {
        const client = createMockClient();
        client.put.mockResolvedValue(mockStack);

        const envVars = [{ name: 'KEY', value: 'new-val' }];
        const result = await updateStack(client as any, 42, 1, 'updated compose', envVars);

        expect(result).toEqual(mockStack);
        expect(client.put).toHaveBeenCalledWith(
            '/api/stacks/42?endpointId=1',
            {
                stackFileContent: 'updated compose',
                env: envVars,
                prune: true,
                pullImage: true,
            }
        );
    });
});

describe('deleteStack', () => {
    it('should delete a stack by ID', async () => {
        const client = createMockClient();
        client.delete.mockResolvedValue(undefined);

        await deleteStack(client as any, 42, 1);

        expect(client.delete).toHaveBeenCalledWith('/api/stacks/42?endpointId=1');
    });
});

describe('deployStack', () => {
    beforeEach(() => {
        mockWarning.mockClear();
    });

    it('should create a new stack when it does not exist', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([]); // No existing stacks
        client.post.mockResolvedValue({ ...mockStack, Id: 100 });

        const result = await deployStack(
            client as any,
            1,
            'new-app',
            'compose content',
            []
        );

        expect(result).toEqual({ stackId: 100, status: 'created' });
        expect(client.post).toHaveBeenCalled();
        expect(client.put).not.toHaveBeenCalled();
    });

    it('should update an existing stack', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([mockStack]);
        client.put.mockResolvedValue(mockStack);

        const result = await deployStack(
            client as any,
            1,
            'my-app',
            'updated compose',
            [{ name: 'A', value: '1' }]
        );

        expect(result).toEqual({ stackId: 42, status: 'updated' });
        expect(client.put).toHaveBeenCalled();
        expect(client.post).not.toHaveBeenCalled();
    });

    it('should pass config files to createStack on new stack', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([]); // No existing stacks
        client.postFormData.mockResolvedValue({ ...mockStack, Id: 200 });

        const configFiles = [
            { remotePath: 'app.conf', content: 'config content' },
        ];

        const result = await deployStack(
            client as any,
            1,
            'new-app',
            'compose content',
            [],
            configFiles
        );

        expect(result).toEqual({ stackId: 200, status: 'created' });
        expect(client.postFormData).toHaveBeenCalled();
    });

    it('should warn when config files are provided during update', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([mockStack]);
        client.put.mockResolvedValue(mockStack);

        const configFiles = [
            { remotePath: 'app.conf', content: 'config content' },
        ];

        await deployStack(
            client as any,
            1,
            'my-app',
            'updated compose',
            [],
            configFiles
        );

        expect(mockWarning).toHaveBeenCalledWith(
            expect.stringContaining('Config files are only uploaded on stack creation')
        );
        expect(client.put).toHaveBeenCalled();
        expect(client.postFormData).not.toHaveBeenCalled();
    });
});

describe('removeStack', () => {
    it('should delete an existing stack', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([mockStack]);
        client.delete.mockResolvedValue(undefined);

        const result = await removeStack(client as any, 1, 'my-app');

        expect(result).toEqual({ stackId: 42, status: 'deleted' });
    });

    it('should handle non-existent stack gracefully', async () => {
        const client = createMockClient();
        client.get.mockResolvedValue([]);

        const result = await removeStack(client as any, 1, 'ghost-stack');

        expect(result).toEqual({ stackId: 0, status: 'deleted' });
        expect(client.delete).not.toHaveBeenCalled();
    });
});
