import { RSAUtils, RSAUtilsImpl } from './RSA'
import { AESUtils, AESUtilsImpl } from './AES'
import { ShamirClass, WebcryptoShamir } from './shamir'
import { HMACUtils, HMACUtilsImpl } from './HMACUtils'

export interface CryptoPrimitives {
  readonly shamir: ShamirClass
  readonly RSA: RSAUtils
  readonly AES: AESUtils
  readonly HMAC: HMACUtils
  /**
   * Generates a UUID using a cryptographically secure random number generator.
   */
  randomUuid(): string
  /**
   * @param data some data
   * @return the sha256 hash of {@link data}
   */
  sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer>
  /**
   * @param n how many bytes to generate
   * @return an array with n random bytes
   */
  randomBytes(n: number): Uint8Array
}

/**
 * Gives access to cryptographic primitives.
 */
export class WebCryptoPrimitives implements CryptoPrimitives {
  private readonly _rsa: RSAUtils
  private readonly _aes: AESUtils
  private readonly _shamir: ShamirClass
  private readonly _crypto: Crypto
  private readonly _hmac: HMACUtils

  get crypto(): Crypto {
    return this._crypto
  }

  get shamir(): ShamirClass {
    return this._shamir
  }

  get RSA(): RSAUtils {
    return this._rsa
  }

  get AES(): AESUtils {
    return this._aes
  }

  get HMAC(): HMACUtils {
    return this._hmac
  }

  constructor(crypto: Crypto = typeof window !== 'undefined' ? window.crypto : typeof self !== 'undefined' ? self.crypto : ({} as Crypto)) {
    this._crypto = crypto
    this._rsa = new RSAUtilsImpl(crypto)
    this._aes = new AESUtilsImpl(crypto)
    this._shamir = new WebcryptoShamir(crypto)
    this._hmac = new HMACUtilsImpl(crypto)
  }

  randomUuid() {
    return ((1e7).toString() + -1e3 + -4e3 + -8e3 + -1e11).replace(
      /[018]/g,
      //Keep next inlined or you will lose the random
      (c) => (Number(c) ^ ((this.crypto.getRandomValues(new Uint8Array(1))! as Uint8Array)[0] & (15 >> (Number(c) / 4)))).toString(16)
    )
  }

  sha256(data: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
    return this.crypto.subtle.digest('SHA-256', data)
  }

  randomBytes(n: number): Uint8Array {
    const res = new Uint8Array(n)
    this.crypto.getRandomValues(res)
    return res
  }
}
