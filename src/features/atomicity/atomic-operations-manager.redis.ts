import { Redis } from 'ioredis';
import { AtomicOperationsManager } from './atomicity-operations-manager.interface';

export class RedisAtomicOperationsManager implements AtomicOperationsManager {
    private client: Redis;

    constructor(redisClient: Redis) {
        this.client = redisClient;
    }

    async get(key: string): Promise<number> {
        const res = await this.client.get(key);
        if (res === null) return 0;

        const n = Number(res);
        return Number.isFinite(n) ? n : 0;
    }

    async set(key: string, value: number): Promise<void> {
        await this.client.set(key, String(value), 'EX', 3600);
    }

    async incr(key: string): Promise<number> {
        const res = (await this.client.incr(key)) - 1;
        if (typeof res !== 'number' || !Number.isFinite(res)) {
            throw new Error(`Unexpected INCR result: ${res}`);
        }
        await this.client.expire(key, 3600);
        return res;
    }
}
