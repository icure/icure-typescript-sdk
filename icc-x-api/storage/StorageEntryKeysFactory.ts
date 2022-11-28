/**
 * Specifies the entry keys to use for storage of data.
 */
export interface StorageEntryKeysFactory {
  /**
   * @param dataOwnerId Id of a data owner.
   * @param publicKeyFingerprint Fingerprint of the public key in a keypair of the data owner.
   * @return entry key of the keypair of the data owner with the specified public key.
   */
  entryKeyForDataOwnerKeypair(dataOwnerId: string, publicKeyFingerprint: string): string
}
