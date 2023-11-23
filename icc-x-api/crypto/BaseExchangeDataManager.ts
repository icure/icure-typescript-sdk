import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { KeyPair } from './RSA'
import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import { IccExchangeDataApi } from '../../icc-api/api/internal/IccExchangeDataApi'
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
   * Verifies the authenticity of the exchange data by checking the signature.
   * Note that all exchange data created by data owners other than the current data owner (including members of his hierarchy)
   * will always be unverified.
   * @param data collects the following information about the exchange data being verified:
   * - exchangeData the exchange data to verify.
   * - decryptedAccessControlSecret the access control secret decrypted from the exchange data.
   * - decryptedExchangeKey the exchange key decrypted from the exchange data.
   * - decryptedSharedSignatureKey the shared signature key decrypted from the exchange data.
   * @param getVerificationKey function to retrieve keys to use for verification by fingerprint.
   * @param verifyAsDelegator if true the method will also verify that the hmac key used for the signature was created by the delegator of the
   * exchange data. If true and the data was not created by the current data owner this method will return false.
   * @return the exchange data which could be verified given his signature and the available verification keys.
   * @throws if any of the provided exchange data has been created by a data owner other than the current data owner.
   */
  async verifyExchangeData(
    data: {
      exchangeData: ExchangeData
      decryptedAccessControlSecret: string
      decryptedExchangeKey: CryptoKey
      decryptedSharedSignatureKey: CryptoKey
    },
    getVerificationKey: (publicKeyFingerprint: string) => Promise<CryptoKey | undefined>,
    verifyAsDelegator: boolean
  ): Promise<boolean> {
    if (verifyAsDelegator && data.exchangeData.delegator !== (await this.dataOwnerApi.getCurrentDataOwnerId())) return false
    if (verifyAsDelegator && !(await this.verifyDelegatorSignature(data.exchangeData, data.decryptedSharedSignatureKey, getVerificationKey)))
      return false
    const sharedSignatureData = await this.bytesToSignForSharedSignature({
      decryptedAccessControlSecret: data.decryptedAccessControlSecret,
      decryptedExchangeKey: data.decryptedExchangeKey,
      delegator: data.exchangeData.delegator,
      delegate: data.exchangeData.delegate,
      publicKeysFingerprintsV2: [
        ...new Set([
          ...Object.keys(data.exchangeData.exchangeKey),
          ...Object.keys(data.exchangeData.accessControlSecret),
          ...Object.keys(data.exchangeData.sharedSignatureKey),
        ]),
      ],
    })
    return await this.verifyDataWithSharedKey(sharedSignatureData, data.decryptedSharedSignatureKey, data.exchangeData.sharedSignature)
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

  /**
   * Extract and decrypts the shared signature key from the provided exchange data.
   * @param exchangeData the exchange data from which to extract exchange keys.
   * @param decryptionKeys rsa key pairs to use for the decryption of the exchange keys.
   * @return an object composed of:
   * - successfulDecryptions: array containing the successfully decrypted exchange keys.
   * - failedDecryptions: array containing all exchange data for which the access control key could not be decrypted (using the provided keys).
   */
  async tryDecryptSharedSignatureKeys(
    exchangeData: ExchangeData[],
    decryptionKeys: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> }
  ): Promise<{
    successfulDecryptions: CryptoKey[]
    failedDecryptions: ExchangeData[]
  }> {
    return await this.tryDecryptExchangeData(
      exchangeData,
      decryptionKeys,
      (ed) => ed.sharedSignatureKey,
      (d) => this.importSharedSignatureKey(new Uint8Array(d))
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
        if (key) return await this.primitives.RSA.decrypt(key, b64_2ua(encrypted))
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
    const sharedSignatureKey = await this.generateSharedSignatureKey()
    const encryptedExchangeKey = await this.encryptDataWithKeys(exchangeKey.rawBytes, encryptionKeys)
    const encryptedAccessControlSecret = await this.encryptDataWithKeys(accessControlSecret.rawBytes, encryptionKeys)
    const encryptedSharedSignatureKey = await this.encryptDataWithKeys(sharedSignatureKey.rawBytes, encryptionKeys)
    const baseExchangeData = {
      id: optionalAttributes.id ?? this.primitives.randomUuid(),
      delegator: await this.dataOwnerApi.getCurrentDataOwnerId(),
      delegate: delegateId,
      exchangeKey: encryptedExchangeKey,
      accessControlSecret: encryptedAccessControlSecret,
      sharedSignatureKey: encryptedSharedSignatureKey,
    }
    const sharedSignature = await this.signDataWithSharedKey(
      await this.bytesToSignForSharedSignature({
        delegate: baseExchangeData.delegate,
        delegator: baseExchangeData.delegator,
        decryptedAccessControlSecret: accessControlSecret.secret,
        decryptedExchangeKey: exchangeKey.key,
        publicKeysFingerprintsV2: Object.keys(encryptionKeys).map(fingerprintV1toV2),
      }),
      sharedSignatureKey.key
    )
    const delegatorSignature = await this.signDataWithDelegatorKeys(
      await this.bytesToSignForDelegatorSignature({
        sharedSignatureKey: sharedSignatureKey.key,
      }),
      signatureKeys
    )
    const exchangeData = new ExchangeData({ ...baseExchangeData, delegatorSignature, sharedSignature })
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
   * @param exchangeData exchange data to update.
   * @param decryptionKeys keys to use to extract the content of the exchange data which will be shared with the new keys.
   * @param newEncryptionKeys new keys to add to the exchange data.
   * @return the updated exchange data, and its decrypted exchange key and access control secret, or undefined if the exchange data content could not
   * be decrypted and the exchange data could not be updated.
   */
  async tryUpdateExchangeData(
    exchangeData: ExchangeData,
    decryptionKeys: { [publicKeyFingerprint: string]: KeyPair<CryptoKey> },
    newEncryptionKeys: { [keyPairFingerprint: string]: CryptoKey }
  ): Promise<
    | {
        exchangeData: ExchangeData
        exchangeKey: CryptoKey
        accessControlSecret: string
      }
    | undefined
  > {
    const rawExchangeKey = await this.tryDecrypt(exchangeData.exchangeKey, decryptionKeys)
    const rawAccessControlSecret = await this.tryDecrypt(exchangeData.accessControlSecret, decryptionKeys)
    const rawSharedSignatureKey = await this.tryDecrypt(exchangeData.sharedSignatureKey, decryptionKeys)
    if (!rawExchangeKey || !rawAccessControlSecret || !rawSharedSignatureKey) return undefined
    return await this.updateExchangeDataWithRawDecryptedContent(
      exchangeData,
      newEncryptionKeys,
      rawExchangeKey,
      rawAccessControlSecret,
      rawSharedSignatureKey
    )
  }

  /**
   * Same as [tryUpdateExchangeData] but the decrypted content is already provided.
   */
  async updateExchangeDataWithRawDecryptedContent(
    exchangeData: ExchangeData,
    newEncryptionKeys: { [keyPairFingerprint: string]: CryptoKey },
    rawExchangeKey: ArrayBuffer,
    rawAccessControlSecret: ArrayBuffer,
    rawSharedSignatureKey: ArrayBuffer
  ): Promise<{
    exchangeData: ExchangeData
    exchangeKey: CryptoKey
    accessControlSecret: string
  }> {
    const exchangeKey = await this.importExchangeKey(new Uint8Array(rawExchangeKey))
    const accessControlSecret = await this.importAccessControlSecret(new Uint8Array(rawAccessControlSecret))
    const sharedSignatureKey = await this.importSharedSignatureKey(new Uint8Array(rawSharedSignatureKey))
    const existingExchangeKeyEntries = new Set(Object.keys(exchangeData.exchangeKey))
    const existingAcsEntries = new Set(Object.keys(exchangeData.accessControlSecret))
    const existingSharedSignatureKeyEntries = new Set(Object.keys(exchangeData.sharedSignatureKey))
    const missingEntries = Object.keys(newEncryptionKeys).filter(
      (fp) => !existingAcsEntries.has(fp) || !existingExchangeKeyEntries.has(fp) || !existingSharedSignatureKeyEntries.has(fp)
    )
    if (!missingEntries.length) return { exchangeData, exchangeKey, accessControlSecret }
    const encryptionKeysForMissingEntries = missingEntries.reduce((obj, fp) => {
      obj[fp] = newEncryptionKeys[fp]
      return obj
    }, {} as { [keyPairFingerprint: string]: CryptoKey })
    const updatedExchangeData = _.cloneDeep(exchangeData)
    updatedExchangeData.exchangeKey = {
      ...exchangeData.exchangeKey,
      ...(await this.encryptDataWithKeys(rawExchangeKey, encryptionKeysForMissingEntries)),
    }
    updatedExchangeData.accessControlSecret = {
      ...exchangeData.accessControlSecret,
      ...(await this.encryptDataWithKeys(rawAccessControlSecret, encryptionKeysForMissingEntries)),
    }
    updatedExchangeData.sharedSignatureKey = {
      ...exchangeData.sharedSignatureKey,
      ...(await this.encryptDataWithKeys(rawSharedSignatureKey, encryptionKeysForMissingEntries)),
    }
    const isVerified = await this.verifyExchangeData(
      {
        exchangeData,
        decryptedAccessControlSecret: accessControlSecret,
        decryptedExchangeKey: exchangeKey,
        decryptedSharedSignatureKey: sharedSignatureKey,
      },
      () => Promise.resolve(undefined),
      false
    )
    if (isVerified) {
      updatedExchangeData.sharedSignature = await this.signDataWithSharedKey(
        await this.bytesToSignForSharedSignature({
          delegate: updatedExchangeData.delegate,
          delegator: updatedExchangeData.delegator,
          decryptedAccessControlSecret: accessControlSecret,
          decryptedExchangeKey: exchangeKey,
          publicKeysFingerprintsV2: Object.keys(updatedExchangeData.exchangeKey),
        }),
        sharedSignatureKey
      )
    }
    return { exchangeData: await this.api.modifyExchangeData(new ExchangeData(updatedExchangeData)), exchangeKey, accessControlSecret }
  }

  private async bytesToSignForSharedSignature(data: {
    delegator: string
    delegate: string
    decryptedAccessControlSecret: string
    decryptedExchangeKey: CryptoKey
    publicKeysFingerprintsV2: string[]
  }): Promise<ArrayBuffer> {
    // Use array of array to ensure that order is preserved regardless of how the specific js implementation orders
    // the keys of an object
    const signObject = [
      ['delegator', data.delegator],
      ['delegate', data.delegate],
      ['exchangeKey', ua2hex(await this.primitives.AES.exportKey(data.decryptedExchangeKey, 'raw'))],
      ['accessControlSecret', data.decryptedAccessControlSecret],
      ['publicKeysFingerprints', data.publicKeysFingerprintsV2.sort()],
    ]
    const signJson = JSON.stringify(signObject)
    return utf8_2ua(signJson)
  }

  private async bytesToSignForDelegatorSignature(data: { sharedSignatureKey: CryptoKey }): Promise<ArrayBuffer> {
    return this.primitives.sha256(await this.primitives.HMAC.exportKey(data.sharedSignatureKey))
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

  private async exportExchangeKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await this.primitives.AES.exportKey(key, 'raw')
  }

  private async generateSharedSignatureKey(): Promise<{
    key: CryptoKey // the imported key
    rawBytes: ArrayBuffer // the bytes to encrypt for in the exchange data
  }> {
    const key = await this.primitives.HMAC.generateKey()
    return { key, rawBytes: await this.primitives.HMAC.exportKey(key) }
  }

  private async importSharedSignatureKey(decryptedBytes: ArrayBuffer): Promise<CryptoKey> {
    return await this.primitives.HMAC.importKey(decryptedBytes)
  }

  private async exportSharedSignatureKey(key: CryptoKey): Promise<ArrayBuffer> {
    return await this.primitives.HMAC.exportKey(key)
  }

  // Generates a new access control secret
  private async generateAccessControlSecret(): Promise<{
    secret: string // the imported secret
    rawBytes: ArrayBuffer // the bytes to encrypt for in the exchange data
  }> {
    const rawBytes = this.primitives.randomBytes(16)
    return {
      secret: await this.importAccessControlSecret(rawBytes),
      rawBytes,
    }
  }

  private importAccessControlSecret(decryptedBytes: ArrayBuffer): Promise<string> {
    return Promise.resolve(ua2hex(decryptedBytes))
  }

  private exportAccessControlSecret(secret: string): Promise<ArrayBuffer> {
    return Promise.resolve(hex2ua(secret))
  }

  private async encryptDataWithKeys(
    rawData: ArrayBuffer,
    keys: { [keyPairFingerprintV1: string]: CryptoKey }
  ): Promise<{ [keyPairFingerprintV2: string]: string }> {
    const res: { [keyPairFingerprintV2: string]: string } = {}
    for (const [fp, key] of Object.entries(keys)) {
      res[fingerprintIsV1(fp) ? fingerprintV1toV2(fp) : fp] = ua2b64(await this.primitives.RSA.encrypt(key, new Uint8Array(rawData)))
    }
    return res
  }

  private async signDataWithDelegatorKeys(
    rawData: ArrayBuffer,
    keys: { [keyPairFingerprint: string]: CryptoKey }
  ): Promise<{ [keyPairFingerprint: string]: string }> {
    const res: { [keyPairFingerprint: string]: string } = {}
    for (const [fp, key] of Object.entries(keys)) {
      res[fp] = ua2b64(await this.primitives.RSA.sign(key, new Uint8Array(rawData)))
    }
    return res
  }

  private async verifyDelegatorSignature(
    exchangeData: ExchangeData,
    decryptedSharedSignatureKey: CryptoKey,
    getVerificationKey: (publicKeyFingerprint: string) => Promise<CryptoKey | undefined>
  ): Promise<Boolean> {
    const delegatorSignatureData = await this.bytesToSignForDelegatorSignature({
      sharedSignatureKey: decryptedSharedSignatureKey,
    })
    for (const [fp, signature] of Object.entries(exchangeData.delegatorSignature)) {
      const verificationKey = await getVerificationKey(fp.slice(-32))
      if (verificationKey && (await this.primitives.RSA.verifySignature(verificationKey, b64_2ua(signature), delegatorSignatureData))) return true
    }
    return false
  }

  private async signDataWithSharedKey(rawData: ArrayBuffer, key: CryptoKey): Promise<string> {
    return ua2b64(await this.primitives.HMAC.sign(key, new Uint8Array(rawData)))
  }

  private async verifyDataWithSharedKey(rawData: ArrayBuffer, key: CryptoKey, signature: string): Promise<boolean> {
    return await this.primitives.HMAC.verify(key, new Uint8Array(rawData), b64_2ua(signature))
  }
}
