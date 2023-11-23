import { KeyPair, ShaVersion } from './RSA'
import { CryptoPrimitives } from './CryptoPrimitives'
import { IccRecoveryDataApi } from '../../icc-api/api/internal/IccRecoveryDataApi'
import { IccExchangeDataApi } from '../../icc-api/api/internal/IccExchangeDataApi'
import { RecoveryData } from '../../icc-api/model/internal/RecoveryData'
import { a2b, b2a, b64_2ua, hex2ua, string2ua, ua2b64, ua2hex, ua2string, ua2utf8, utf8_2ua } from '../utils'
import { XHR } from '../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import { KeyPairUpdateRequest } from '../maintenance/KeyPairUpdateRequest'

export enum RecoveryDataUseFailureReason {
  /**
   * The recovery data matching the provided recovery key does not exist. It could have been deleted, or it could have been expired.
   */
  Missing = 'MISSING',
  /**
   * The recovery data exists but it is not available to the current user. The user may have used a recovery key that he created while logged in as
   * a different user.
   */
  Unauthorized = 'UNAUTHORIZED',
  /**
   * The recovery data exists and is available to the current user, but it is not of the expected type.
   */
  InvalidType = 'INVALID_TYPE',
  /**
   * The recovery data exists and is available to the current user, but its content could not be interpreted. The data may have been created
   * with an unsupported SDK version.
   */
  InvalidContent = 'INVALID_CONTENT',
}

// accessControlSecret, sharedSignatureKey, and exchangeKey all raw bytes b64 encoded
type ExchangeDataRecoveryDataContent = {
  exchangeDataId: string
  rawAccessControlSecret: string
  rawSharedSignatureKey: string
  rawExchangeKey: string
}[]
// delegateId -> { pair: { privateKey: base64pkcs8, publicKey: base64spki }, algorithm: ShaVersion }[]
type KeyPairRecoveryDataContent = { [delegateId: string]: { pair: KeyPair<string>; algorithm: ShaVersion }[] }
type RecoveryDataContent = KeyPairRecoveryDataContent | ExchangeDataRecoveryDataContent

/**
 * @internal this class is for internal use only and may change without notice.
 */
export class RecoveryDataEncryption {
  constructor(private readonly primitives: CryptoPrimitives, private readonly baseRecoveryApi: IccRecoveryDataApi) {}

  async createAndSaveKeyPairsRecoveryDataFor(
    recipient: string,
    keyPairs: { [delegateId: string]: { pair: KeyPair<CryptoKey>; algorithm: ShaVersion }[] },
    lifetimeSeconds: number | undefined
  ): Promise<string> {
    const content: KeyPairRecoveryDataContent = {}
    for (const [delegateId, pairs] of Object.entries(keyPairs)) {
      const entries: { pair: KeyPair<string>; algorithm: ShaVersion }[] = []
      for (const { pair, algorithm } of pairs) {
        entries.push({
          pair: {
            privateKey: ua2b64(await this.primitives.RSA.exportKey(pair.privateKey, 'pkcs8')),
            publicKey: ua2b64(await this.primitives.RSA.exportKey(pair.publicKey, 'spki')),
          },
          algorithm,
        })
      }
      content[delegateId] = entries
    }
    return await this.createRecoveryData(recipient, RecoveryData.Type.KEYPAIR_RECOVERY, lifetimeSeconds, content)
  }

