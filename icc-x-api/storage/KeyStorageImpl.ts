import { StorageFacade } from './StorageFacade'
import { KeyStorageFacade } from './KeyStorageFacade'

export class KeyStorageImpl implements KeyStorageFacade {
  private readonly _storage: StorageFacade<string>

  constructor(storage: StorageFacade<string>) {
    this._storage = storage
  }

  async deleteKeypair(key: string): Promise<void> {
    return await this._storage.removeItem(key)
  }

  async getKeypair(key: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined> {
    const keyPair = JSON.parse((await this._storage.getItem(key)) ?? '{}')
    return keyPair.hasOwnProperty('publicKey') && keyPair.hasOwnProperty('privateKey')
      ? {
          publicKey: keyPair.publicKey as JsonWebKey,
          privateKey: keyPair.privateKey as JsonWebKey,
        }
      : undefined
  }

  async getPrivateKey(key: string): Promise<JsonWebKey | undefined> {
    return (await this.getKeypair(key))?.privateKey
  }

  async getPublicKey(key: string): Promise<JsonWebKey | undefined> {
    return (await this.getKeypair(key))?.publicKey
  }

  async storeKeyPair(key: string, keyPair: { publicKey: JsonWebKey; privateKey: JsonWebKey }): Promise<void> {
    return await this._storage.setItem(key, JSON.stringify(keyPair))
  }

  async storePublicKey(key: string, publicKey: JsonWebKey): Promise<void> {
    return await this._storage.setItem(key, JSON.stringify({ publicKey }))
  }

  async storePrivateKey(key: string, privateKey: JsonWebKey): Promise<void> {
    return await this._storage.setItem(key, JSON.stringify({ privateKey }))
  }
}
