/**
 * Tests for the config module.
 * Mocks @actions/core.getInput and filesystem access.
 */

import * as fs from 'fs';

// Mock @actions/core
const mockGetInput = jest.fn();
jest.mock('@actions/core', () => ({
    getInput: mockGetInput,
}));

import { getConfig } from '../config';

// Helper to set up input mocks
function setInputs(inputs: Record<string, string>): void {
    mockGetInput.mockImplementation((name: string, _options?: { required?: boolean }) => {
        return inputs[name] || '';
    });
}

describe('getConfig', () => {
    // Create a temp compose file for tests
    const tempComposeFile = '/tmp/test-compose.yml';

    beforeAll(() => {
        fs.writeFileSync(tempComposeFile, 'version: "3"\nservices:\n  web:\n    image: nginx\n');
    });

    afterAll(() => {
        if (fs.existsSync(tempComposeFile)) {
            fs.unlinkSync(tempComposeFile);
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Set default env vars for GitHub context
        process.env.GITHUB_REPOSITORY = 'user/repo';
        process.env.GITHUB_RUN_ID = '12345';
    });

    it('should parse valid config with OAuth credentials', () => {
        setInputs({
            ts_oauth_client_id: 'client-id',
            ts_oauth_secret: 'client-secret',
            ts_tags: 'tag:ci',
            ts_connect_timeout: '60',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'api-key-123',
            stack_name: 'my-app',
            compose_file: tempComposeFile,
            endpoint_id: '1',
        });

        const config = getConfig();

        expect(config.tailscale.oauthClientId).toBe('client-id');
        expect(config.tailscale.oauthSecret).toBe('client-secret');
        expect(config.tailscale.tags).toBe('tag:ci');
        expect(config.tailscale.connectTimeout).toBe(60);
        expect(config.portainer.url).toBe('https://my-nas:9443');
        expect(config.portainer.apiKey).toBe('api-key-123');
        expect(config.deployment.stackName).toBe('my-app');
        expect(config.deployment.composeFileContent).toContain('nginx');
        expect(config.deployment.endpointId).toBe(1);
        expect(config.deployment.tlsSkipVerify).toBe(false);
        expect(config.deployment.action).toBe('deploy');
    });

    it('should parse valid config with auth key fallback', () => {
        setInputs({
            ts_authkey: 'tskey-auth-abc123',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'api-key',
            stack_name: 'test-stack',
            compose_file: tempComposeFile,
        });

        const config = getConfig();

        expect(config.tailscale.authKey).toBe('tskey-auth-abc123');
        expect(config.tailscale.oauthClientId).toBe('');
    });

    it('should throw when no auth credentials are provided', () => {
        setInputs({
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: tempComposeFile,
        });

        expect(() => getConfig()).toThrow('Authentication required');
    });

    it('should throw when only client ID is provided without secret', () => {
        setInputs({
            ts_oauth_client_id: 'client-id',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: tempComposeFile,
        });

        expect(() => getConfig()).toThrow('ts_oauth_secret is required');
    });

    it('should throw when compose file does not exist', () => {
        setInputs({
            ts_authkey: 'tskey-123',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: '/nonexistent/docker-compose.yml',
        });

        expect(() => getConfig()).toThrow('Compose file not found');
    });

    it('should throw on invalid action', () => {
        setInputs({
            ts_authkey: 'tskey-123',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: tempComposeFile,
            action: 'restart',
        });

        expect(() => getConfig()).toThrow('Invalid action "restart"');
    });

    it('should strip trailing slashes from portainer URL', () => {
        setInputs({
            ts_authkey: 'tskey-123',
            portainer_url: 'https://my-nas:9443///',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: tempComposeFile,
        });

        const config = getConfig();
        expect(config.portainer.url).toBe('https://my-nas:9443');
    });

    it('should generate hostname from GitHub context', () => {
        setInputs({
            ts_authkey: 'tskey-123',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: tempComposeFile,
        });

        const config = getConfig();
        expect(config.tailscale.hostname).toBe('gha-user-repo-12345');
    });

    it('should parse tls_skip_verify correctly', () => {
        setInputs({
            ts_authkey: 'tskey-123',
            portainer_url: 'https://my-nas:9443',
            portainer_api_key: 'key',
            stack_name: 'app',
            compose_file: tempComposeFile,
            tls_skip_verify: 'true',
        });

        const config = getConfig();
        expect(config.deployment.tlsSkipVerify).toBe(true);
    });
});
