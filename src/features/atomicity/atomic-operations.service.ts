import { Inject, Injectable } from '@nestjs/common';
import { AtomicOperationsManager } from './atomicity-operations-manager.interface';

@Injectable()
export class AtomicOperationsService {
    constructor(
        @Inject('ATOMIC_OPERATIONS_PROVIDER') private readonly atomicOperationManager: AtomicOperationsManager
    ) {}

    /**
     * Get the numeric value for a key via the underlying manager.
     * @param key - The key to retrieve.
     * @returns The numeric value stored for the key.
     */
    async get(key: string): Promise<number> {
        return this.atomicOperationManager.get(key);
    }

    /**
     * Set a numeric value for a key via the underlying manager.
     * @param key - The key to set.
     * @param value - The numeric value to store.
     */
    async set(key: string, value: number): Promise<void> {
        return this.atomicOperationManager.set(key, value);
    }

    /**
     * Increment the counter for a key via the underlying manager.
     * @param key - The key to increment.
     * @returns The result of the increment operation.
     */
    async incr(key: string): Promise<number> {
        return this.atomicOperationManager.incr(key);
    }
}
