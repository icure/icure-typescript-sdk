import { ua2hex } from '../utils'

export interface HMACUtils {
  generateKey(): Promise<CryptoKey>
  exportKey(key: CryptoKey): Promise<ArrayBuffer>
  importKey(key: ArrayBuffer, requireRecommendedKeySize?: Boolean): Promise<CryptoKey>
  sign(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>
  verify(key: CryptoKey, data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean>
}

export class HMACUtilsImpl implements HMACUtils {
  private readonly _crypto: Crypto
  private readonly recommendedKeyLengthBytes = 128
  private readonly params: HmacKeyGenParams = {
    name: 'HMAC',
    hash: 'SHA-512',
  }

  constructor(crypto: Crypto) {
    this._crypto = crypto
  }

  async generateKey(): Promise<CryptoKey> {
    const generatedKey = await this._crypto.subtle.generateKey({ ...this.params }, true, ['sign', 'verify'])
    const exportedKey = await this._crypto.subtle.exportKey('raw', generatedKey)
    if (exportedKey.byteLength !== this.recommendedKeyLengthBytes) {
      throw new Error(`Generated key has unexpected length - expected ${this.recommendedKeyLengthBytes} bytes, got ${exportedKey.byteLength} bytes`)
    }
    return generatedKey
  }

  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return this._crypto.subtle.exportKey('raw', key)
  }

  async importKey(key: ArrayBuffer, requireRecommendedKeySize?: Boolean): Promise<CryptoKey> {
    if (requireRecommendedKeySize != false && key.byteLength !== this.recommendedKeyLengthBytes) {
      throw new Error(`Key has unexpected length - expected ${this.recommendedKeyLengthBytes} bytes, got ${key.byteLength} bytes`)
    }
    return await this._crypto.subtle.importKey(
      'raw',
      key,
      {
        ...this.params,
        length: key.byteLength * 8,
      },
      true,
      ['sign', 'verify']
    )
  }

  async sign(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return this._crypto.subtle.sign({ ...this.params }, key, data)
  }

  async verify(key: CryptoKey, data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
    return this._crypto.subtle.verify({ ...this.params }, key, signature, data)
  }
}
