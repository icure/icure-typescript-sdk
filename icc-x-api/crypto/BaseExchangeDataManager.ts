import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair } from './RSA'
import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { IccExchangeDataApi } from '../../icc-api/api/IccExchangeDataApi'
import { XHR } from '../../icc-api/api/XHR'
import XHRError = XHR.XHRError
import { CryptoPrimitives } from './CryptoPrimitives'
import { b64_2ua, hex2ua, ua2b64, ua2hex, ua2utf8, utf8_2ua } from '../utils'
import * as _ from 'lodash'
import { fingerprintV1toV2, fingerprintIsV1 } from './utils'

/**
 * @internal this class is intended for internal use only and may be modified without notice
 * Functions to create and get exchange data.
 * The methods of this api require to pass the appropriate keys for encryption/decryption manually.
 */
export class BaseExchangeDataManager {
  constructor(
    readonly api: IccExchangeDataApi,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly primitives: CryptoPrimitives,
    private readonly selfRequiresAnonymousDelegations: boolean
  ) {}

  /**
   * Get all the exchange data where the current data owner is the delegator or the delegate. However, some data owners, generally HCPs, may have a
   * prohibitively high amount of exchange data. If the crypto strategies specify that the current data owner requires anonymous delegation this
   * method returns all the exchange data found for the data owner, else the method returns undefined.
   * @return all the exchange data for the current data owner or undefined if the crypto strategies don't allow to retrieve all data for the current
   * data owner.
   */
  async getAllExchangeDataForCurrentDataOwnerIfAllowed(): Promise<ExchangeData[] | undefined> {
    if (!this.selfRequiresAnonymousDelegations) return undefined
    const dataOwnerId = await this.dataOwnerApi.getCurrentDataOwnerId()
    let latestResult = await this.api.getExchangeDataByParticipant(dataOwnerId, undefined, 1000)
    const allRetrieved = latestResult.rows ?? []
    while (latestResult.nextKeyPair?.startKeyDocId) {
      latestResult = await this.api.getExchangeDataByParticipant(dataOwnerId, latestResult.nextKeyPair.startKeyDocId, 1000)
      if (latestResult.rows) allRetrieved.push(...latestResult.rows)
    }
    return allRetrieved
  }

  /**
   * Get all exchange data for the provided delegator-delegate pair.
   * @param delegatorId id of a delegator data owner.
   * @param delegateId id of a delegate data owner.
   * @return all exchange data for the provided delegator-delegate pair.
   */
  async getExchangeDataByDelegatorDelegatePair(delegatorId: string, delegateId: string): Promise<ExchangeData[]> {
    return await this.api.getExchangeDataByDelegatorDelegate(delegatorId, delegateId)
  }

  /**
   * Get the exchange data with the provided id.
   * @param exchangeDataId id of the exchange data.
   * @return the exchange data with the provided id or undefined if no exchange data with such id could be found.
   */
  async getExchangeDataById(exchangeDataId: string): Promise<ExchangeData | undefined> {
    return await this.api.getExchangeDataById(exchangeDataId).catch((e) => {
      if (e instanceof XHRError && e.statusCode === 404) {
        return undefined
      } else throw e
    })
  }

  /**
   * Filters exchange data returning only the instances that could be verified using their signature and the provided verification
   * keys.
   * Note that all exchange data created by data owners other than the current data owner (including members of his hierarchy)
   * will always be unverified.
   * @param exchangeData the exchange data to verify.
   * @param getVerificationKey function to retrieve keys to use for verification by fingerprint.
   * @return the exchange data which could be verified given his signature and the available verification keys.
   * @throws if any of the provided exchange data has been created by a data owner other than the current data owner.
   */
  async filterVerifiedExchangeData(
    exchangeData: ExchangeData[],
    getVerificationKey: (publicKeyFingerprint: string) => Promise<CryptoKey | undefined>
  ): Promise<ExchangeData[]> {
    const verified: ExchangeData[] = []
    for (const ed of exchangeData) {
      if (await this.verifyExchangeData(ed, (x) => getVerificationKey(x))) verified.push(ed)
    }
    return verified
  }

