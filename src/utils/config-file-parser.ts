/**
 * Parse multiline config file mappings into structured objects.
 * Each line maps a local file to a remote path in the stack's project directory.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ConfigFileEntry {
    /** Absolute path to the local file */
    localPath: string;
    /** Relative path within the stack's project directory */
    remotePath: string;
    /** File content (read at parse time) */
    content: string;
}

/**
 * Parses a multiline string of local_path:remote_path mappings.
 *
 * Rules:
 * - Blank lines are skipped
 * - Lines starting with # are treated as comments and skipped
 * - Format: local/path:remote/path (split on first colon)
 * - Validates the local file exists and reads its content
 * - Validates remote path is relative (no leading /)
 * - Duplicate remote paths throw an error
 *
 * @param input - Multiline string of path mappings
 * @returns Array of ConfigFileEntry objects
 */
export function parseConfigFiles(input: string): ConfigFileEntry[] {
    if (!input || input.trim() === '') {
        return [];
    }

    const lines = input.split('\n');
    const seenRemotePaths = new Set<string>();
    const result: ConfigFileEntry[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip blank lines and comments
        if (line === '' || line.startsWith('#')) {
            continue;
        }

        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) {
            throw new Error(
                `Malformed config file mapping on line ${i + 1}: "${line}" — expected local_path:remote_path format`
            );
        }

        const localRaw = line.substring(0, colonIndex).trim();
        const remoteRaw = line.substring(colonIndex + 1).trim();

        if (localRaw === '') {
            throw new Error(
                `Empty local path on line ${i + 1}: "${line}" — local path cannot be empty`
            );
        }

        if (remoteRaw === '') {
            throw new Error(
                `Empty remote path on line ${i + 1}: "${line}" — remote path cannot be empty`
            );
        }

        // Remote path must be relative (no leading /)
        if (remoteRaw.startsWith('/')) {
            throw new Error(
                `Absolute remote path on line ${i + 1}: "${remoteRaw}" — remote path must be relative (no leading /)`
            );
        }

        // Check for duplicate remote paths
        if (seenRemotePaths.has(remoteRaw)) {
            throw new Error(
                `Duplicate remote path on line ${i + 1}: "${remoteRaw}" — each remote path must be unique`
            );
        }

        // Resolve and validate local file
        const resolvedLocal = path.resolve(localRaw);
        if (!fs.existsSync(resolvedLocal)) {
            throw new Error(
                `Config file not found on line ${i + 1}: ${resolvedLocal}`
            );
        }

        const stat = fs.statSync(resolvedLocal);
        if (!stat.isFile()) {
            throw new Error(
                `Config path is not a file on line ${i + 1}: ${resolvedLocal}`
            );
        }

        const content = fs.readFileSync(resolvedLocal, 'utf-8');

        seenRemotePaths.add(remoteRaw);
        result.push({
            localPath: resolvedLocal,
            remotePath: remoteRaw,
            content,
        });
    }

    return result;
}
