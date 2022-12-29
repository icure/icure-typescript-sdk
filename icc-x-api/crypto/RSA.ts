import { ua2utf8, utf8_2ua } from '../utils'

/**
 * Represents an RSA KeyPair in a generic format.
 */
export type KeyPair<T> = { publicKey: T; privateKey: T }

export class RSAUtils {
  /********* RSA Config **********/
  //TODO bigger modulus
  //TODO PSS for signing
  rsaParams: any = { name: 'RSA-OAEP' }
  // RSA params for 'import' and 'generate' function.
  rsaHashedParams: any = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Equivalent to 65537 (Fermat F4), read http://en.wikipedia.org/wiki/65537_(number)
    hash: { name: 'sha-1' },
  }

  private crypto: Crypto

  constructor(crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto)) {
    this.crypto = crypto
  }

  /**
   * It returns CryptoKey promise, which doesn't hold the bytes of the key.
   * If bytes are needed, you must export the generated key.
   *
   * @returns {Promise} will be {publicKey: CryptoKey, privateKey: CryptoKey}
   */
  generateKeyPair(): Promise<KeyPair<CryptoKey>> {
    const extractable = true
    const keyUsages: KeyUsage[] = ['decrypt', 'encrypt']

    return new Promise<KeyPair<CryptoKey>>((resolve, reject) => {
      this.crypto.subtle.generateKey(this.rsaHashedParams, extractable, keyUsages).then(resolve, reject)
    })
  }

  /**
   *
   * 'JWK': Json Web key (ref. http://tools.ietf.org/html/draft-ietf-jose-json-web-key-11)
   * 'spki': for private key
   * 'pkcs8': for private Key
   *
   * @param keyPair is {publicKey: CryptoKey, privateKey: CryptoKey}
   * @param privKeyFormat will be 'pkcs8' or 'jwk'
   * @param pubKeyFormat will be 'spki' or 'jwk'
   * @returns {Promise} will the AES Key
   */
  exportKeys(keyPair: KeyPair<CryptoKey>, privKeyFormat: 'jwk', pubKeyFormat: 'jwk'): Promise<KeyPair<JsonWebKey>>
  exportKeys(keyPair: KeyPair<CryptoKey>, privKeyFormat: 'pkcs8', pubKeyFormat: 'spki'): Promise<KeyPair<ArrayBuffer>>
  exportKeys(keyPair: KeyPair<CryptoKey>, privKeyFormat: string, pubKeyFormat: string): Promise<KeyPair<JsonWebKey | ArrayBuffer>> {
    const pubPromise = this.crypto.subtle.exportKey(pubKeyFormat as any, keyPair.publicKey)
    const privPromise = this.crypto.subtle.exportKey(privKeyFormat as any, keyPair.privateKey)

    return Promise.all([pubPromise, privPromise]).then(function (results) {
      return {
        publicKey: results[0],
        privateKey: results[1],
      }
    })
  }

  /**
   *  Format:
   *
   * 'JWK': Json Web key (ref. http://tools.ietf.org/html/draft-ietf-jose-json-web-key-11)
   * 'spki': for private key
   * 'pkcs8': for private Key
   *
   * @param cryptoKey public or private
   * @param format either 'jwk' or 'spki' or 'pkcs8'
   * @returns {Promise|*} will be RSA key (public or private)
   */
  exportKey(cryptoKey: CryptoKey, format: 'jwk'): Promise<JsonWebKey>
  exportKey(cryptoKey: CryptoKey, format: 'spki'): Promise<ArrayBuffer>
  exportKey(cryptoKey: CryptoKey, format: 'pkcs8'): Promise<ArrayBuffer>
  exportKey(cryptoKey: CryptoKey, format: string): Promise<JsonWebKey | ArrayBuffer> {
    return new Promise((resolve: (value: JsonWebKey | ArrayBuffer) => any, reject) => {
      this.crypto.subtle.exportKey(format as any, cryptoKey).then(resolve, reject)
    })
  }

  /**
   *
   * @param publicKey (CryptoKey)
   * @param plainData (Uint8Array)
   */
  encrypt(publicKey: CryptoKey, plainData: Uint8Array): Promise<ArrayBuffer> {
    return new Promise((resolve: (value: ArrayBuffer) => any, reject) => {
      this.crypto.subtle.encrypt(this.rsaParams, publicKey, plainData.buffer ? plainData.buffer : plainData).then(resolve, reject) //Node prefers arrayBuffer
    })
  }

  /**
   *
   * @param privateKey (CryptoKey)
   * @param encryptedData (Uint8Array)
   */
  decrypt(privateKey: CryptoKey, encryptedData: Uint8Array): Promise<ArrayBuffer> {
    return new Promise((resolve: (value: ArrayBuffer) => any, reject) => {
      this.crypto.subtle.decrypt(this.rsaParams, privateKey, encryptedData).then(resolve, reject)
    })
  }

  /**
   *
   * @param format 'jwk', 'spki', or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @param keyUsages Array of usages. For example, ['encrypt'] for public key.
   * @returns {*}
   */
  importKey(format: string, keydata: JsonWebKey | ArrayBuffer, keyUsages: KeyUsage[]): Promise<CryptoKey> {
    const extractable = true
    return new Promise((resolve: (value: CryptoKey) => any, reject) => {
      this.crypto.subtle.importKey(format as any, keydata as any, this.rsaHashedParams, extractable, keyUsages).then(resolve, reject)
    })
  }

  /**
   *
   * @param format 'jwk' or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @returns {*}
   */
  importPrivateKey(format: string, keydata: JsonWebKey | ArrayBuffer): Promise<CryptoKey> {
    const extractable = true
    return new Promise((resolve: (value: CryptoKey) => any, reject) => {
      this.crypto.subtle.importKey(format as any, keydata as any, this.rsaHashedParams, extractable, ['decrypt']).then(resolve, reject)
    })
  }

  /**
   *
   * @param privateKeyFormat 'jwk' or 'pkcs8'
   * @param privateKeydata    should be the key data based on the format.
   * @param publicKeyFormat 'jwk' or 'spki'
   * @param publicKeyData should be the key data based on the format.
   * @returns {Promise|*}
   */
  importKeyPair(
    privateKeyFormat: string,
    privateKeydata: JsonWebKey | ArrayBuffer,
    publicKeyFormat: string,
    publicKeyData: JsonWebKey | ArrayBuffer
  ): Promise<KeyPair<CryptoKey>> {
    const extractable = true
    const privPromise = this.crypto.subtle.importKey(privateKeyFormat as any, privateKeydata as any, this.rsaHashedParams, extractable, ['decrypt'])
    const pubPromise = this.crypto.subtle.importKey(publicKeyFormat as any, publicKeyData as any, this.rsaHashedParams, extractable, ['encrypt'])

    return Promise.all([pubPromise, privPromise]).then(function (results) {
      return {
        publicKey: results[0],
        privateKey: results[1],
      }
    })
  }

  /**
   * Tries to encrypt then decrypt data using a keypair. If both operations succeed without throwing an error and the decrypted data matches the
   * original data returns true, else false.
   * @param keyPair a key pair.
   * @return if the key pair could be successfully used to encrypt then decrypt data.
   */
  async checkKeyPairValidity(keyPair: KeyPair<CryptoKey>): Promise<boolean> {
    try {
      const text = 'shibboleth'
      const encryptedText = await this.encrypt(keyPair.publicKey, utf8_2ua(text))
      const decryptedText = ua2utf8(await this.decrypt(keyPair.privateKey, new Uint8Array(encryptedText)))
      return decryptedText === text
    } catch (e) {
      return false
    }
  }
}

export const RSA = new RSAUtils()
