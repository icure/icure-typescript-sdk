import { KeyStorageFacade, StorageFacade } from '../../icc-x-api'
import { KeyPair } from '../../icc-x-api/crypto/RSA'

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

export class TestKeyStorage implements KeyStorageFacade {
  private readonly data = new Map<string, KeyPair<JsonWebKey>>()

  async deleteKeypair(key: string): Promise<void> {
    this.data.delete(key)
  }

  async getKeypair(key: string): Promise<{ publicKey: JsonWebKey; privateKey: JsonWebKey } | undefined> {
    return this.data.get(key)
  }

  async getPrivateKey(key: string): Promise<JsonWebKey | undefined> {
    return (await this.getKeypair(key))?.privateKey
  }

  async getPublicKey(key: string): Promise<JsonWebKey | undefined> {
    return (await this.getKeypair(key))?.publicKey
  }

  async storeKeyPair(key: string, keyPair: { publicKey: JsonWebKey; privateKey: JsonWebKey }): Promise<void> {
    this.data.set(key, keyPair)
  }
}
