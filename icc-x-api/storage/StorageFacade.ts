export interface StorageFacade<T> {
  /**
   * Returns the value of the provided key from the storage
   * @param key Key of the value to retrieve
   * @return The value associated to the provided key or null if not found.
   */
  getItem(key: string): Promise<T | undefined>

  /**
   * Set an item in the storage for the given key
   * @param key Key of the value to set
   * @param valueToStore
   */
  setItem(key: string, valueToStore: T): Promise<void>

  /**
   * Removes the item with the given key from the storage.
   * @param key The key of the item to remove.
   */
  deleteItem(key: string): Promise<void>
}
