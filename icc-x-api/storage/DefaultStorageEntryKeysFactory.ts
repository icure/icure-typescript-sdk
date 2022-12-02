import { StorageEntryKeysFactory } from './StorageEntryKeysFactory'

/**
 * Default implementation for {@link StorageEntryKeysFactory}, compatible with legacy local storage keys.
 */
export class DefaultStorageEntryKeysFactory implements StorageEntryKeysFactory {
  cachedRecoveredKeypairOfDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (publicKeyFingerprint.length != 32) throw `Invalid key fingerprint: ${publicKeyFingerprint}`
    return `org.taktik.icure.rsa.recovered.${dataOwnerId}.${publicKeyFingerprint}`
  }

  deviceKeypairOfDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (publicKeyFingerprint.length != 32) throw `Invalid key fingerprint: ${publicKeyFingerprint}`
    return `org.taktik.icure.rsa.${dataOwnerId}.${publicKeyFingerprint}` // Same as legacy to be able to reuse existing keys.
  }

  selfPublicKeysVerificationCacheForDataOwner(dataOwnerId: string): string {
    return `org.taktik.icure.rsa.${dataOwnerId}.self.verification`
  }
}
