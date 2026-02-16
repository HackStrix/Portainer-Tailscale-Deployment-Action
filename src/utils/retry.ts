/**
 * Generic retry utility with exponential backoff.
 */

export interface RetryOptions {
    /** Maximum number of attempts (including the first). Default: 5 */
    maxAttempts: number;
    /** Initial delay in ms before the first retry. Default: 2000 */
    initialDelayMs: number;
    /** Maximum delay cap in ms. Default: 10000 */
    maxDelayMs: number;
    /** Multiplier for exponential backoff. Default: 2 */
    backoffMultiplier: number;
    /** Called before each retry with the attempt number and error */
    onRetry?: (attempt: number, error: Error) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 5,
    initialDelayMs: 2000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
};

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async function with exponential backoff.
 *
 * @param fn - The async function to retry
 * @param options - Retry configuration (partial, merged with defaults)
 * @returns The result of fn() on success
 * @throws The last error if all attempts are exhausted
 */
export async function retry<T>(
    fn: () => Promise<T>,
    options?: Partial<RetryOptions>
): Promise<T> {
    const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
    let lastError: Error = new Error('retry: no attempts made');
    let delay = opts.initialDelayMs;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt === opts.maxAttempts) {
                break;
            }

            if (opts.onRetry) {
                opts.onRetry(attempt, lastError);
            }

            await sleep(delay);
            delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
        }
    }

    throw lastError;
}
