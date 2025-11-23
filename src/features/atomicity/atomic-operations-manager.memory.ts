/* eslint-disable @typescript-eslint/require-await */
import { AtomicOperationsManager } from './atomicity-operations-manager.interface';

/**
 * Warning: Do not use it in production (used only as an emergency fallback)
 */
export class MemoryAtomicOperationsManager implements AtomicOperationsManager {
    private readonly activityInc: Map<string, number>;

    constructor() {
        this.activityInc = new Map();
    }

    /**
     * Retrieve the numeric value associated with the given key.
     * @param key - The key to read.
     * @returns The stored number for the key (may be undefined if key not present).
     */
    async get(key: string): Promise<number> {
        return this.activityInc.get(key)!;
    }

    /**
     * Store a numeric value for the given key.
     * @param key - The key to set.
     * @param value - The numeric value to store.
     */
    async set(key: string, value: number): Promise<void> {
        this.activityInc.set(key, value);
    }

    /**
     * Increment the numeric counter stored at the given key.
     * If the key does not exist it is initialized to 0 and 0 is returned.
     * @param key - The key to increment.
     * @returns The value after increment (or 0 when initializing).
     */
    async incr(key: string): Promise<number> {
        if (this.activityInc.has(key)) {
            const currentNumber = (await this.get(key)) + 1;
            this.activityInc.set(key, currentNumber);
            return currentNumber;
        } else {
            await this.set(key, 0);
            return 0;
        }
    }
}
