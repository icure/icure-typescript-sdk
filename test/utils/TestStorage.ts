import { hex2ua, KeyStorageFacade, KeyStorageImpl, pkcs8ToJwk, spkiToJwk, StorageFacade } from '../../icc-x-api'
import { KeyPair, ShaVersion } from '../../icc-x-api/crypto/RSA'
import { StorageEntryKeysFactory } from '../../icc-x-api/storage/StorageEntryKeysFactory'
import { DefaultStorageEntryKeysFactory } from '../../icc-x-api/storage/DefaultStorageEntryKeysFactory'
import { IcureStorageFacade } from '../../icc-x-api/storage/IcureStorageFacade'

export class TestStorage implements StorageFacade<string> {
  private readonly data = new Map<string, string>()

  async getItem(key: string): Promise<string | undefined> {
    return this.data.get(key)
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key)
  }

  async setItem(key: string, valueToStore: string): Promise<void> {
    this.data.set(key, valueToStore)
  }
}

export class TestKeyStorage extends KeyStorageImpl {
  constructor() {
    super(new TestStorage())
  }
}
