import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { AtomicOperationsManager } from './atomicity-operations-manager.interface';
import { MemoryAtomicOperationsManager } from './atomic-operations-manager.memory';
import { RedisAtomicOperationsManager } from './atomic-operations-manager.redis';

const logger = new Logger('AtomicOperationsProvider');

export const AtomicOperationsProvider: Provider = {
    provide: 'ATOMIC_OPERATIONS_PROVIDER',
    inject: [ConfigService],

    useFactory: async (configService: ConfigService): Promise<AtomicOperationsManager> => {
        const redisUri = configService.get<string>('REDIS_URI');
        const implementation = configService.get<string>('ATOMIC_OPERATIONS_IMPLEMENTATION');

        // Short circuit if memory is selected or redisUri not provided (development only)
        if (implementation === 'memory' || !redisUri) {
            logger.warn('Using in-memory atomic operations manager (development/fallback).');
            return new MemoryAtomicOperationsManager();
        }

        const client = new Redis(redisUri, {
            lazyConnect: true,
            connectTimeout: 2000
        });

        try {
            await client.connect();
            return new RedisAtomicOperationsManager(client);
        } catch (e: unknown) {
            logger.warn(
                `Failed to connect to Redis; falling back to in-memory atomic operations manager. ${String(e)}`
            );
            return new MemoryAtomicOperationsManager();
        }
    }
};
