import { ua2utf8, utf8_2ua } from '../utils'

/**
 * Represents an RSA KeyPair in a generic format.
 */
export type KeyPair<T> = { publicKey: T; privateKey: T }

export type ShaVersion = 'sha-1' | 'sha-256'

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
  rsaWithSha256HashedParams: any = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Equivalent to 65537 (Fermat F4), read http://en.wikipedia.org/wiki/65537_(number)
    hash: { name: 'SHA-256' },
  }
  private readonly signatureKeysGenerationParams = {
    name: 'RSA-PSS',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Equivalent to 65537 (Fermat F4), read http://en.wikipedia.org/wiki/65537_(number)
    hash: { name: 'SHA-256' },
  }

  private crypto: Crypto

  constructor(crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto)) {
    this.crypto = crypto
  }

  /**
   * Generates a key pair for encryption/decryption of data.
   * @param shaVersion the version of the SHA algorithm to use.
   */
  generateKeyPair(shaVersion: ShaVersion): Promise<KeyPair<CryptoKey>> {
    const extractable = true
    const keyUsages: KeyUsage[] = ['decrypt', 'encrypt']
    const rsaParams = this.paramsForCreationOrImport(shaVersion)

    return new Promise<KeyPair<CryptoKey>>((resolve, reject) => {
      this.crypto.subtle.generateKey(rsaParams, extractable, keyUsages).then(resolve, reject)
    })
  }

  /**
   * Generates a key pair for signing data and signature verification.
   */
  async generateSignatureKeyPair(): Promise<KeyPair<CryptoKey>> {
    return await this.crypto.subtle.generateKey(this.signatureKeysGenerationParams, true, ['sign', 'verify'])
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
   * @param hashAlgorithm 'sha-1' or 'sha-256'
   * @returns {*}
   */
  importKey(format: string, keydata: JsonWebKey | ArrayBuffer, keyUsages: KeyUsage[], hashAlgorithm: ShaVersion): Promise<CryptoKey> {
    const extractable = true
    return new Promise((resolve: (value: CryptoKey) => any, reject) => {
      const rsaParams = this.paramsForCreationOrImport(hashAlgorithm)
      this.crypto.subtle.importKey(format as any, keydata as any, rsaParams, extractable, keyUsages).then(resolve, reject)
    })
  }

  private paramsForCreationOrImport(shaVersion: ShaVersion) {
    if (shaVersion === 'sha-1') {
      return this.rsaHashedParams
    } else if (shaVersion === 'sha-256') {
      return this.rsaWithSha256HashedParams
    } else {
      throw new Error('Unexpected error, invalid SHA version')
    }
  }

  /**
   *
   * @param format 'jwk' or 'pkcs8'
   * @param keydata should be the key data based on the format.
   * @param hashAlgorithm 'sha-1' or 'sha-256'
   * @returns {*}
   */
  importPrivateKey(format: string, keydata: JsonWebKey | ArrayBuffer, hashAlgorithm: ShaVersion): Promise<CryptoKey> {
    const extractable = true
    return new Promise((resolve: (value: CryptoKey) => any, reject) => {
      const rsaParams = this.paramsForCreationOrImport(hashAlgorithm)
      this.crypto.subtle.importKey(format as any, keydata as any, rsaParams, extractable, ['decrypt']).then(resolve, reject)
    })
  }

  /**
   *
   * @param privateKeyFormat 'jwk' or 'pkcs8'
   * @param privateKeydata    should be the key data based on the format.
   * @param publicKeyFormat 'jwk' or 'spki'
   * @param publicKeyData should be the key data based on the format.
   * @param hashAlgorithm 'sha-1' or 'sha-256'
   * @returns {Promise|*}
   */
  importKeyPair(
    privateKeyFormat: string,
    privateKeydata: JsonWebKey | ArrayBuffer,
    publicKeyFormat: string,
    publicKeyData: JsonWebKey | ArrayBuffer,
    hashAlgorithm: ShaVersion
  ): Promise<KeyPair<CryptoKey>> {
    const extractable = true
    const rsaParams = this.paramsForCreationOrImport(hashAlgorithm)
    const privPromise = this.crypto.subtle.importKey(privateKeyFormat as any, privateKeydata as any, rsaParams, extractable, ['decrypt'])
    const pubPromise = this.crypto.subtle.importKey(publicKeyFormat as any, publicKeyData as any, rsaParams, extractable, ['encrypt'])

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

  /**
   * Generates a signature for some data. The signature algorithm used is RSA-PSS with SHA-256.
   * @param privateKey private key to use for signature
   * @param data the data to sign
   * @return the signature.
   */
  async sign(privateKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return await this.crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, privateKey, data)
  }

  /**
   * Verifies if a signature matches the data. The signature algorithm used is RSA-PSS with sha-256.
   * @param publicKey public key to use for signature verification.
   * @param signature the signature to verify
   * @param data the data that was signed
   * @return if the signature matches the data and key.
   */
  async verifySignature(publicKey: CryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean> {
    return await this.crypto.subtle.verify({ name: 'RSA-PSS', saltLength: 32 }, publicKey, signature, data)
  }
}

export const RSA = new RSAUtils()
