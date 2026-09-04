import { KeyStorageImpl, type StorageFacade } from '@icure/api'

/**
 * The SDK caches loaded keys, verified-key flags and exchange data in a {@link StorageFacade}. A scan is a one-shot
 * read-only process, so everything it would cache is kept in memory and thrown away when the process exits: nothing
 * of the user's keys is ever written to disk.
 */
export class InMemoryStorage implements StorageFacade<string> {
  private readonly data = new Map<string, string>()

  async getItem(key: string): Promise<string | undefined> {
    return this.data.get(key)
  }

  async setItem(key: string, valueToStore: string): Promise<void> {
    this.data.set(key, valueToStore)
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key)
  }
}

export class InMemoryKeyStorage extends KeyStorageImpl {
  constructor(storage: StorageFacade<string> = new InMemoryStorage()) {
    super(storage)
  }
}
