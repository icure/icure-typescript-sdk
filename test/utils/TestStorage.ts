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

export async function testStorageWithKeys(
  data: { dataOwnerId: string; pairs: { keyPair: KeyPair<string>; shaVersion: ShaVersion }[] }[]
): Promise<{ keyStorage: KeyStorageFacade; storage: StorageFacade<string>; keyFactory: StorageEntryKeysFactory }> {
  const keyStorage = new TestKeyStorage()
  const keyFactory = new DefaultStorageEntryKeysFactory()
  const storage = new TestStorage()
  const icureStorage = new IcureStorageFacade(keyStorage, storage, keyFactory)
  for (const { dataOwnerId, pairs } of data) {
    for (const pair of pairs) {
      await icureStorage.saveKey(
        dataOwnerId,
        pair.keyPair.publicKey.slice(-32),
        {
          privateKey: pkcs8ToJwk(hex2ua(pair.keyPair.privateKey)),
          publicKey: spkiToJwk(hex2ua(pair.keyPair.publicKey), pair.shaVersion),
        },
        true
      )
    }
  }
  return { keyFactory, keyStorage, storage }
}
