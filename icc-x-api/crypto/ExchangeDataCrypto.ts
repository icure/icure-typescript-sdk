/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * Functions to encrypt and decrypt exchange data.
 */
import { KeyPair, RSAUtils } from './RSA'
import { AESUtils } from './AES'

export class ExchangeDataCrypto {
  private RSA: RSAUtils
  private AES: AESUtils

  constructor(RSA: RSAUtils, AES: AESUtils) {
    this.RSA = RSA
    this.AES = AES
  }

  async createEncryptedExchangeKeyFor(publicKeys: string[]): Promise<{
    exchangeKey: CryptoKey
    encryptedExchangeKey: { [pubKeyFp: string]: string }
  }> {
    throw 'TODO'
  }

  /**
   * Attempts to decrypt an exchange key using any of the provided key pairs.
   * @param encryptedExchangeKey an encrypted exchange key.
   * @param keyPairsByFingerprint rsa key pairs to use for decryption.
   * @return the decrypted exchange key or undefined if the key could not be decrypted using the provided keys.
   */
  tryDecryptExchangeKey(
    encryptedExchangeKey: { [publicKeyFingerprint: string]: string },
    keyPairsByFingerprint: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<CryptoKey | undefined> {
    throw 'TODO'
  }

  /**
   * Attempts to decrypt many exchange keys using any of the provided key pairs.
   * @param encryptedExchangeKeys an array of encrypted exchange keys.
   * @param keyPairsByFingerprint rsa key pairs to use for decryption.
   * @return an array all successfully decrypted exchange keys and an array containing all exchange keys which could not be decrypted.
   */
  tryDecryptExchangeKeys(
    encryptedExchangeKeys: { [publicKeyFingerprint: string]: string }[],
    keyPairsByFingerprint: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{
    successfulDecryptions: CryptoKey[]
    failedDecryptions: { [publicKeyFingerprint: string]: string }[]
  }> {
    throw 'TODO'
  }
}