  async getAndDecryptKeyPairsRecoveryData(
    recoveryKey: string
  ): Promise<{ succes: { [delegateId: string]: { [publicKeySpki: string]: KeyPair<CryptoKey> } } } | { failure: RecoveryDataUseFailureReason }> {
    const getRecoveryDataResult = await this.getRecoveryDataAndDecrypt(recoveryKey, RecoveryData.Type.KEYPAIR_RECOVERY)
    if ('failure' in getRecoveryDataResult) return getRecoveryDataResult
    const recoveredKeysData = getRecoveryDataResult.decryptedJson as KeyPairRecoveryDataContent
    const recoveredKeys: { [delegateId: string]: { [publicKeySpki: string]: KeyPair<CryptoKey> } } = {}
    for (const [delegateId, pairs] of Object.entries(recoveredKeysData)) {
      const delegateKeys: { [publicKeySpki: string]: KeyPair<CryptoKey> } = {}
      for (const { pair, algorithm } of pairs) {
        delegateKeys[ua2hex(b64_2ua(pair.publicKey))] = {
          privateKey: await this.primitives.RSA.importKey('pkcs8', b64_2ua(pair.privateKey), ['decrypt'], algorithm),
          publicKey: await this.primitives.RSA.importKey('spki', b64_2ua(pair.publicKey), ['encrypt'], algorithm),
        }
      }
      recoveredKeys[delegateId] = delegateKeys
    }
    return { succes: recoveredKeys }
  }

  createAndSaveExchangeDataRecoveryData(
    exchangeDataInfo: {
      exchangeDataId: string
      rawAccessControlSecret: ArrayBuffer
      rawSharedSignatureKey: ArrayBuffer
      rawExchangeKey: ArrayBuffer
    }[],
    lifetimeSeconds: number | undefined
  ): Promise<string> {
    throw 'TODO'
  }

  getAndDecryptExchangeDataRecoveryData(
    recoveryKey: string
  ): Promise<{ exchangeDataId: string; rawAccessControlSecret: ArrayBuffer; rawSharedSignatureKey: ArrayBuffer; rawExchangeKey: ArrayBuffer }[]> {
    throw 'TODO'
  }

  async getRecoveryDataAndDecrypt(
    recoveryKey: string,
    expectedType: RecoveryData.Type
  ): Promise<{ recoveryData: RecoveryData; decryptedJson: any } | { failure: RecoveryDataUseFailureReason }> {
    const id = ua2hex(await this.primitives.sha256(hex2ua(recoveryKey)))
    const getResult = await this.baseRecoveryApi.getRecoveryData(id).then(
      (r) => ({ recoveryData: r }),
      (e) => {
        if (e instanceof XHRError) {
          if (e.statusCode === 404) {
            return { failure: RecoveryDataUseFailureReason.Missing }
          } else if (e.statusCode === 403) {
            return { failure: RecoveryDataUseFailureReason.Unauthorized }
          }
        }
        throw e
      }
    )
    if ('failure' in getResult) return getResult
    const { recoveryData } = getResult
    if (recoveryData.type !== expectedType) return { failure: RecoveryDataUseFailureReason.InvalidType }
    const decryptionKey = await this.primitives.AES.importKey('raw', hex2ua(recoveryKey))
    const decryptionResult = await this.primitives.AES.decrypt(decryptionKey, string2ua(a2b(recoveryData.encryptedSelf)))
      .then((d) => JSON.parse(ua2utf8(d)))
      .then(
        (r): { success: RecoveryDataContent } => ({ success: r }),
        () => ({ failure: RecoveryDataUseFailureReason.InvalidContent })
      )
    if ('failure' in decryptionResult) return decryptionResult
    return { recoveryData, decryptedJson: decryptionResult.success }
  }
  async createRecoveryData(
    recipient: string,
    type: RecoveryData.Type,
    lifetimeSeconds: number | undefined,
    content: RecoveryDataContent
  ): Promise<string> {
    const recoveryKey = await this.primitives.AES.generateCryptoKey(false)
    const recoveryKeyHex = ua2hex(await this.primitives.AES.exportKey(recoveryKey, 'raw'))
    const id = ua2hex(await this.primitives.sha256(hex2ua(recoveryKeyHex)))
    const encryptedSelf = b2a(ua2string(await this.primitives.AES.encrypt(recoveryKey, utf8_2ua(JSON.stringify(content)))))
    const expirationInstant = lifetimeSeconds ? Date.now() + lifetimeSeconds * 1000 : undefined
    const data: RecoveryData = new RecoveryData({
      id,
      encryptedSelf,
      expirationInstant,
      recipient,
      type,
    })
    await this.baseRecoveryApi.createRecoveryData(data)
    return recoveryKeyHex
  }
}