  /**
   * Verifies the authenticity of the exchange data by checking the signature.
   * Note that all exchange data created by data owners other than the current data owner (including members of his hierarchy)
   * will always be unverified.
   * @param exchangeData the exchange data to verify.
   * @param getVerificationKey function to retrieve keys to use for verification by fingerprint.
   * @return the exchange data which could be verified given his signature and the available verification keys.
   * @throws if any of the provided exchange data has been created by a data owner other than the current data owner.
   */
  async verifyExchangeData(
    exchangeData: ExchangeData,
    getVerificationKey: (publicKeyFingerprint: string) => Promise<CryptoKey | undefined>
  ): Promise<boolean> {
    const dataOwnerId = await this.dataOwnerApi.getCurrentDataOwnerId()
    if (exchangeData.delegator !== dataOwnerId) return false
    const signatureData = await this.bytesToSign(exchangeData)
    for (const [fp, signature] of Object.entries(exchangeData.signature)) {
      const verificationKey = await getVerificationKey(fp.slice(-32))
      if (verificationKey && (await this.primitives.RSA.verifySignature(verificationKey, b64_2ua(signature), signatureData))) return true
    }
    return false
  }

  /**
   * Extracts and decrypts the access control secret from the provided exchange data.
   * These need to be hashed together with the entity class and confidentiality level in order to get the actual access control key
   * which will be sent to the server.
   * @param exchangeData the exchange data from which to extract access control secrets.
   * @param decryptionKeys rsa key pairs to use for decryption of the access control secret.
   * @return an object composed of:
   * - successfulDecryptions: array of all successfully decrypted access control keys
   * - failedDecryptions: array containing all exchange data for which the access control key could not be decrypted (using the provided keys).
   */
  async tryDecryptAccessControlSecret(
    exchangeData: ExchangeData[],
    decryptionKeys: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{
    successfulDecryptions: string[]
    failedDecryptions: ExchangeData[]
  }> {
    return await this.tryDecryptExchangeData(
      exchangeData,
      decryptionKeys,
      (ed) => ed.accessControlSecret,
      (d) => this.importAccessControlSecret(new Uint8Array(d))
    )
  }

  /**
   * Extract and decrypts the exchange keys from the provided exchange data.
   * @param exchangeData the exchange data from which to extract exchange keys.
   * @param decryptionKeys rsa key pairs to use for the decryption of the exchange keys.
   * @return an object composed of:
   * - successfulDecryptions: array containing the successfully decrypted exchange keys.
   * - failedDecryptions: array containing all exchange data for which the access control key could not be decrypted (using the provided keys).
   */
  async tryDecryptExchangeKeys(
    exchangeData: ExchangeData[],
    decryptionKeys: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{
    successfulDecryptions: CryptoKey[]
    failedDecryptions: ExchangeData[]
  }> {
    return await this.tryDecryptExchangeData(
      exchangeData,
      decryptionKeys,
      (ed) => ed.exchangeKey,
      (d) => this.importExchangeKey(new Uint8Array(d))
    )
  }

  private async tryDecryptExchangeData<T>(
    exchangeData: ExchangeData[],
    decryptionKeys: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> },
    encryptedDataSelector: (data: ExchangeData) => { [keyPairFingerprint: string]: string },
    unmarshalDecrypted: (decrypted: ArrayBuffer) => Promise<T>
  ): Promise<{
    successfulDecryptions: T[]
    failedDecryptions: ExchangeData[]
  }> {
    const successfulDecryptions: T[] = []
    const failedDecryptions: ExchangeData[] = []
    for (const ed of exchangeData) {
      try {
        const decrypted = await this.tryDecrypt(encryptedDataSelector(ed), decryptionKeys)
        if (decrypted) {
          successfulDecryptions.push(await unmarshalDecrypted(decrypted))
        } else {
          failedDecryptions.push(ed)
        }
      } catch (e) {
        failedDecryptions.push(ed)
      }
    }
    return { successfulDecryptions, failedDecryptions }
  }

  private async tryDecrypt(
    encryptedData: { [keyPairFingerprintV2: string]: string },
    decryptionKeys: { [publicKeyFingerprintV1: string]: KeyPair<CryptoKey> }
  ): Promise<ArrayBuffer | undefined> {
    const decryptionKeysWithV2Fp = Object.keys(decryptionKeys).reduce((prev, fp) => {
      return {
        ...prev,
        [fingerprintIsV1(fp) ? fingerprintV1toV2(fp) : fp]: decryptionKeys[fp],
      }
    }, {} as { [publicKeyFingerprint: string]: KeyPair<CryptoKey> })
    for (const [fp, encrypted] of Object.entries(encryptedData)) {
      try {
        const key = decryptionKeysWithV2Fp[fp]?.privateKey
        if (key) return hex2ua(ua2utf8(await this.primitives.RSA.decrypt(key, b64_2ua(encrypted))))
      } catch (e) {
        // Try with another key
      }
    }
  }

  /**
   * Creates exchange data from the current data owner to the provided delegate, uploading the newly created exchange data to the cloud.
   * This assumes that the keys have been verified.
   * @param delegateId id of the delegate for the new exchange data.
   * @param signatureKeys private keys to use for signing the created data.
   * @param encryptionKeys public keys to use for the encryption of the exchange data (from delegator and delegate).
   * @param optionalAttributes optional precalculated attributes for the creation of data
   * @return the newly created exchange data, and its decrypted exchange key and access control secret.
   */
  async createExchangeData(
    delegateId: string,
    signatureKeys: { [keyPairFingerprint: string]: CryptoKey },
    encryptionKeys: { [keyPairFingerprint: string]: CryptoKey },
    optionalAttributes: {
      id?: string
    } = {}
  ): Promise<{
    exchangeData: ExchangeData
    exchangeKey: CryptoKey
    accessControlSecret: string
  }> {
    if (!Object.keys(signatureKeys).length || !Object.keys(encryptionKeys).length) {
      throw new Error('Must specify at least one signature key and ')
    }
    const exchangeKey = await this.generateExchangeKey()
    const accessControlSecret = await this.generateAccessControlSecret()
    const encryptedExchangeKey = await this.encryptDataWithKeys(exchangeKey.rawBytes, encryptionKeys)
    const encryptedAccessControlSecret = await this.encryptDataWithKeys(accessControlSecret.rawBytes, encryptionKeys)
    const baseExchangeData = {
      id: optionalAttributes.id ?? this.primitives.randomUuid(),
      delegator: await this.dataOwnerApi.getCurrentDataOwnerId(),
      delegate: delegateId,
      exchangeKey: encryptedExchangeKey,
      accessControlSecret: encryptedAccessControlSecret,
    }
    const signature = await this.signDataWithKeys(await this.bytesToSign(baseExchangeData), signatureKeys)
    const exchangeData = new ExchangeData({ ...baseExchangeData, signature })
    return {
      exchangeData: await this.api.createExchangeData(exchangeData),
      exchangeKey: exchangeKey.key,
      accessControlSecret: accessControlSecret.secret,
    }
  }

  /**
   * Updates existing exchange data and uploads it to the cloud in order to share it also with additional public keys, useful for example in cases
   * where one of the data owners involved in the exchange data has lost one of his keys.
   * If the content of the exchange data could not be decrypted using the provided keys the method will not update anything and will return undefined.
   * This method assumes that the new encryption keys have been verified.
   * If the current data owner is also the delegator of the provided exchange data and at least one of the verification keys can be used to
   * validate the current exchange data then the signature will be updated using the signature keys.
   * Instead, if the current data owner is not the delegator of the provided exchange data, or the exchange data could not be verified using
   * the provided verification keys then the updated exchange data will become unverified, and won't ever be verifiable again.
   * @param exchangeData exchange data to update.
   * @param decryptionKeys keys to use to extract the content of the exchange data which will be shared with the new keys.
   * @param signatureKeys keys to use for the new signature of the updated exchange data.
   * @param newEncryptionKeys new keys to add to the exchange data.
   * @param getVerificationKey function to retrieve keys to use for verification by fingerprint.
   * @return the updated exchange data, and its decrypted exchange key and access control secret, or undefined if the exchange data content could not
   * be decrypted and the exchange data could not be updated.
   */
  async tryUpdateExchangeData(
    exchangeData: ExchangeData,
    decryptionKeys: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> },
    newEncryptionKeys: { [keyPairFingerprint: string]: CryptoKey },
    signatureKeys: { [keyPairFingerprint: string]: CryptoKey },
    getVerificationKey: (publicKeyFingerprint: string) => Promise<CryptoKey | undefined>
  ): Promise<
    | {
        exchangeData: ExchangeData
        exchangeKey: CryptoKey
        accessControlSecret: string
      }
    | undefined
  > {
    const dataOwnerId = await this.dataOwnerApi.getCurrentDataOwnerId()
    const rawExchangeKey = await this.tryDecrypt(exchangeData.exchangeKey, decryptionKeys)
    const rawAccessControlSecret = await this.tryDecrypt(exchangeData.accessControlSecret, decryptionKeys)
    if (!rawExchangeKey || !rawAccessControlSecret) return undefined
    const exchangeKey = await this.importExchangeKey(new Uint8Array(rawExchangeKey))
    const accessControlSecret = await this.importAccessControlSecret(new Uint8Array(rawAccessControlSecret))
    const existingExchangeKeyEntries = new Set(Object.keys(exchangeData.exchangeKey))
    const existingAcsEntries = new Set(Object.keys(exchangeData.accessControlSecret))
    const missingEntries = Object.keys(newEncryptionKeys).filter((fp) => !existingAcsEntries.has(fp) || !existingExchangeKeyEntries.has(fp))
    if (!missingEntries.length) return { exchangeData, exchangeKey, accessControlSecret }
    const encryptionKeysForMissingEntries = missingEntries.reduce((obj, fp) => {
      obj[fp] = newEncryptionKeys[fp]
      return obj
    }, {} as { [keyPairFingerprint: string]: CryptoKey })
    const isVerified = exchangeData.delegator == dataOwnerId && (await this.verifyExchangeData(exchangeData, (fp) => getVerificationKey(fp)))
    const updatedExchangeData = _.cloneDeep(exchangeData)
    updatedExchangeData.exchangeKey = {
      ...exchangeData.exchangeKey,
      ...(await this.encryptDataWithKeys(rawExchangeKey, encryptionKeysForMissingEntries)),
    }
    updatedExchangeData.accessControlSecret = {
      ...exchangeData.accessControlSecret,
      ...(await this.encryptDataWithKeys(rawAccessControlSecret, encryptionKeysForMissingEntries)),
    }
    if (isVerified) {
      const newDataToSign = await this.bytesToSign(updatedExchangeData)
      updatedExchangeData.signature = await this.signDataWithKeys(newDataToSign, signatureKeys)
    }
    return { exchangeData: await this.api.modifyExchangeData(new ExchangeData(updatedExchangeData)), exchangeKey, accessControlSecret }
  }

