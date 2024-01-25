export class HMACUtils {
  private readonly _crypto: Crypto
  private readonly params: HmacKeyGenParams = {
    name: 'HMAC',
    hash: 'SHA-512',
    length: 128 * 8, // Recommended length in bits. Adding this because not all implementations behave well.
  }

  constructor(crypto: Crypto) {
    this._crypto = crypto
  }

  async generateKey(): Promise<CryptoKey> {
    return this._crypto.subtle.generateKey({ ...this.params }, true, ['sign', 'verify'])
  }

  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return this._crypto.subtle.exportKey('raw', key)
  }

  async importKey(key: ArrayBuffer): Promise<CryptoKey> {
    return this._crypto.subtle.importKey('raw', key, { ...this.params }, true, ['sign', 'verify'])
  }

  async sign(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return this._crypto.subtle.sign({ ...this.params }, key, data)
  }

  async verify(key: CryptoKey, data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
    return this._crypto.subtle.verify({ ...this.params }, key, signature, data)
  }
}
