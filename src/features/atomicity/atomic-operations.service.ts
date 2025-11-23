import { Inject, Injectable } from '@nestjs/common';
import { AtomicOperationsManager } from './atomicity-operations-manager.interface';

@Injectable()
export class AtomicOperationsService {
    constructor(
        @Inject('ATOMIC_OPERATIONS_PROVIDER') private readonly atomicOperationManager: AtomicOperationsManager
    ) {}

    async get(key: string): Promise<number> {
        return this.atomicOperationManager.get(key);
    }

    async set(key: string, value: number): Promise<void> {
        return this.atomicOperationManager.set(key, value);
    }

    async incr(key: string): Promise<number> {
        return this.atomicOperationManager.incr(key);
    }
}
