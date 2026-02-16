/**
 * Parse multiline KEY=VALUE environment variables into Portainer's format.
 */

export interface StackEnvVar {
    name: string;
    value: string;
}

/**
 * Parses a multiline string of KEY=VALUE pairs into an array of StackEnvVar.
 *
 * Rules:
 * - Blank lines are skipped
 * - Lines starting with # are treated as comments and skipped
 * - KEY=VALUE format (value may contain additional = signs)
 * - Leading/trailing whitespace is trimmed from keys and values
 * - Duplicate keys: last value wins (with a warning)
 * - Malformed lines (no = sign) throw an error
 *
 * @param input - Multiline string of KEY=VALUE pairs
 * @returns Array of { name, value } objects for the Portainer API
 */
export function parseEnvVars(input: string): StackEnvVar[] {
    if (!input || input.trim() === '') {
        return [];
    }

    const lines = input.split('\n');
    const seen = new Map<string, number>();
    const result: StackEnvVar[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip blank lines and comments
        if (line === '' || line.startsWith('#')) {
            continue;
        }

        const eqIndex = line.indexOf('=');
        if (eqIndex === -1) {
            throw new Error(
                `Malformed env var on line ${i + 1}: "${line}" — expected KEY=VALUE format`
            );
        }

        const key = line.substring(0, eqIndex).trim();
        const value = line.substring(eqIndex + 1).trim();

        if (key === '') {
            throw new Error(
                `Empty key on line ${i + 1}: "${line}" — key cannot be empty`
            );
        }

        // Check for duplicates — last value wins
        const existingIndex = seen.get(key);
        if (existingIndex !== undefined) {
            // Remove the previous entry
            result.splice(existingIndex, 1);
            // Adjust indices in the seen map
            for (const [k, idx] of seen.entries()) {
                if (idx > existingIndex) {
                    seen.set(k, idx - 1);
                }
            }
        }

        seen.set(key, result.length);
        result.push({ name: key, value });
    }

    return result;
}
