/**
 * Concurrency Mutex for Checkout Reservations
 *
 * Prevents race conditions and overselling when concurrent checkout requests
 * attempt to reserve inventory for the same product simultaneously.
 */
export class CheckoutLock {
  private static locks = new Map<string, Promise<void>>();

  /**
   * Acquire a per-resource or global checkout lock, execute fn, and release lock.
   */
  static async runExclusive<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // Continue even if previous holder errored
      }
    }

    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);

    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolveLock();
    }
  }

  /**
   * Acquire locks for multiple products in deterministic order (prevents deadlock).
   */
  static async runExclusiveMulti<T>(keys: string[], fn: () => Promise<T> | T): Promise<T> {
    const sortedKeys = Array.from(new Set(keys)).sort();
    const acquireNext = async (index: number): Promise<T> => {
      if (index >= sortedKeys.length) {
        return await fn();
      }
      return this.runExclusive(sortedKeys[index], () => acquireNext(index + 1));
    };
    return acquireNext(0);
  }
}
