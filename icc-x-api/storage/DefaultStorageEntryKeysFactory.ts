import { StorageEntryKeysFactory } from './StorageEntryKeysFactory'
import { isFingerprintV1, isFingerprintV2 } from '../crypto/utils'

/**
 * Default implementation for {@link StorageEntryKeysFactory}, compatible with legacy local storage keys.
 */
export class DefaultStorageEntryKeysFactory implements StorageEntryKeysFactory {
  cachedRecoveredKeypairOfDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (!isFingerprintV2(publicKeyFingerprint) && !isFingerprintV1(publicKeyFingerprint))
      throw new Error(`Invalid key fingerprint: ${publicKeyFingerprint}`)
    return `org.taktik.icure.rsa.recovered.${dataOwnerId}.${publicKeyFingerprint}`
  }

  deviceKeypairOfDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (!isFingerprintV2(publicKeyFingerprint) && !isFingerprintV1(publicKeyFingerprint))
      throw new Error(`Invalid key fingerprint: ${publicKeyFingerprint}`)
    return `org.taktik.icure.rsa.device.${dataOwnerId}.${publicKeyFingerprint}`
  }

  selfPublicKeysVerificationCacheForDataOwner(dataOwnerId: string): string {
    return `org.taktik.icure.rsa.${dataOwnerId}.verification.self`
  }

  signatureKeyForDataOwner(dataOwnerId: string): string {
    return `org.taktik.icure.rsa.sign.${dataOwnerId}.self`
  }

  signatureVerificationKeyForDataOwner(dataOwnerId: string, publicKeyFingerprint: string): string {
    return `org.taktik.icure.rsa.sign.verify.${dataOwnerId}.${publicKeyFingerprint}`
  }
}