  // Gets a byte representation of the parts of exchange data which should be included in the signature.
  // Equivalent json representations of the exchange data should provide the same bytes (even if the order of entries
  // is different).
  private async bytesToSign(exchangeData: {
    delegate: string
    delegator: string
    exchangeKey: { [k: string]: string }
    accessControlSecret: { [k: string]: string }
  }): Promise<ArrayBuffer> {
    function sortObject(obj: { [k: string]: string }): [string, string][] {
      return Object.keys(obj)
        .sort()
        .reduce((sorted, key) => {
          return [...sorted, [key, obj[key]]]
        }, [] as [string, string][])
    }
    const signObject = [
      ['delegator', exchangeData.delegator],
      ['delegate', exchangeData.delegate],
      ['exchangeKey', sortObject(exchangeData.exchangeKey)],
      ['accessControlSecret', sortObject(exchangeData.accessControlSecret)],
    ]
    const signJson = JSON.stringify(signObject)
    return this.primitives.sha256(utf8_2ua(signJson))
  }

  // Generates a new exchange key
  private async generateExchangeKey(): Promise<{
    key: CryptoKey // the imported key
    rawBytes: ArrayBuffer // the bytes to encrypt for in the exchange data
  }> {
    const rawBytes = await this.primitives.randomBytes(32)
    return {
      key: await this.importExchangeKey(rawBytes),
      rawBytes,
    }
  }

