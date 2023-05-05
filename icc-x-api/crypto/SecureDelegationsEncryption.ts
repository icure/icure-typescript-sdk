import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { b64_2ua, hex2ua, ua2b64, ua2hex, ua2utf8, utf8_2ua } from '../utils'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { CryptoPrimitives } from './CryptoPrimitives'

/**
 * @internal this class is for internal use only and may be changed without notice.
 */
export class SecureDelegationsEncryption {
  constructor(private readonly userKeys: UserEncryptionKeysManager, private readonly primitives: CryptoPrimitives) {}

  /**
   * WARNING: this value should be ALWAYS be the string 'Cure'. If changed, it would not be possible to decrypt old secretIds and owningEntityIds
   * anymore.
   * @private
   */
  private readonly icureIV: string = 'Cure'

  /**
   * If the secure delegation has an encrypted exchange data id attempts to decrypt it with the available keys for the current user.
   * @param secureDelegation a secure delegation.
   * @return the id of the exchange data used for the encryption of the provided secure delegation if it was encrypted and could be decrypted,
   * undefined otherwise (there was no encrypted id of the exchange data, or it could not be decrypted as no key was available).
   */
  async decryptExchangeDataId(secureDelegation: SecureDelegation): Promise<string | undefined> {
    const decryptionKeys = this.userKeys.getDecryptionKeys()
    for (const [fp, encryptedId] of Object.entries(secureDelegation.encryptedExchangeDataId ?? {})) {
      const key = decryptionKeys?.[fp]
      if (key) return ua2utf8(await this.primitives.RSA.decrypt(key.privateKey, b64_2ua(encryptedId)))
    }
    return undefined
  }

  /**
   * Encrypts the exchange data id for a secure delegation. To avoid leaks of sensitive data the provided public keys should be only keys of users
   * which DO NOT REQUIRE anonymous delegations
   */
  async encryptExchangeDataId(exchangeDataId: string, publicKeys: { [fp: string]: CryptoKey }): Promise<{ [fp: string]: string }> {
    const res = {} as { [fp: string]: string }
    for (const [fp, key] of Object.entries(publicKeys)) {
      res[fp] = ua2b64(await this.primitives.RSA.encrypt(key, utf8_2ua(exchangeDataId)))
    }
    return res
  }

  async encryptEncryptionKey(hexKey: string, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.AES.encrypt(key, hex2ua(hexKey)))
  }

  async encryptEncryptionKeys(hexKeys: string[], key: CryptoKey): Promise<string[]> {
    const res = []
    for (const hexKey of hexKeys) {
      res.push(await this.encryptEncryptionKey(hexKey, key))
    }
    return res
  }

  async decryptEncryptionKey(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2hex(await this.primitives.AES.decrypt(key, b64_2ua(encrypted)))
  }

  async decryptEncryptionKeys(delegation: SecureDelegation, key: CryptoKey): Promise<string[]> {
    const res = []
    for (const encrypted of delegation.encryptionKeys ?? []) {
      res.push(await this.decryptEncryptionKey(encrypted, key))
    }
    return res
  }

  async encryptSecretId(secretId: string, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.AES.encrypt(key, utf8_2ua(this.icureIV + secretId)))
  }

  async encryptSecretIds(secretIds: string[], key: CryptoKey): Promise<string[]> {
    const res = []
    for (const secretId of secretIds) {
      res.push(await this.encryptSecretId(secretId, key))
    }
    return res
  }

  async decryptSecretId(encrypted: string, key: CryptoKey): Promise<string> {
    const probableSecretId = ua2utf8(await this.primitives.AES.decrypt(key, b64_2ua(encrypted)))
    if (probableSecretId.substring(0, this.icureIV.length) !== this.icureIV) {
      throw new Error('Invalid secretID')
    }
    return probableSecretId.substring(this.icureIV.length)
  }

  async decryptSecretIds(delegation: SecureDelegation, key: CryptoKey): Promise<string[]> {
    const res = []
    for (const encrypted of delegation.secretIds ?? []) {
      res.push(await this.decryptSecretId(encrypted, key))
    }
    return res
  }

  async encryptOwningEntityId(owningEntityId: string, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.AES.encrypt(key, utf8_2ua(this.icureIV + owningEntityId)))
  }

  async encryptOwningEntityIds(owningEntityIds: string[], key: CryptoKey): Promise<string[]> {
    const res = []
    for (const owningEntityId of owningEntityIds) {
      res.push(await this.encryptOwningEntityId(owningEntityId, key))
    }
    return res
  }

  async decryptOwningEntityId(encrypted: string, key: CryptoKey): Promise<string> {
    const probableOwningEntityId = ua2utf8(await this.primitives.AES.decrypt(key, b64_2ua(encrypted)))
    if (probableOwningEntityId.substring(0, this.icureIV.length) !== this.icureIV) {
      throw new Error('Invalid Owning Entity id')
    }
    return probableOwningEntityId.substring(this.icureIV.length)
  }

  async decryptOwningEntityIds(delegation: SecureDelegation, key: CryptoKey): Promise<string[]> {
    const res = []
    for (const encrypted of delegation.owningEntityIds ?? []) {
      res.push(await this.decryptOwningEntityId(encrypted, key))
    }
    return res
  }
}
