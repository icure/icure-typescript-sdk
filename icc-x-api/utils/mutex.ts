/**
 * A simple promise-based mutual exclusion lock. Callers acquire the lock and receive a release function;
 * subsequent acquire() calls queue behind the current holder until it releases.
 */
export class Mutex {
  private queue: Promise<void> = Promise.resolve()

  /**
   * Wait until the lock is available, then acquire it.
   * @returns a release function that MUST be called (typically in a finally block) to let the next waiter proceed.
   */
  acquire(): Promise<() => void> {
    let release!: () => void
    const prev = this.queue
    this.queue = new Promise<void>((resolve) => {
      release = resolve
    })
    return prev.then(() => release)
  }
}
