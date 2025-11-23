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

    async get(key: string): Promise<number> {
        return this.activityInc.get(key)!;
    }

    async set(key: string, value: number): Promise<void> {
        this.activityInc.set(key, value);
    }

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
