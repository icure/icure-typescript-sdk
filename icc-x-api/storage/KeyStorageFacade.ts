export interface KeyStorageFacade {
  /**
   * Returns the publicKey of the provided key from the storage
   * @param key Key of the value to retrieve
   * @return The publicKey associated to the provided key or undefined if not found.
   */
  getPublicKey(key: string): Promise<JsonWebKey | undefined>

  /**
   * Returns the privateKey of the provided key from the storage
   * @param key Key of the value to retrieve
   * @return The privateKey associated to the provided key or undefined if not found.
   */
  getPrivateKey(key: string): Promise<JsonWebKey | undefined>

  /**
   * Get the keyPair associated to the provided key
   * @param key Key of the value to retrieve
   * @return The keyPair associated to the provided key or undefined if not found.
   */
  getKeypair(key: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined>

  /**
   * Delete the keyPair associated to the provided key
   * @param key Key of the value to delete
   */
  deleteKeypair(key: string): Promise<void>

  /**
   * Stores the given keyPair under the given key in the storage.
   * @param key The id of the entry in storage
   * @param keyPair should be JWK
   */
  storeKeyPair(key: string, keyPair: { publicKey: JsonWebKey; privateKey: JsonWebKey }): Promise<void>
}
