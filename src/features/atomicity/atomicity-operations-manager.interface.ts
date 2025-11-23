export interface AtomicOperationsManager {
    incr(key: string): Promise<number>;
    get(key: string): Promise<number>;
    set(key: string, value: number): Promise<void>;
}
