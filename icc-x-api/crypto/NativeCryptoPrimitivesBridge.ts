import { CryptoPrimitives } from './CryptoPrimitives'
import { HMACUtils } from './HMACUtils'
import { ShamirClass } from './shamir'
import { AESUtils } from './AES'
import { KeyPair, RSAUtils, ShaVersion } from './RSA'
import { b64_2ua, hex2ua, ua2b64, ua2hex, ua2utf8, utf8_2ua } from '../utils'
import { randomBytes } from 'crypto'

/**
 * Allows to use the expo-kryptom module as crypto primitives. This is necessary when building expo (react native) apps.
 */
export class NativeCryptoPrimitivesBridge implements CryptoPrimitives {
  constructor(expoKryptomModule: { Aes: AesService; Rsa: RsaService; Hmac: HmacService; StrongRandom: StrongRandomService; Digest: DigestService }) {
    this.strongRandom = expoKryptomModule.StrongRandom
    this.digest = expoKryptomModule.Digest
    this.shamir = new StrongRandomShamir(this.strongRandom)
    this.AES = new NativeAesBridge(expoKryptomModule.Aes, this.strongRandom)
    this.HMAC = new NativeHmacBridge(expoKryptomModule.Hmac)
    this.RSA = new NativeRsaBridge(expoKryptomModule.Rsa)
  }

  readonly AES: AESUtils
  readonly HMAC: HMACUtils
  readonly RSA: RSAUtils
  readonly shamir: ShamirClass
  private readonly strongRandom: StrongRandomService
  private readonly digest: DigestService

  randomBytes(n: number): Uint8Array {
    return this.strongRandom.randomBytes(n)
  }

  randomUuid(): string {
    return this.strongRandom.randomUUID()
  }

  async sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    return await this.digest.sha256(data instanceof ArrayBuffer ? new Uint8Array(data) : data)
  }
}

class StrongRandomShamir extends ShamirClass {
  constructor(private readonly strongRandom: StrongRandomService) {
    super()
  }

  protected fillRandom(arr: Uint32Array): void {
    const random = this.strongRandom.randomBytes(arr.byteLength)
    // Note that the new Uint32Array does not copy the random array
    arr.set(new Uint32Array(random.buffer))
  }
}

class NativeAesBridge implements AESUtils {
  constructor(private readonly aes: AesService, private readonly random: StrongRandomService) {}

  async decrypt(cryptoKey: CryptoKey, encryptedData: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    return await this.aes.decrypt(new Uint8Array(encryptedData), getKryptomKey(cryptoKey))
  }

  decryptSome(cryptoKeys: CryptoKey[], uint8Array: Uint8Array): Promise<ArrayBuffer> {
    try {
      return this.decrypt(cryptoKeys[0], uint8Array)
    } catch (e) {
      if (cryptoKeys.length > 1) {
        return this.decryptSome(cryptoKeys.slice(1), uint8Array)
      } else {
        throw e
      }
    }
  }

  async decryptWithRawKey(rawKey: string, plainData: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    const imported = await this.importKey('raw', hex2ua(rawKey))
    return this.decrypt(imported, plainData)
  }

  async encrypt(cryptoKey: CryptoKey, plainData: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    return await this.aes.encrypt(new Uint8Array(plainData), getKryptomKey(cryptoKey), null)
  }

  async encryptWithRawKey(rawKey: string, plainData: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    const imported = await this.importKey('raw', hex2ua(rawKey))
    return this.encrypt(imported, plainData)
  }

  exportKey(cryptoKey: CryptoKey, format: 'raw'): Promise<ArrayBuffer>
  exportKey(cryptoKey: CryptoKey, format: 'jwk'): Promise<JsonWebKey>
  async exportKey(cryptoKey: CryptoKey, format: 'jwk' | 'raw'): Promise<ArrayBuffer | JsonWebKey> {
    const rawKey = await this.aes.exportRawKey(getKryptomKey(cryptoKey))
    if (format == 'raw') return rawKey
    return {
      kty: 'oct',
      alg: rawKey.byteLength == 32 ? 'A256CBC' : 'A128CBC',
      ext: true,
      key_ops: ['encrypt', 'decrypt'],
      k: ua2b64(rawKey).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'),
    }
  }

