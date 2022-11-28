import { StorageEntryKeysFactory } from './StorageEntryKeysFactory'

export class DefaultStorageEntryKeysFactory implements StorageEntryKeysFactory {
  private readonly rsaLocalStoreIdPrefix = 'org.taktik.icure.rsa.'

  entryKeyForDataOwnerKeypair(dataOwnerId: string, publicKeyFingerprint: string): string {
    if (publicKeyFingerprint.length != 32) throw `Invalid key fingerprint: ${publicKeyFingerprint}`
    return `${this.rsaLocalStoreIdPrefix}${dataOwnerId}.${publicKeyFingerprint}`
  }
}
