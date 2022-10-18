export interface LocalStorageFacade {

  /**
   * Returns the value of the provided key from the storage
   * @param key Key of the value to retrieve
   * @return The value associated to the provided key or null if not found.
   */
  getItem(key: string): string | null

  /**
   * Set an item in the storage for the given key
   * @param key Key of the value to set
   * @param value Value to set
   */
  setItem(key: string, value: string): void

  /**
   * Removes the item with the given key from the storage.
   * @param key The key of the item to remove.
   */
  removeItem(key: string): void

  /**
   * Stores the given keyPair under the given key in the storage.
   * @param key The id of the entry in storage
   * @param keyPair should be JWK
   */
  storeKeyPair(key: string, keyPair: { publicKey: any; privateKey: any }): void
}

export class LocalStorageImpl implements LocalStorageFacade {
  getItem(key: string): string | null {
    return localStorage.getItem(key)
  }

  removeItem(key: string): void {
    return localStorage.removeItem(key)
  }

  setItem(key: string, value: string): void {
    return localStorage.setItem(key, value)
  }

  storeKeyPair(key: string, keyPair: { publicKey: any; privateKey: any }): void {
    if (typeof Storage === 'undefined') {
      console.error('Your browser does not support HTML5 Browser Local Storage !')
      throw 'Your browser does not support HTML5 Browser Local Storage !'
    }
    //TODO: encryption
    this.setItem(key, JSON.stringify(keyPair))
  }
}
