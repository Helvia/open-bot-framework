import { Redis } from 'ioredis';
import { AtomicOperationsManager } from './atomicity-operations-manager.interface';

export class RedisAtomicOperationsManager implements AtomicOperationsManager {
    private client: Redis;

    constructor(redisClient: Redis) {
        this.client = redisClient;
    }

    /**
     * Get the numeric value stored for the given key in Redis.
     * Returns 0 when the key is missing or the stored value is not a valid number.
     * @param key - The Redis key to read.
     * @returns The numeric value for the key or 0 on missing/invalid value.
     */
    async get(key: string): Promise<number> {
        const res = await this.client.get(key);
        if (res === null) return 0;

        const n = Number(res);
        return Number.isFinite(n) ? n : 0;
    }

    /**
     * Set the numeric value for the given key in Redis with a 1-hour TTL.
     * @param key - The Redis key to set.
     * @param value - The numeric value to store.
     */
    async set(key: string, value: number): Promise<void> {
        await this.client.set(key, String(value), 'EX', 3600);
    }

    /**
     * Increment the numeric counter in Redis and ensure a 1-hour expiry.
     * Returns the new value minus 1 (behaves like the original implementation).
     * @param key - The Redis key to increment.
     * @returns The numeric result after increment (validated).
     * @throws If the INCR result is not a finite number.
     */
    async incr(key: string): Promise<number> {
        const res = (await this.client.incr(key)) - 1;
        if (typeof res !== 'number' || !Number.isFinite(res)) {
            throw new Error(`Unexpected INCR result: ${res}`);
        }
        await this.client.expire(key, 3600);
        return res;
    }
}