  generateCryptoKey(toHex: false): Promise<CryptoKey>
  generateCryptoKey(toHex: true): Promise<string>
  async generateCryptoKey(toHex: boolean): Promise<string | CryptoKey> {
    if (toHex) {
      return Promise.resolve(ua2hex(this.random.randomBytes(32)))
    } else {
      const aesKey = await this.aes.generateKey(AesAlgorithm.AesCbcPkcs7, 256)
      return new AesCryptoKey(aesKey, 256)
    }
  }

  generateIV(ivByteLength: number): Uint8Array {
    return randomBytes(ivByteLength)
  }

  async importKey(format: 'jwk' | 'raw', aesKey: JsonWebKey | ArrayBuffer | Uint8Array): Promise<CryptoKey> {
    let keyBytes: Uint8Array
    if (format === 'jwk') {
      if (
        (aesKey as JsonWebKey).kty !== 'oct' ||
        ((aesKey as JsonWebKey).alg !== 'A256CBC' && (aesKey as JsonWebKey).alg !== 'A128CBC') ||
        !(aesKey as JsonWebKey).ext ||
        !(aesKey as JsonWebKey).key_ops?.includes('encrypt') ||
        !(aesKey as JsonWebKey).key_ops?.includes('decrypt') ||
        !(aesKey as JsonWebKey).k
      ) {
        throw new Error(
          'Invalid JWK - must have kty=oct, alg=(A256CBC||A128CBC), ext=true, key_ops=[encrypt, decrypt], and must have non-empty k field'
        )
      }
      // b64_2ua works also with url-safe base64
      keyBytes = new Uint8Array(b64_2ua((aesKey as JsonWebKey).k!))
    } else if (format === 'raw') {
      if (aesKey! instanceof ArrayBuffer && !ArrayBuffer.isView(aesKey))
        throw new Error("aesKey must be an ArrayBuffer or an ArrayBufferView when format is 'raw'")
      keyBytes = new Uint8Array(aesKey as ArrayBufferLike)
    } else throw new Error(`Invalid format ${format}`)
    const imported = await this.aes.importRawKey(keyBytes, AesAlgorithm.AesCbcPkcs7)
    return new AesCryptoKey(imported, keyBytes.length)
  }
}

function getKryptomKey<T>(cryptoKey: CryptoKey) {
  if ('kryptomKey' in cryptoKey) {
    return cryptoKey.kryptomKey as T
  } else throw new Error('Invalid crypto key: only crypto keys generated or loaded with this implementation of crypto primitives are supported')
}

class AesCryptoKey implements CryptoKey {
  constructor(readonly kryptomKey: AesKey, readonly size: number) {}

  get algorithm(): AesKeyAlgorithm {
    return { name: 'AES-CBC', length: this.size }
  }
  get extractable(): boolean {
    return true
  }
  get type(): KeyType {
    return 'secret'
  }
  get usages(): KeyUsage[] {
    return ['encrypt', 'decrypt']
  }

  toJSON() {
    return {}
  }
}

class NativeHmacBridge implements HMACUtils {
  constructor(private readonly hmac: HmacService) {}

  async exportKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await this.hmac.exportRawKey(getKryptomKey(key))
  }

  async generateKey(): Promise<CryptoKey> {
    const kryptomKey = await this.hmac.generateKey(HmacAlgorithm.HmacSha512)
    return new HmacCryptoKey(kryptomKey)
  }

  async importKey(key: ArrayBuffer): Promise<CryptoKey> {
    const kryptomKey = await this.hmac.importRawKey(new Uint8Array(key), HmacAlgorithm.HmacSha512)
    return new HmacCryptoKey(kryptomKey)
  }

  async sign(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return await this.hmac.sign(new Uint8Array(data), getKryptomKey(key))
  }

  async verify(key: CryptoKey, data: ArrayBuffer, signature: ArrayBuffer): Promise<boolean> {
    return await this.hmac.verify(new Uint8Array(signature), new Uint8Array(data), getKryptomKey(key))
  }
}

