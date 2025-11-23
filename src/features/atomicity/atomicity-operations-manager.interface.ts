/**
 * Interface for an atomic operations manager.
 * Implementations should provide atomic get/set/incr semantics.
 */
export interface AtomicOperationsManager {
    /**
     * Increment the numeric counter at key.
     * @param key - The key to increment.
     * @returns The numeric result after increment.
     */
    incr(key: string): Promise<number>;

    /**
     * Retrieve the numeric value for the key.
     * @param key - The key to retrieve.
     * @returns The numeric value stored for the key.
     */
    get(key: string): Promise<number>;

    /**
     * Store a numeric value for the key.
     * @param key - The key to set.
     * @param value - The numeric value to store.
     */
    set(key: string, value: number): Promise<void>;
}
