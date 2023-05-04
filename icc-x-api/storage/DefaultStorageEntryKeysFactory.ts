import { StorageEntryKeysFactory } from './StorageEntryKeysFactory'

/**
 * Default implementation for {@link StorageEntryKeysFactory}, compatible with legacy local storage keys.
 */
export class DefaultStorageEntryKeysFactory implements StorageEntryKeysFactory {
  cachedRecoveredKeypairOfDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (publicKeyFingerprint.length != 32) throw new Error(`Invalid key fingerprint: ${publicKeyFingerprint}`)
    return `org.taktik.icure.rsa.recovered.${dataOwnerId}.${publicKeyFingerprint}`
  }

  deviceKeypairOfDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (publicKeyFingerprint.length != 32) throw new Error(`Invalid key fingerprint: ${publicKeyFingerprint}`)
    return `org.taktik.icure.rsa.device.${dataOwnerId}.${publicKeyFingerprint}`
  }

  selfPublicKeysVerificationCacheForDataOwner(dataOwnerId: string): string {
    return `org.taktik.icure.rsa.${dataOwnerId}.verification.self`
  }
}