class HmacCryptoKey implements CryptoKey {
  constructor(readonly kryptomKey: HmacKey) {}

  get algorithm(): HmacKeyAlgorithm {
    return { name: 'HMAC', hash: { name: 'SHA-512' }, length: 1024 }
  }
  get extractable(): boolean {
    return true
  }
  get type(): KeyType {
    return 'secret'
  }
  get usages(): KeyUsage[] {
    return ['sign', 'verify']
  }

  toJSON() {
    return {}
  }
}

class NativeRsaBridge implements RSAUtils {
  constructor(private readonly rsa: RsaService) {}

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

  async decrypt(privateKey: CryptoKey, encryptedData: Uint8Array): Promise<ArrayBuffer> {
    return await this.rsa.decrypt(encryptedData, getKryptomKey(privateKey))
  }

  async encrypt(publicKey: CryptoKey, plainData: Uint8Array): Promise<ArrayBuffer> {
    return await this.rsa.encrypt(plainData, getKryptomKey(publicKey))
  }

  exportKey(cryptoKey: CryptoKey, format: 'jwk'): Promise<JsonWebKey>
  exportKey(cryptoKey: CryptoKey, format: 'spki'): Promise<ArrayBuffer>
  exportKey(cryptoKey: CryptoKey, format: 'pkcs8'): Promise<ArrayBuffer>
  async exportKey(cryptoKey: CryptoKey, format: 'jwk' | 'spki' | 'pkcs8'): Promise<JsonWebKey | ArrayBuffer> {
    if (format === 'jwk') {
      if (cryptoKey.type === 'private') {
        return await this.rsa.exportPrivateKeyJwk(getKryptomKey(cryptoKey))
      } else {
        return await this.rsa.exportPublicKeyJwk(getKryptomKey(cryptoKey))
      }
    } else if (format === 'spki') {
      return await this.rsa.exportPrivateKeyPkcs8(getKryptomKey(cryptoKey))
    } else if (format === 'pkcs8') {
      return await this.rsa.exportPublicKeySpki(getKryptomKey(cryptoKey))
    } else throw new Error(`Invalid format ${format}`)
  }

  exportKeys(keyPair: KeyPair<CryptoKey>, privKeyFormat: 'jwk', pubKeyFormat: 'jwk'): Promise<KeyPair<JsonWebKey>>
  exportKeys(keyPair: KeyPair<CryptoKey>, privKeyFormat: 'pkcs8', pubKeyFormat: 'spki'): Promise<KeyPair<ArrayBuffer>>
  async exportKeys(
    keyPair: KeyPair<CryptoKey>,
    privKeyFormat: 'jwk' | 'pkcs8',
    pubKeyFormat: 'jwk' | 'spki'
  ): Promise<KeyPair<JsonWebKey | ArrayBuffer>> {
    let privateKey: JsonWebKey | ArrayBuffer
    if (privKeyFormat === 'jwk') {
      privateKey = await this.rsa.exportPrivateKeyJwk(getKryptomKey(keyPair.privateKey))
    } else {
      privateKey = await this.rsa.exportPrivateKeyPkcs8(getKryptomKey(keyPair.privateKey))
    }
    let publicKey: JsonWebKey | ArrayBuffer
    if (pubKeyFormat === 'jwk') {
      publicKey = await this.rsa.exportPublicKeyJwk(getKryptomKey(keyPair.publicKey))
    } else {
      publicKey = await this.rsa.exportPublicKeySpki(getKryptomKey(keyPair.publicKey))
    }
    return { privateKey, publicKey }
  }

  async generateKeyPair(shaVersion: ShaVersion): Promise<KeyPair<CryptoKey>> {
    const generated = await this.rsa.generateKey(this.kryptomAlgorithm(shaVersion), 2048)
    // In expo-kryptom a private keys and public keys are supertypes of keypair.
    return {
      privateKey: new PrivateRsaCryptoKey(generated, this.encryptionKeysAlgorithm(shaVersion)),
      publicKey: new PublicRsaCryptoKey(generated, this.encryptionKeysAlgorithm(shaVersion)),
    }
  }

