/**
 * Portainer HTTP client wrapper.
 * Handles authentication, TLS, and error parsing.
 */

import * as core from '@actions/core';
import * as http from '@actions/http-client';
import { PortainerError } from './types';

export class PortainerClient {
    private client: http.HttpClient;
    private baseUrl: string;
    private headers: Record<string, string>;

    constructor(baseUrl: string, apiKey: string, tlsSkipVerify: boolean) {
        this.baseUrl = baseUrl;

        if (tlsSkipVerify) {
            core.warning(
                '⚠️ TLS certificate verification is DISABLED. ' +
                'This is acceptable for self-signed certs in homelabs but should not be used in production.'
            );
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }

        this.client = new http.HttpClient('portainer-tailscale-action', undefined, {
            allowRetries: true,
            maxRetries: 2,
        });

        this.headers = {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Sends a GET request to the Portainer API.
     */
    async get<T>(path: string): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        core.debug(`GET ${url}`);

        const response = await this.client.get(url, this.headers);
        return this.handleResponse<T>(response, 'GET', path);
    }

    /**
     * Sends a POST request to the Portainer API.
     */
    async post<T>(path: string, body: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        core.debug(`POST ${url}`);

        const response = await this.client.post(url, JSON.stringify(body), this.headers);
        return this.handleResponse<T>(response, 'POST', path);
    }

    /**
     * Sends a PUT request to the Portainer API.
     */
    async put<T>(path: string, body: unknown): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        core.debug(`PUT ${url}`);

        const response = await this.client.put(url, JSON.stringify(body), this.headers);
        return this.handleResponse<T>(response, 'PUT', path);
    }

    /**
     * Sends a DELETE request to the Portainer API.
     */
    async delete(path: string): Promise<void> {
        const url = `${this.baseUrl}${path}`;
        core.debug(`DELETE ${url}`);

        const response = await this.client.del(url, this.headers);
        const statusCode = response.message.statusCode || 0;

        if (statusCode < 200 || statusCode >= 300) {
            const body = await response.readBody();
            throw this.createError('DELETE', path, statusCode, body);
        }
    }

    /**
     * Handles an HTTP response: checks status code and parses JSON body.
     */
    private async handleResponse<T>(
        response: http.HttpClientResponse,
        method: string,
        path: string
    ): Promise<T> {
        const statusCode = response.message.statusCode || 0;
        const body = await response.readBody();

        if (statusCode < 200 || statusCode >= 300) {
            throw this.createError(method, path, statusCode, body);
        }

        try {
            return JSON.parse(body) as T;
        } catch {
            throw new Error(
                `Failed to parse JSON response from ${method} ${path}: ${body.substring(0, 200)}`
            );
        }
    }

    /**
     * Creates a detailed error from a Portainer API error response.
     */
    private createError(
        method: string,
        path: string,
        statusCode: number,
        body: string
    ): Error {
        let message = `Portainer API error: ${method} ${path} returned HTTP ${statusCode}`;

        try {
            const errorResponse: PortainerError = JSON.parse(body);
            if (errorResponse.message) {
                message += ` — ${errorResponse.message}`;
            }
            if (errorResponse.details) {
                message += ` (${errorResponse.details})`;
            }
        } catch {
            // Body wasn't JSON — include raw body
            if (body) {
                message += ` — ${body.substring(0, 200)}`;
            }
        }

        if (statusCode === 401 || statusCode === 403) {
            message += '. Check that your portainer_api_key is valid and has sufficient permissions.';
        }

        return new Error(message);
    }
}
