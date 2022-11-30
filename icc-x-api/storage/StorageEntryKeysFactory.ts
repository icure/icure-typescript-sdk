/**
 * Specifies the entry keys to use for storage of data.
 */
export interface StorageEntryKeysFactory {
  /**
   * Get the entry key for a VERIFIED key pair of a data owner. For security reasons verified key pairs should only be key pairs created on this
   * device or verified by a human user: key pairs obtained from transfer keys should not be stored as verified keys unless the human user has
   * confirmed he has created the key himself on another device.
   * @param dataOwnerId Id of a data owner.
   * @param publicKeyFingerprint Fingerprint of the public key in a keypair of the data owner.
   * @return entry key for the keypair.
   */
  entryKeyForVerifiedDataOwnerKeypair(dataOwnerId: string, publicKeyFingerprint: string): string
}
