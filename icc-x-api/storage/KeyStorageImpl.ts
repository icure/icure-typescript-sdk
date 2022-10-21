import { StorageFacade } from './StorageFacade'
import { KeyStorageFacade } from './KeyStorageFacade'
import { b2a } from '../../icc-api/model/ModelHelper'

export class KeyStorageImpl implements KeyStorageFacade {
  private readonly _storage: StorageFacade<string>

  constructor(storage: StorageFacade<string>) {
    this._storage = storage
  }

  deleteKeypair(key: string): void {
    return this._storage.deleteItem(key)
  }

  getKeypair(key: string): { publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined {
    const keyPair = JSON.parse(this._storage.getItem(key) ?? '{}')
    return keyPair.hasOwnProperty('publicKey') && keyPair.hasOwnProperty('privateKey')
      ? {
          publicKey: keyPair.publicKey as JsonWebKey,
          privateKey: keyPair.privateKey as JsonWebKey,
        }
      : undefined
  }

  getPrivateKey(key: string): JsonWebKey | undefined {
    return this.getKeypair(key)?.privateKey
  }

  getPublicKey(key: string): JsonWebKey | undefined {
    return this.getKeypair(key)?.publicKey
  }

  storeKeyPair(key: string, keyPair: { publicKey: JsonWebKey; privateKey: JsonWebKey }): void {
    return this._storage.setItem(key, JSON.stringify(keyPair))
  }
}