  private async importExchangeKey(decryptedBytes: ArrayBuffer): Promise<CryptoKey> {
    return await this.primitives.AES.importKey('raw', decryptedBytes)
  }

  // Generates a new access control secret
  private async generateAccessControlSecret(): Promise<{
    secret: string // the imported secret
    rawBytes: ArrayBuffer // the bytes to encrypt for in the exchange data
  }> {
    const rawBytes = await this.primitives.randomBytes(16)
    return {
      secret: await this.importAccessControlSecret(rawBytes),
      rawBytes,
    }
  }

  private importAccessControlSecret(decryptedBytes: ArrayBuffer): Promise<string> {
    return Promise.resolve(ua2hex(decryptedBytes))
  }

  private async encryptDataWithKeys(
    rawData: ArrayBuffer,
    keys: { [keyPairFingerprintV1: string]: CryptoKey }
  ): Promise<{ [keyPairFingerprintV2: string]: string }> {
    const res: { [keyPairFingerprintV2: string]: string } = {}
    for (const [fp, key] of Object.entries(keys)) {
      res[fingerprintIsV1(fp) ? fingerprintV1toV2(fp) : fp] = ua2b64(await this.primitives.RSA.encrypt(key, utf8_2ua(ua2hex(rawData))))
    }
    return res
  }

  private async signDataWithKeys(
    rawData: ArrayBuffer,
    keys: { [keyPairFingerprint: string]: CryptoKey }
  ): Promise<{ [keyPairFingerprint: string]: string }> {
    const res: { [keyPairFingerprint: string]: string } = {}
    for (const [fp, key] of Object.entries(keys)) {
      res[fp] = ua2b64(await this.primitives.RSA.sign(key, new Uint8Array(rawData)))
    }
    return res
  }
}