  async generateSignatureKeyPair(): Promise<KeyPair<CryptoKey>> {
    const generated = await this.rsa.generateKey(RsaSignatureAlgorithm.PssWithSha256, 2048)
    return {
      privateKey: new PrivateRsaCryptoKey(generated, this.signatureKeysAlgorithm()),
      publicKey: new PublicRsaCryptoKey(generated, this.signatureKeysAlgorithm()),
    }
  }

  importKey(
    format: 'jwk' | 'spki' | 'pkcs8',
    keydata: JsonWebKey | ArrayBuffer,
    keyUsages: KeyUsage[],
    hashAlgorithm: ShaVersion
  ): Promise<CryptoKey> {
    if (keyUsages[0] == 'encrypt' && (format == 'jwk' || format == 'spki')) {
      return this.importPublicKey(format, keydata, hashAlgorithm)
    } else if (keyUsages[0] == 'decrypt' && (format == 'jwk' || format == 'pkcs8')) {
      return this.importPrivateKey(format, keydata, hashAlgorithm)
    } else throw new Error(`Combination of key usages and key format not supported: ${keyUsages} ${format}`)
  }

  async importKeyPair(
    privateKeyFormat: string,
    privateKeydata: JsonWebKey | ArrayBuffer,
    publicKeyFormat: string,
    publicKeyData: JsonWebKey | ArrayBuffer,
    hashAlgorithm: ShaVersion
  ): Promise<KeyPair<CryptoKey>> {
    let importedPrivate: RsaPrivateKey
    let importedPublic: RsaPublicKey
    const algorithm = this.kryptomAlgorithm(hashAlgorithm)
    if (privateKeyFormat == 'jwk') {
      importedPrivate = await this.rsa.importPrivateKeyJwk(privateKeydata as PrivateRsaKeyJwk, algorithm)
    } else {
      importedPrivate = await this.rsa.importPrivateKeyPkcs8(new Uint8Array(privateKeydata as ArrayBuffer), algorithm)
    }
    if (publicKeyFormat == 'jwk') {
      importedPublic = await this.rsa.importPublicKeyJwk(publicKeyData as PublicRsaKeyJwk, algorithm)
    } else {
      importedPublic = await this.rsa.importPublicKeySpki(new Uint8Array(publicKeyData as ArrayBuffer), algorithm)
    }
    return {
      privateKey: new PrivateRsaCryptoKey(importedPrivate, this.encryptionKeysAlgorithm(hashAlgorithm)),
      publicKey: new PublicRsaCryptoKey(importedPublic, this.encryptionKeysAlgorithm(hashAlgorithm)),
    }
  }

  async importPrivateKey(format: 'jwk' | 'pkcs8', keydata: JsonWebKey | ArrayBuffer, hashAlgorithm: ShaVersion): Promise<CryptoKey> {
    let imported: RsaPrivateKey
    if (format == 'jwk') {
      imported = await this.rsa.importPrivateKeyJwk(keydata as PrivateRsaKeyJwk, this.kryptomAlgorithm(hashAlgorithm))
    } else {
      imported = await this.rsa.importPrivateKeyPkcs8(new Uint8Array(keydata as ArrayBuffer), this.kryptomAlgorithm(hashAlgorithm))
    }
    return new PrivateRsaCryptoKey(imported, this.encryptionKeysAlgorithm(hashAlgorithm))
  }

  async importPublicKey(format: 'jwk' | 'spki', keydata: JsonWebKey | ArrayBuffer, hashAlgorithm: ShaVersion): Promise<CryptoKey> {
    let imported: RsaPublicKey
    if (format == 'jwk') {
      imported = await this.rsa.importPublicKeyJwk(keydata as PublicRsaKeyJwk, this.kryptomAlgorithm(hashAlgorithm))
    } else {
      imported = await this.rsa.importPublicKeySpki(new Uint8Array(keydata as ArrayBuffer), this.kryptomAlgorithm(hashAlgorithm))
    }
    return new PublicRsaCryptoKey(imported, this.encryptionKeysAlgorithm(hashAlgorithm))
  }

