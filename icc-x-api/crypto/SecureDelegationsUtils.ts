import { SecureDelegation } from '../../icc-api/model/SecureDelegation'
import { b64_2ua, ua2b64, ua2hex, ua2utf8, utf8_2ua } from '../utils'
import { ExchangeDataManager } from './ExchangeDataManager'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua } from '@icure/apiV6'

/**
 * @internal this class is for internal use only and may be changed without notice.
 */
export class SecureDelegationsUtils {
  constructor(private readonly userKeys: UserEncryptionKeysManager, private readonly primitives: CryptoPrimitives) {}

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

  async decryptEncryptionKey(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2hex(await this.primitives.AES.decrypt(key, b64_2ua(encrypted)))
  }

  private async encryptEncryptionKey(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.AES.encrypt(key, hex2ua(encrypted)))
  }

  async decryptSecretId(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2utf8(await this.primitives.AES.decrypt(key, b64_2ua(encrypted)))
  }

  private async encryptSecretId(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.AES.encrypt(key, utf8_2ua(encrypted)))
  }

  async decryptOwningEntityId(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2utf8(await this.primitives.AES.decrypt(key, b64_2ua(encrypted)))
  }

  private async encryptOwningEntityId(encrypted: string, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.AES.encrypt(key, utf8_2ua(encrypted)))
  }
}
