/**
 * Tests for the Tailscale auth module.
 * Mocks @actions/http-client for OAuth and key generation flows.
 */

// Mock @actions/core
jest.mock('@actions/core', () => ({
    info: jest.fn(),
    setSecret: jest.fn(),
}));

// Mock @actions/http-client
const mockPost = jest.fn();
jest.mock('@actions/http-client', () => ({
    HttpClient: jest.fn().mockImplementation(() => ({
        post: mockPost,
    })),
}));

import { getAuthKey } from '../../tailscale/auth';

function createMockResponse(statusCode: number, body: object | string) {
    return {
        message: { statusCode },
        readBody: jest.fn().mockResolvedValue(
            typeof body === 'string' ? body : JSON.stringify(body)
        ),
    };
}

describe('getAuthKey', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should return direct auth key when provided', async () => {
        const result = await getAuthKey({
            oauthClientId: '',
            oauthSecret: '',
            authKey: 'tskey-auth-direct-123',
            tags: 'tag:ci',
        });

        expect(result).toBe('tskey-auth-direct-123');
        expect(mockPost).not.toHaveBeenCalled();
    });

    it('should generate key via OAuth when no direct key is provided', async () => {
        // Mock OAuth token response
        mockPost.mockResolvedValueOnce(
            createMockResponse(200, {
                access_token: 'oauth-access-token-xyz',
                token_type: 'bearer',
                expires_in: 3600,
            })
        );

        // Mock key generation response
        mockPost.mockResolvedValueOnce(
            createMockResponse(200, {
                id: 'k-123',
                key: 'tskey-auth-generated-456',
                created: '2024-01-01T00:00:00Z',
                expires: '2024-01-01T00:05:00Z',
            })
        );

        const result = await getAuthKey({
            oauthClientId: 'client-id',
            oauthSecret: 'client-secret',
            authKey: '',
            tags: 'tag:ci',
        });

        expect(result).toBe('tskey-auth-generated-456');
        expect(mockPost).toHaveBeenCalledTimes(2);

        // Verify OAuth token request
        expect(mockPost).toHaveBeenNthCalledWith(
            1,
            'https://api.tailscale.com/api/v2/oauth/token',
            'grant_type=client_credentials',
            expect.objectContaining({
                'Content-Type': 'application/x-www-form-urlencoded',
            })
        );

        // Verify key generation request
        const keyRequestBody = JSON.parse(mockPost.mock.calls[1][1]);
        expect(keyRequestBody.capabilities.devices.create.ephemeral).toBe(true);
        expect(keyRequestBody.capabilities.devices.create.reusable).toBe(false);
        expect(keyRequestBody.capabilities.devices.create.tags).toEqual(['tag:ci']);
    });

    it('should handle multiple tags', async () => {
        mockPost.mockResolvedValueOnce(
            createMockResponse(200, { access_token: 'token', token_type: 'bearer', expires_in: 3600 })
        );
        mockPost.mockResolvedValueOnce(
            createMockResponse(200, { id: 'k-1', key: 'tskey-123', created: '', expires: '' })
        );

        await getAuthKey({
            oauthClientId: 'id',
            oauthSecret: 'secret',
            authKey: '',
            tags: 'tag:ci, tag:deploy',
        });

        const keyRequestBody = JSON.parse(mockPost.mock.calls[1][1]);
        expect(keyRequestBody.capabilities.devices.create.tags).toEqual([
            'tag:ci',
            'tag:deploy',
        ]);
    });

    it('should throw on OAuth token failure', async () => {
        mockPost.mockResolvedValueOnce(
            createMockResponse(401, { error: 'invalid_client' })
        );

        await expect(
            getAuthKey({
                oauthClientId: 'bad-id',
                oauthSecret: 'bad-secret',
                authKey: '',
                tags: 'tag:ci',
            })
        ).rejects.toThrow('Failed to get Tailscale OAuth token (HTTP 401)');
    });

    it('should throw on key generation failure', async () => {
        mockPost.mockResolvedValueOnce(
            createMockResponse(200, { access_token: 'token', token_type: 'bearer', expires_in: 3600 })
        );
        mockPost.mockResolvedValueOnce(
            createMockResponse(403, { message: 'ACL denied' })
        );

        await expect(
            getAuthKey({
                oauthClientId: 'id',
                oauthSecret: 'secret',
                authKey: '',
                tags: 'tag:ci',
            })
        ).rejects.toThrow('Failed to generate Tailscale auth key (HTTP 403)');
    });
});