  async importSignatureKey(format: 'jwk' | 'pkcs8', keydata: JsonWebKey | ArrayBuffer): Promise<CryptoKey> {
    let importedKey: RsaPrivateKey
    if (format == 'jwk') {
      importedKey = await this.rsa.importPrivateKeyJwk(keydata as PrivateRsaKeyJwk, RsaSignatureAlgorithm.PssWithSha256)
    } else {
      importedKey = await this.rsa.importPrivateKeyPkcs8(new Uint8Array(keydata as ArrayBuffer), RsaSignatureAlgorithm.PssWithSha256)
    }
    return new PrivateRsaCryptoKey(importedKey, this.signatureKeysAlgorithm())
  }

  async importVerificationKey(format: 'jwk' | 'spki', keydata: JsonWebKey | ArrayBuffer): Promise<CryptoKey> {
    let importedKey: RsaPublicKey
    if (format == 'jwk') {
      importedKey = await this.rsa.importPublicKeyJwk(keydata as PublicRsaKeyJwk, RsaSignatureAlgorithm.PssWithSha256)
    } else {
      importedKey = await this.rsa.importPublicKeySpki(new Uint8Array(keydata as ArrayBuffer), RsaSignatureAlgorithm.PssWithSha256)
    }
    return new PublicRsaCryptoKey(importedKey, this.signatureKeysAlgorithm())
  }

  async sign(privateKey: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    return await this.rsa.signature(new Uint8Array(data), getKryptomKey(privateKey))
  }

  async verifySignature(publicKey: CryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean> {
    return await this.rsa.verify(new Uint8Array(signature), new Uint8Array(data), getKryptomKey(publicKey))
  }

  private kryptomAlgorithm(shaVersion: ShaVersion): RsaEncryptionAlgorithm {
    return shaVersion == 'sha-256' ? RsaEncryptionAlgorithm.OaepWithSha256 : RsaEncryptionAlgorithm.OaepWithSha1
  }

  private encryptionKeysAlgorithm(shaVersion: ShaVersion): RsaHashedKeyAlgorithm {
    return {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Equivalent to 65537 (Fermat F4), read http://en.wikipedia.org/wiki/65537_(number)
      hash: { name: shaVersion == 'sha-256' ? 'SHA-256' : 'SHA-1' },
    }
  }

  private signatureKeysAlgorithm(): RsaHashedKeyAlgorithm {
    return {
      name: 'RSA-PSS',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // Equivalent to 65537 (Fermat F4), read http://en.wikipedia.org/wiki/65537_(number)
      hash: { name: 'SHA-256' },
    }
  }
}

class PrivateRsaCryptoKey implements CryptoKey {
  constructor(readonly kryptomKey: RsaPrivateKey, readonly algorithm: RsaKeyAlgorithm) {}

  get extractable(): boolean {
    return true
  }

  get type(): KeyType {
    return 'private'
  }

  get usages(): KeyUsage[] {
    return this.algorithm.name != 'RSA-PSS' ? ['decrypt'] : ['sign']
  }

  toJSON() {
    return {}
  }
}

class PublicRsaCryptoKey implements CryptoKey {
  constructor(readonly kryptomKey: RsaPublicKey, readonly algorithm: RsaKeyAlgorithm) {}

  get extractable(): boolean {
    return true
  }

  get type(): KeyType {
    return 'public'
  }

  get usages(): KeyUsage[] {
    return this.algorithm.name != 'RSA-PSS' ? ['encrypt'] : ['verify']
  }

