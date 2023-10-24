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

  private async getPartialKeyPair(key: string): Promise<{ publicKey?: JsonWebKey; privateKey?: JsonWebKey } | undefined> {
    const loaded = await this._storage.getItem(key)
    if (!loaded) return undefined
    const keyPair = JSON.parse(loaded)
    const res: { publicKey?: JsonWebKey; privateKey?: JsonWebKey } = {}
    if (keyPair.hasOwnProperty('publicKey')) res['publicKey'] = keyPair['publicKey']
    if (keyPair.hasOwnProperty('privateKey')) res['privateKey'] = keyPair['privateKey']
    return res
  }

  async getKeypair(key: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined> {
    const partial = await this.getPartialKeyPair(key)
    if (!partial || !partial.publicKey || !partial.privateKey) return undefined
    return { publicKey: partial.publicKey, privateKey: partial.privateKey }
  }

  async getPrivateKey(key: string): Promise<JsonWebKey | undefined> {
    return this.getPartialKeyPair(key).then((partial) => partial?.privateKey)
  }

  async getPublicKey(key: string): Promise<JsonWebKey | undefined> {
    return this.getPartialKeyPair(key).then((partial) => partial?.publicKey)
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
