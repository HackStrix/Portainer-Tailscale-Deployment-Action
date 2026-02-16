import { retry } from '../../utils/retry';

describe('retry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should return result on first success', async () => {
        const fn = jest.fn().mockResolvedValue('success');

        const resultPromise = retry(fn, { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, backoffMultiplier: 2 });
        const result = await resultPromise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValue('success');

        const resultPromise = retry(fn, {
            maxAttempts: 5,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
        });

        // Advance timers for the retries
        await jest.advanceTimersByTimeAsync(100); // first retry delay
        await jest.advanceTimersByTimeAsync(200); // second retry delay

        const result = await resultPromise;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw last error after exhausting all attempts', async () => {
        jest.useRealTimers();

        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockRejectedValueOnce(new Error('final fail'));

        await expect(
            retry(fn, {
                maxAttempts: 3,
                initialDelayMs: 10,
                maxDelayMs: 20,
                backoffMultiplier: 1,
            })
        ).rejects.toThrow('final fail');
        expect(fn).toHaveBeenCalledTimes(3);

        jest.useFakeTimers();
    });

    it('should call onRetry callback before each retry', async () => {
        const onRetry = jest.fn();
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValue('done');

        const resultPromise = retry(fn, {
            maxAttempts: 5,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
            onRetry,
        });

        await jest.advanceTimersByTimeAsync(100);
        await jest.advanceTimersByTimeAsync(200);

        await resultPromise;

        expect(onRetry).toHaveBeenCalledTimes(2);
        expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
        expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
    });

    it('should cap delay at maxDelayMs', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce(new Error('1'))
            .mockRejectedValueOnce(new Error('2'))
            .mockRejectedValueOnce(new Error('3'))
            .mockResolvedValue('done');

        const resultPromise = retry(fn, {
            maxAttempts: 5,
            initialDelayMs: 100,
            maxDelayMs: 150, // Cap low
            backoffMultiplier: 2,
        });

        // First delay: 100ms
        await jest.advanceTimersByTimeAsync(100);
        // Second delay: min(200, 150) = 150ms
        await jest.advanceTimersByTimeAsync(150);
        // Third delay: min(300, 150) = 150ms
        await jest.advanceTimersByTimeAsync(150);

        const result = await resultPromise;
        expect(result).toBe('done');
        expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should handle non-Error rejections', async () => {
        const fn = jest
            .fn()
            .mockRejectedValueOnce('string error')
            .mockResolvedValue('done');

        const resultPromise = retry(fn, {
            maxAttempts: 3,
            initialDelayMs: 100,
            maxDelayMs: 1000,
            backoffMultiplier: 2,
        });

        await jest.advanceTimersByTimeAsync(100);

        const result = await resultPromise;
        expect(result).toBe('done');
    });

    it('should use default options when none provided', async () => {
        const fn = jest.fn().mockResolvedValue('ok');
        const result = await retry(fn);
        expect(result).toBe('ok');
    });
});