  toJSON() {
    return {}
  }
}

enum AesAlgorithm {
  AesCbcPkcs7 = 'AesCbcPkcs7',
}
enum RsaEncryptionAlgorithm {
  OaepWithSha1 = 'OaepWithSha1',
  OaepWithSha256 = 'OaepWithSha256',
}
enum RsaSignatureAlgorithm {
  PssWithSha256 = 'PssWithSha256',
}
type RsaAlgorithm = RsaEncryptionAlgorithm | RsaSignatureAlgorithm
enum HmacAlgorithm {
  HmacSha512 = 'HmacSha512',
}

interface HmacKey {
  algorithmIdentifier: HmacAlgorithm
}

interface AesKey {
  algorithmIdentifier: AesAlgorithm
}

interface RsaKeyPair {
  algorithmIdentifier: RsaAlgorithm
}

interface RsaPrivateKey {
  algorithmIdentifier: RsaAlgorithm
}

interface RsaPublicKey {
  algorithmIdentifier: RsaAlgorithm
}

type PrivateRsaKeyJwk = {
  alg: string
  d: string
  dp: string
  dq: string
  e: string
  ext: boolean
  key_ops: string[]
  n: string
  p: string
  q: string
  qi: string
}

type PublicRsaKeyJwk = {
  alg: string
  e: string
  ext: boolean
  key_ops: string[]
  n: string
}

interface AesService {
  generateKey(algorithmIdentifier: AesAlgorithm, size: number): Promise<AesKey>
  encrypt(data: Uint8Array, key: AesKey, iv: Uint8Array | null): Promise<Uint8Array>
  decrypt(ivAndEncryptedData: Uint8Array, key: AesKey): Promise<Uint8Array>
  exportRawKey(key: AesKey): Promise<Uint8Array>
  importRawKey(rawKey: Uint8Array, algorithmIdentifier: AesAlgorithm): Promise<AesKey>
}

interface RsaService {
  generateKey(algorithmIdentifier: RsaAlgorithm, size: number): Promise<RsaKeyPair>
  encrypt(data: Uint8Array, key: RsaPublicKey): Promise<Uint8Array>
  decrypt(data: Uint8Array, key: RsaPrivateKey): Promise<Uint8Array>
  signature(data: Uint8Array, key: RsaPrivateKey): Promise<Uint8Array>
  verify(signature: Uint8Array, data: Uint8Array, key: RsaPublicKey): Promise<boolean>
  exportPrivateKeyPkcs8(key: RsaPrivateKey): Promise<Uint8Array>
  exportPrivateKeyJwk(key: RsaPrivateKey): Promise<PrivateRsaKeyJwk>
  exportPublicKeySpki(key: RsaPublicKey): Promise<Uint8Array>
  exportPublicKeyJwk(key: RsaPublicKey): Promise<PublicRsaKeyJwk>
  importPrivateKeyPkcs8(privateKeyPkcs8: Uint8Array, algorithmIdentifier: RsaAlgorithm): Promise<RsaPrivateKey>
  importPrivateKeyJwk(privateKey: PrivateRsaKeyJwk, algorithmIdentifier: RsaAlgorithm): Promise<RsaPrivateKey>
  importPublicKeySpki(publicKeySpki: Uint8Array, algorithmIdentifier: RsaAlgorithm): Promise<RsaPublicKey>
  importPublicKeyJwk(publicKey: PublicRsaKeyJwk, algorithmIdentifier: RsaAlgorithm): Promise<RsaPublicKey>
  importKeyPair(privateKeyPkcs8: Uint8Array, algorithmIdentifier: RsaAlgorithm): Promise<RsaKeyPair>
}

interface HmacService {
  generateKey(algorithmIdentifier: HmacAlgorithm): Promise<HmacKey>
  sign(data: Uint8Array, key: HmacKey): Promise<Uint8Array>
  verify(signature: Uint8Array, data: Uint8Array, key: HmacKey): Promise<boolean>
  exportRawKey(key: HmacKey): Promise<Uint8Array>
  importRawKey(rawKey: Uint8Array, algorithmIdentifier: HmacAlgorithm): Promise<HmacKey>
}

interface StrongRandomService {
  randomBytes(length: number): Uint8Array
  randomUUID(): string
}

interface DigestService {
  sha256(data: Uint8Array): Promise<Uint8Array>
}
