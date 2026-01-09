import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { BaseExchangeDataManager } from './BaseExchangeDataManager'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { AccessControlSecretUtils } from './AccessControlSecretUtils'
import { CryptoStrategies } from './CryptoStrategies'
import { fingerprintV1, getShaVersionForKey, hexPublicKeysWithSha1Of, hexPublicKeysWithSha256Of } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { EntityWithDelegationTypeName, hex2ua, ua2ab } from '../utils'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'
import { ShaVersion } from './RSA'
import { Mutex } from 'async-mutex'
import { SimpleLruCache } from '../utils/simple-lru-cache'

export type ExchangeDataManagerOptionalParameters = {
  // Only for not fully cached implementation (data owner can't request all his exchange data), amount of exchange data which can be cached
  lruCacheSize?: number // default = 2000
}

/**
 * @internal this function is for internal use only and may be changed without notice.
 * Initialises and returns the exchange data manager which is most appropriate for the current data owner.
 */
export async function initialiseExchangeDataManagerForCurrentDataOwner(
  base: BaseExchangeDataManager,
  encryptionKeys: UserEncryptionKeysManager,
  accessControlSecret: AccessControlSecretUtils,
  cryptoStrategies: CryptoStrategies,
  dataOwnerApi: IccDataOwnerXApi,
  primitives: CryptoPrimitives,
  useParentKeys: boolean,
  optionalParameters: ExchangeDataManagerOptionalParameters = {}
): Promise<ExchangeDataManager> {
  const currentOwner = CryptoActorStubWithType.fromDataOwner(await dataOwnerApi.getCurrentDataOwner())
  if (cryptoStrategies.dataOwnerRequiresAnonymousDelegation(currentOwner)) {
    const res = new FullyCachedExchangeDataManager(
      base,
      encryptionKeys,
      accessControlSecret,
      cryptoStrategies,
      dataOwnerApi,
      primitives,
      useParentKeys
    )
    await res.clearOrRepopulateCache()
    return res
  } else {
    return new LimitedLruCacheExchangeDataManager(
      base,
      encryptionKeys,
      accessControlSecret,
      cryptoStrategies,
      dataOwnerApi,
      primitives,
      useParentKeys,
      optionalParameters
    )
  }
}

type CachedExchangeData = {
  exchangeData: ExchangeData
  decrypted?: {
    accessControlSecret: string
    exchangeKey: CryptoKey
    verified: boolean
    sharedSignatureKey: CryptoKey
  }
}

/**
 * @internal this class is intended for internal use only and may be changed without notice.
 * Exchange data manager which automatically handles decryption and cache
 */
export interface ExchangeDataManager {
  readonly base: BaseExchangeDataManager

  /**
   * Updates all exchange data between the current data owner and another data owner to allow the other data owner to access existing exchange data
   * using a new public key. Note that this will make existing exchange keys from the other data owner to the current data owner unverified, therefore
   * invalid for encryption.
   * @param otherDataOwner the other data owner.
   * @param newDataOwnerPublicKey a new public key of the other data owner.
   */
  giveAccessBackTo(otherDataOwner: string, newDataOwnerPublicKey: string): Promise<void>

  /**
   * Gets any existing and verified exchange data from the current data owner to the provided delegate or creates new data if no verified data is
   * available, then caches it.
   * @param delegateId the id of the delegate.
   * @param options
   * - allowCreationWithoutDelegatorKey if true, when creating new exchange data, even if no verified key is available for the delegator the method
   * will create the new exchange data anyway (will not be usable by the delegate without additional steps).
   * - allowCreationWithoutDelegateKey if true, when creating new exchange data, even if no verified key is available for the delegate the method
   * will create the new exchange data anyway (will not be usable by the delegate without additional steps).
   * @return the access control secret and key of the data to use for encryption.
   */
  getOrCreateEncryptionDataTo(
    delegateId: string,
    options?: {
      allowCreationWithoutDelegatorKey?: boolean
      allowCreationWithoutDelegateKey?: boolean
    }
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey; sharedSignatureKey: CryptoKey }>

  /**
   * Retrieve the cached decrypted exchange data key associated with any of the provided hashes/entry keys of secure delegations.
   * @param hashes hashes of access control secrets for a specific entity, as they appear in the key of secure delegation entries
   * @return the exchange data and decrypted key associated to that hash if cached
   */
  getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[]
  ): Promise<{ [hash: string]: { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey } }>

  /**
   * Retrieves the exchange data with the provided id (from the cache if available or from the server otherwise if allowed by
   * and attempts to decrypt it, then caches the result.
   * @param ids ids of the exchange datas to retrieve
   * @param retrieveIfNotCached if false only cached data will be returned, and the access control hases options will be
   * ignored
   * @return a map containing the exchange data id associated with:
   * - exchangeData: the exchange data with the provided id
   * - exchangeKey: the exchange key corresponding to the provided exchange data if it could be decrypted, else undefined
   * - accessControlSecret: the access control secret corresponding to the provided exchange data if it could be decrypted, else undefined
   */
  getDecryptionDataKeyByIds(
    ids: string[],
    retrieveIfNotCached: boolean
  ): Promise<{ [id: string]: { exchangeKey: CryptoKey | undefined; accessControlSecret: string | undefined; exchangeData: ExchangeData } }>

  /**
   * Clears the cache or fully repopulates the cache if the current data owner can retrieve all of his exchange data according to the crypto
   * strategies.
   */
  clearOrRepopulateCache(): Promise<void>

  /**
   * If the current data owner requires anonymous delegations this returns the base64 representation of the concatenation of all available access
   * control keys for the current data owner.
   */
  getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined>

  /**
   * If the current data owner requires anonymous delegations this returns the access control keys which may be used in secure delegations for the
   * data owner, which can be used to search for data.
   */
  getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined>

  /**
   * Injects already decrypted exchange data, allowing it to be used by the sdk.
   * @param exchangeDataDetails the exchange data to inject, with the decrypted content and verified status.
   * Note that the SDK won't verify that the provided decrypted content actually matches what is stored in the exchange
   * data.
   * @param reEncryptWithOwnKeys if true all the provided exchange data that is not encrypted with any of the self
   * verified keys of the user will be re-encrypted with them. In case the user is also the delegator and the data is
   * verified the delegator signature will be updated.
   */
  injectDecryptedExchangeData(
    exchangeDataDetails: {
      exchangeDataId: string
      accessControlSecret: ArrayBuffer
      exchangeKey: ArrayBuffer
      sharedSignatureKey: ArrayBuffer
      verified: boolean
    }[],
    reEncryptWithOwnKeys: boolean
  ): Promise<void>
}

abstract class AbstractExchangeDataManager implements ExchangeDataManager {
  constructor(
    readonly base: BaseExchangeDataManager,
    protected readonly encryptionKeys: UserEncryptionKeysManager,
    protected readonly accessControlSecret: AccessControlSecretUtils,
    protected readonly cryptoStrategies: CryptoStrategies,
    protected readonly dataOwnerApi: IccDataOwnerXApi,
    protected readonly primitives: CryptoPrimitives,
    private readonly useParentKeys: boolean
  ) {}

  protected async decryptData(data: ExchangeData): Promise<
    | {
        accessControlSecret: string
        exchangeKey: CryptoKey
        verified: boolean
        sharedSignatureKey: CryptoKey
      }
    | undefined
  > {
    const decryptionKeys = this.encryptionKeys.getDecryptionKeys()
    const encryptionKeys = Object.fromEntries(
      this.encryptionKeys.getSelfVerifiedKeys().map((x): [string, CryptoKey] => [x.fingerprint, x.pair.privateKey])
    )
    const decryptedExchangeKey = (await this.base.tryDecryptExchangeKeys([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedExchangeKey) return undefined
    const decryptedAccessControlSecret = (await this.base.tryDecryptAccessControlSecret([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedAccessControlSecret)
      throw new Error(`Decryption key could be decrypted but access control secret could not for data ${JSON.stringify(data)}`)
    const decryptedSharedSignatureKey = (await this.base.tryDecryptSharedSignatureKeys([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedSharedSignatureKey)
      throw new Error(`Decryption key could be decrypted but shared signature key could not for data ${JSON.stringify(data)}`)
    return {
      accessControlSecret: decryptedAccessControlSecret,
      exchangeKey: decryptedExchangeKey,
      sharedSignatureKey: decryptedSharedSignatureKey,
      verified: await this.base.verifyExchangeData(
        {
          exchangeData: data,
          decryptedAccessControlSecret,
          decryptedExchangeKey,
          decryptedSharedSignatureKey,
        },
        encryptionKeys,
        true
      ),
    }
  }

  protected async createNewExchangeData(
    delegateId: string,
    options: {
      newDataId?: string
      allowNoDelegatorKeys?: boolean
      allowNoDelegateKeys?: boolean
    }
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey; sharedSignatureKey: CryptoKey }> {
    if (options.allowNoDelegateKeys && options.allowNoDelegatorKeys)
      throw new Error('Illegal arguments: allow no delegator and no delegate keys should never both be true')
    const encryptionKeys: { [fp: string]: CryptoKey } = {}
    const selfVerifiedKeys = this.encryptionKeys.getSelfVerifiedKeys()
    if (selfVerifiedKeys.length <= 0 && !options.allowNoDelegatorKeys)
      throw new Error('If the sdk is initialized in keyless mode you must create exchange data explicitly')
    selfVerifiedKeys.forEach(({ fingerprint, pair }) => {
      encryptionKeys[fingerprint] = pair.publicKey
    })
    if (delegateId != (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      const delegate = await this.dataOwnerApi.getCryptoActorStub(delegateId)
      const sha256KeysOfDelegate = hexPublicKeysWithSha256Of(delegate.stub)
      const sha1KeysOfDelegate = hexPublicKeysWithSha1Of(delegate.stub)
      let allVerifiedDelegateKeys: string[]
      if (!sha256KeysOfDelegate.size && !sha1KeysOfDelegate.size) {
        if (!options.allowNoDelegateKeys)
          throw new Error(`Could not create exchange data to ${delegateId} as no public key for the delegate was found.`)
        allVerifiedDelegateKeys = []
      } else if (this.useParentKeys && (await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()).includes(delegateId)) {
        allVerifiedDelegateKeys = await this.encryptionKeys.getVerifiedPublicKeysFor(delegate.stub)
      } else {
        allVerifiedDelegateKeys = await this.cryptoStrategies.verifyDelegatePublicKeys(
          delegate,
          [...Array.from(sha256KeysOfDelegate), ...Array.from(sha1KeysOfDelegate)],
          this.primitives
        )
      }
      if (!allVerifiedDelegateKeys.length && !options.allowNoDelegateKeys)
        throw new Error(`Could not create exchange data to ${delegateId} as no public key for the delegate could be verified.`)
      for (const delegateKey of allVerifiedDelegateKeys) {
        if (sha1KeysOfDelegate.has(delegateKey)) {
          encryptionKeys[fingerprintV1(delegateKey)] = await this.primitives.RSA.importKey(
            'spki',
            ua2ab(hex2ua(delegateKey)),
            ['encrypt'],
            ShaVersion.Sha1
          )
        } else if (sha256KeysOfDelegate.has(delegateKey)) {
          encryptionKeys[fingerprintV1(delegateKey)] = await this.primitives.RSA.importKey(
            'spki',
            ua2ab(hex2ua(delegateKey)),
            ['encrypt'],
            ShaVersion.Sha256
          )
        } else throw new Error('Illegal state: verified keys should contain only keys for OAPE-SHA1 or OAPE-SHA256.')
      }
    }
    const newData = await this.base.createExchangeData(
      delegateId,
      Object.fromEntries(selfVerifiedKeys.map((x): [string, CryptoKey] => [x.fingerprint, x.pair.privateKey])),
      encryptionKeys,
      options.newDataId ? { id: options.newDataId } : {}
    )
    return {
      exchangeData: newData.exchangeData,
      accessControlSecret: newData.accessControlSecret,
      exchangeKey: newData.exchangeKey,
      sharedSignatureKey: newData.sharedSignatureKey,
    }
  }

  async giveAccessBackTo(otherDataOwner: string, newDataOwnerPublicKey: string) {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const newKeyFp = fingerprintV1(newDataOwnerPublicKey)
    const other = await this.dataOwnerApi.getCryptoActorStub(otherDataOwner)
    const newKeyHashVersion = getShaVersionForKey(other.stub, newDataOwnerPublicKey)
    if (!newKeyHashVersion) throw new Error(`Public key not found for data owner ${otherDataOwner}`)
    const importedNewKey = await this.primitives.RSA.importKey('spki', ua2ab(hex2ua(newDataOwnerPublicKey)), ['encrypt'], newKeyHashVersion)
    const decryptionKeys = this.encryptionKeys.getDecryptionKeys()
    const allExchangeDataToUpdate =
      self == otherDataOwner
        ? await this.base.getExchangeDataByDelegatorDelegatePair(self, self)
        : [
            ...(await this.base.getExchangeDataByDelegatorDelegatePair(self, otherDataOwner)),
            ...(await this.base.getExchangeDataByDelegatorDelegatePair(otherDataOwner, self)),
          ]
    for (const dataToUpdate of allExchangeDataToUpdate) {
      if (!Object.keys(dataToUpdate.exchangeKey).find((fp) => fp == newKeyFp)) {
        const updated = await this.base.tryUpdateExchangeData(dataToUpdate, decryptionKeys, { [newKeyFp]: importedNewKey })
        if (!updated) {
          console.warn(`Failed to give access back to exchanged data ${JSON.stringify(dataToUpdate)}`)
        }
      }
    }
  }

  clearOrRepopulateCache(): Promise<void> {
    throw new Error('Implemented by concrete class')
  }

  getOrCreateEncryptionDataTo(
    delegateId: string,
    options?: {
      allowCreationWithoutDelegatorKey?: boolean
      allowCreationWithoutDelegateKey?: boolean
    }
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey; sharedSignatureKey: CryptoKey }> {
    throw new Error('Implemented by concrete class')
  }

  getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[]
  ): Promise<{ [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } }> {
    throw new Error('Implemented by concrete class')
  }

  getDecryptionDataKeyByIds(
    ids: string[],
    retrieveIfNotCached: boolean
  ): Promise<{
    [p: string]: {
      exchangeKey: CryptoKey | undefined
      accessControlSecret: string | undefined
      exchangeData: ExchangeData
    }
  }> {
    throw new Error('Implemented by concrete class')
  }

  getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined> {
    throw new Error('Implemented by concrete class')
  }

  getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined> {
    throw new Error('Implemented by concrete class')
  }

  async injectDecryptedExchangeData(
    exchangeDataDetails: {
      exchangeDataId: string
      accessControlSecret: ArrayBuffer
      exchangeKey: ArrayBuffer
      sharedSignatureKey: ArrayBuffer
      verified: boolean
    }[],
    reEncryptWithOwnKeys: boolean
  ): Promise<void> {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const retrievedExchangeData = await this.base.getExchangeDataByIds(exchangeDataDetails.map((x) => x.exchangeDataId))
    if (retrievedExchangeData.some((x) => x.delegator != self && x.delegate != self))
      throw new Error('Should only inject exchange date from/to the current user')
    const exchangeDataById: { [id: string]: ExchangeData } = {}
    retrievedExchangeData.forEach((x) => (exchangeDataById[x.id!] = x))
    if (reEncryptWithOwnKeys) {
      const selfVerifiedKeys = this.encryptionKeys.getSelfVerifiedKeys()
      if (selfVerifiedKeys.length <= 0) throw new Error("Can't re-encrypt injected exchange data with own keys if in keyless mode")
      const encryptionKeys: { [fp: string]: CryptoKey } = {}
      selfVerifiedKeys.forEach(({ fingerprint, pair }) => {
        encryptionKeys[fingerprint] = pair.publicKey
      })
      const signatureKeys = Object.fromEntries(selfVerifiedKeys.map((x): [string, CryptoKey] => [x.fingerprint, x.pair.privateKey]))
      for (const details of exchangeDataDetails) {
        const exchangeData = exchangeDataById[details.exchangeDataId]
        if (exchangeData != null)
          await this.base.updateExchangeDataWithRawDecryptedContent({
            exchangeData,
            newEncryptionKeys: encryptionKeys,
            newDelegatorSignatureKeys: exchangeData.delegator == self && details.verified ? signatureKeys : {},
            rawExchangeKey: details.exchangeKey,
            rawAccessControlSecret: details.accessControlSecret,
            rawSharedSignatureKey: details.sharedSignatureKey,
          })
      }
    }
    const importedDetails: {
      exchangeData: ExchangeData
      accessControlSecret: string
      exchangeKey: CryptoKey
      sharedSignatureKey: CryptoKey
      verified: boolean
    }[] = []
    for (const details of exchangeDataDetails) {
      const exchangeData = exchangeDataById[details.exchangeDataId]
      if (exchangeData != undefined)
        importedDetails.push({
          exchangeData: exchangeData,
          accessControlSecret: await this.base.importAccessControlSecret(details.accessControlSecret),
          exchangeKey: await this.base.importExchangeKey(details.exchangeKey),
          sharedSignatureKey: await this.base.importSharedSignatureKey(details.sharedSignatureKey),
          verified: details.verified,
        })
    }
    await this.cacheInjectedExchangeData(importedDetails)
  }

  protected abstract cacheInjectedExchangeData(
    exchangeDataDetails: {
      exchangeData: ExchangeData
      accessControlSecret: string
      exchangeKey: CryptoKey
      sharedSignatureKey: CryptoKey
      verified: boolean
    }[]
  ): Promise<void>
}

class FullyCachedExchangeDataManager extends AbstractExchangeDataManager {
  private caches: Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: { [hash: string]: string }
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
    entityTypeToAccessControlKeysValue: { [entityType in EntityWithDelegationTypeName]?: string }
  }> = Promise.resolve({ dataById: {}, hashToId: {}, delegateToVerifiedEncryptionDataId: {}, entityTypeToAccessControlKeysValue: {} })
  private createExchangeDataMutex = new Mutex()

  async clearOrRepopulateCache(): Promise<void> {
    this.caches = this.doRepopulateCache()
    await this.caches
  }

  async getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[]
  ): Promise<{ [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } }> {
    function retrieveByHashesFromCaches(caches: {
      dataById: { [id: string]: CachedExchangeData }
      hashToId: { [hash: string]: string }
      delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
    }): { [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } } {
      return hashes.reduce((res, hash) => {
        const id = caches.hashToId[hash]
        if (id) {
          const cached = caches.dataById[id]
          if (cached?.decrypted) {
            res[hash] = {
              exchangeData: cached.exchangeData,
              exchangeKey: cached.decrypted.exchangeKey,
              accessControlSecret: cached.decrypted.accessControlSecret,
            }
          }
        }
        return res
      }, {} as { [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } })
    }

    return retrieveByHashesFromCaches(await this.caches)
  }

  private async getCachedEncryptionDataTo(
    delegateId: string
  ): Promise<{ exchangeKey: CryptoKey; accessControlSecret: string; exchangeData: ExchangeData; sharedSignatureKey: CryptoKey } | undefined> {
    const caches = await this.caches
    const dataId = caches.delegateToVerifiedEncryptionDataId[delegateId]
    const cached = dataId ? caches.dataById[dataId] : undefined
    if (cached && cached?.decrypted) {
      return {
        exchangeData: cached.exchangeData,
        accessControlSecret: cached.decrypted.accessControlSecret,
        exchangeKey: cached.decrypted.exchangeKey,
        sharedSignatureKey: cached.decrypted.sharedSignatureKey,
      }
    } else {
      return undefined
    }
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string,
    options?: {
      allowCreationWithoutDelegatorKey?: boolean
      allowCreationWithoutDelegateKey?: boolean
    }
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey; sharedSignatureKey: CryptoKey }> {
    const initialCached = await this.getCachedEncryptionDataTo(delegateId)
    if (initialCached) return initialCached
    const release = await this.createExchangeDataMutex.acquire()
    try {
      const cachedAfterMutex = await this.getCachedEncryptionDataTo(delegateId)
      if (cachedAfterMutex) return cachedAfterMutex
      const created = await this.createNewExchangeData(delegateId, {
        allowNoDelegateKeys: options?.allowCreationWithoutDelegateKey ?? false,
        allowNoDelegatorKeys: options?.allowCreationWithoutDelegatorKey ?? false,
      })
      this.cacheData(created.exchangeData, true, {
        accessControlSecret: created.accessControlSecret,
        exchangeKey: created.exchangeKey,
        sharedSignatureKey: created.sharedSignatureKey,
        verified: true,
      })
      return created
    } finally {
      release()
    }
  }

  async getDecryptionDataKeyByIds(
    ids: string[],
    retrieveIfNotCached: boolean
  ): Promise<{
    [p: string]: {
      exchangeKey: CryptoKey | undefined
      accessControlSecret: string | undefined
      exchangeData: ExchangeData
    }
  }> {
    const caches = await this.caches
    const res: {
      [p: string]: {
        exchangeKey: CryptoKey | undefined
        accessControlSecret: string | undefined
        exchangeData: ExchangeData
      }
    } = {}
    for (const id of ids) {
      const data = caches.dataById[id]
      if (data) {
        res[id] = {
          exchangeData: data.exchangeData,
          exchangeKey: data.decrypted?.exchangeKey,
          accessControlSecret: data.decrypted?.accessControlSecret,
        }
      }
    }
    return res
  }

  private cacheData(
    exchangeData: ExchangeData,
    isNewData: boolean,
    decrypted: { accessControlSecret: string; exchangeKey: CryptoKey; verified: boolean; sharedSignatureKey: CryptoKey } | undefined
  ): void {
    this.caches = this.caches.then(async (caches) => {
      caches.dataById[exchangeData.id!] = { exchangeData, decrypted }
      if (decrypted) {
        const hashes = await this.accessControlSecret.allSecureDelegationKeysFor(decrypted.accessControlSecret)
        hashes.forEach((hash) => {
          caches.hashToId[hash] = exchangeData.id!
        })
        if (decrypted.verified) {
          caches.delegateToVerifiedEncryptionDataId[exchangeData.delegate] = exchangeData.id!
        }
      }
      if (isNewData) caches.entityTypeToAccessControlKeysValue = {}
      return caches
    })
  }

  private async doRepopulateCache(): Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: { [hash: string]: string }
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
    entityTypeToAccessControlKeysValue: { [entityType in EntityWithDelegationTypeName]?: string }
  }> {
    const allData = await this.base.getAllExchangeDataForCurrentDataOwnerIfAllowed()
    if (!allData) throw new Error('Impossible to use fully cached exchange data manager for current data owner.')
    const dataById: { [id: string]: CachedExchangeData } = {}
    const hashToId: { [hash: string]: string } = {}
    const delegateToVerifiedEncryptionDataId: { [delegate: string]: string } = {}
    for (const currData of allData) {
      const currDecrypted = await this.decryptData(currData)
      dataById[currData.id!] = { exchangeData: currData, decrypted: currDecrypted }
      if (currDecrypted?.verified) {
        delegateToVerifiedEncryptionDataId[currData.delegate] = currData.id!
      }
      if (currDecrypted?.accessControlSecret) {
        for (const h of await this.accessControlSecret.allSecureDelegationKeysFor(currDecrypted!.accessControlSecret)) {
          hashToId[h] = currData.id!
        }
      }
    }
    const entityTypeToAccessControlKeysValue: { [entityType in EntityWithDelegationTypeName]?: string } = {}
    return { dataById, hashToId, delegateToVerifiedEncryptionDataId, entityTypeToAccessControlKeysValue }
  }

  async getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined> {
    const caches = await this.caches
    const cached = caches.entityTypeToAccessControlKeysValue[entityType]
    if (cached) return cached
    const accessControlSecrets = Object.values(caches.dataById).flatMap((x) => (x.decrypted ? [x.decrypted.accessControlSecret] : []))
    const fullData = await this.accessControlSecret.getEncodedAccessControlKeys(accessControlSecrets, entityType)
    caches.entityTypeToAccessControlKeysValue[entityType] = fullData
    return fullData
  }

  async getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined> {
    const caches = await this.caches
    const accessControlSecrets = Object.values(caches.dataById).flatMap((x) => (x.decrypted ? [x.decrypted.accessControlSecret] : []))
    const res: string[] = []
    for (const accessControlSecret of accessControlSecrets) {
      // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
      res.push(await this.accessControlSecret.secureDelegationKeyFor(accessControlSecret, entityType))
    }
    return res
  }

  protected async cacheInjectedExchangeData(
    exchangeDataDetails: {
      exchangeData: ExchangeData
      accessControlSecret: string
      exchangeKey: CryptoKey
      sharedSignatureKey: CryptoKey
      verified: boolean
    }[]
  ): Promise<void> {
    for (const details of exchangeDataDetails) {
      this.cacheData(details.exchangeData, true, {
        accessControlSecret: details.accessControlSecret,
        exchangeKey: details.exchangeKey,
        sharedSignatureKey: details.sharedSignatureKey,
        verified: details.verified,
      })
    }
  }
}

class LimitedLruCacheExchangeDataManager extends AbstractExchangeDataManager {
  private readonly idToData: SimpleLruCache<string, CachedExchangeData & { hashes: string[] }> = new SimpleLruCache()
  private readonly hashToId: Map<string, string> = new Map()
  private readonly delegateToVerifiedEncryptionDataId: Map<string, string> = new Map()
  private readonly maxCachedExchangeData: number
  private readonly cacheMutex = new Mutex()

  constructor(
    base: BaseExchangeDataManager,
    encryptionKeys: UserEncryptionKeysManager,
    accessControlSecret: AccessControlSecretUtils,
    cryptoStrategies: CryptoStrategies,
    dataOwnerApi: IccDataOwnerXApi,
    primitives: CryptoPrimitives,
    useParentKeys: boolean,
    optionalParameters: {
      lruCacheSize?: number
    }
  ) {
    super(base, encryptionKeys, accessControlSecret, cryptoStrategies, dataOwnerApi, primitives, useParentKeys)
    this.maxCachedExchangeData = optionalParameters.lruCacheSize ?? 2000
  }

  async clearOrRepopulateCache(): Promise<void> {
    this.idToData.clear()
    this.hashToId.clear()
    this.delegateToVerifiedEncryptionDataId.clear()
  }

  async getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[]
  ): Promise<{ [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string } }> {
    const release = await this.cacheMutex.acquire()
    try {
      const res: {
        [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey; accessControlSecret: string }
      } = {}
      for (const hash of hashes) {
        const dataId = this.hashToId.get(hash)
        if (dataId) {
          const retrieved = this.idToData.getCached(dataId)
          if (!retrieved) throw new Error(`Data with id ${dataId} should have been already cached.`)
          if (retrieved.decrypted) {
            res[hash] = {
              exchangeData: retrieved.exchangeData,
              exchangeKey: retrieved.decrypted.exchangeKey,
              accessControlSecret: retrieved.decrypted.accessControlSecret,
            }
          }
        }
      }
      return res
    } finally {
      release()
    }
  }

  async getDecryptionDataKeyByIds(
    ids: string[],
    retrieveIfNotCached: boolean
  ): Promise<{
    [p: string]: {
      exchangeKey: CryptoKey | undefined
      accessControlSecret: string | undefined
      exchangeData: ExchangeData
    }
  }> {
    const release = await this.cacheMutex.acquire()
    try {
      const res: {
        [p: string]: {
          exchangeKey: CryptoKey | undefined
          accessControlSecret: string | undefined
          exchangeData: ExchangeData
        }
      } = {}
      const uncached: string[] = []
      for (const id of ids) {
        const cached: (CachedExchangeData & { hashes: string[] }) | null = this.idToData.getCached(id)
        if (cached) {
          res[id] = {
            exchangeKey: cached.decrypted?.exchangeKey,
            accessControlSecret: cached.decrypted?.accessControlSecret,
            exchangeData: cached.exchangeData,
          }
        } else if (retrieveIfNotCached) {
          uncached.push(id)
        }
      }
      if (uncached.length > 0) {
        const retrieved = await this.base.getExchangeDataByIds(uncached)
        for (const data of retrieved) {
          const decrypted = await this.decryptData(data)
          if (decrypted) {
            const hashes = await this.accessControlSecret.allSecureDelegationKeysFor(decrypted.accessControlSecret)
            this.addToCache({ exchangeData: data, hashes, decrypted })
          } else {
            this.addToCache({ exchangeData: data, hashes: [] })
          }
          res[data.id!] = {
            exchangeKey: decrypted?.exchangeKey,
            accessControlSecret: decrypted?.accessControlSecret,
            exchangeData: data,
          }
        }
      }
      return res
    } finally {
      release()
    }
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string,
    options?: {
      allowCreationWithoutDelegatorKey?: boolean
      allowCreationWithoutDelegateKey?: boolean
    }
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey; sharedSignatureKey: CryptoKey }> {
    const release = await this.cacheMutex.acquire()
    try {
      let existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
      if (!existingId) {
        await this.populateCacheToDelegate(delegateId)
        existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
      }
      if (existingId) {
        const cached = this.idToData.getCached(existingId)
        if (!cached) throw new Error(`Illegal state: data with id ${existingId} should have been in cache`)
        if (cached.decrypted) {
          return {
            exchangeData: cached.exchangeData,
            exchangeKey: cached.decrypted.exchangeKey,
            accessControlSecret: cached.decrypted.accessControlSecret,
            sharedSignatureKey: cached.decrypted.sharedSignatureKey,
          }
        } else throw new Error(`Illegal state: cached verified data should be decrypted.`)
      } else {
        const created = await this.createNewExchangeData(delegateId, {
          allowNoDelegateKeys: options?.allowCreationWithoutDelegateKey ?? false,
          allowNoDelegatorKeys: options?.allowCreationWithoutDelegatorKey ?? false,
        })
        const hashes = await this.accessControlSecret.allSecureDelegationKeysFor(created.accessControlSecret)
        const data = {
          exchangeData: created.exchangeData,
          decrypted: {
            accessControlSecret: created.accessControlSecret,
            exchangeKey: created.exchangeKey,
            sharedSignatureKey: created.sharedSignatureKey,
            verified: true,
          },
          hashes,
        }
        this.addToCache(data)
        return {
          exchangeData: data.exchangeData,
          exchangeKey: data.decrypted.exchangeKey,
          accessControlSecret: data.decrypted.accessControlSecret,
          sharedSignatureKey: data.decrypted.sharedSignatureKey,
        }
      }
    } finally {
      release()
    }
  }

  // Loads and adds to the cache all exchange data from the current data owner to the given delegate. Allows to check if there is already data from
  // the current data owner to the delegate which is good for encryption.
  private async populateCacheToDelegate(delegateId: string): Promise<void> {
    const dataToDelegate = await this.base.getExchangeDataByDelegatorDelegatePair(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    for (const data of dataToDelegate) {
      const decrypted = await this.decryptData(data)
      if (decrypted) {
        const hashes = await this.accessControlSecret.allSecureDelegationKeysFor(decrypted.accessControlSecret)
        this.addToCache({ exchangeData: data, hashes, decrypted })
      } else {
        this.addToCache({ exchangeData: data, hashes: [] })
      }
    }
  }

  private addToCache(data: CachedExchangeData & { hashes: string[] }) {
    if (this.idToData.size >= this.maxCachedExchangeData) {
      this.evictOneEntry()
    }
    data.hashes.forEach((hash) => this.hashToId.set(hash, data.exchangeData.id!))
    if (data.decrypted?.verified && !this.delegateToVerifiedEncryptionDataId.has(data.exchangeData.delegate)) {
      this.delegateToVerifiedEncryptionDataId.set(data.exchangeData.delegate, data.exchangeData.id!)
    }
    this.idToData.set(data.exchangeData.id!, data)
  }

  private evictOneEntry() {
    const evicted = this.idToData.evictLeastRecentlyUsed()
    evicted.hashes.forEach((hash) => this.hashToId.delete(hash))
    if (this.delegateToVerifiedEncryptionDataId.get(evicted.exchangeData.delegate) === evicted.exchangeData.id) {
      this.delegateToVerifiedEncryptionDataId.delete(evicted.exchangeData.delegate)
    }
  }

  getAccessControlKeysValue(): Promise<string | undefined> {
    return Promise.resolve(undefined)
  }

  getAllDelegationKeys(): Promise<string[] | undefined> {
    return Promise.resolve(undefined)
  }

  protected async cacheInjectedExchangeData(
    exchangeDataDetails: {
      exchangeData: ExchangeData
      accessControlSecret: string
      exchangeKey: CryptoKey
      sharedSignatureKey: CryptoKey
      verified: boolean
    }[]
  ): Promise<void> {
    for (const details of exchangeDataDetails) {
      const hashes = await this.accessControlSecret.allSecureDelegationKeysFor(details.accessControlSecret)
      const data = {
        exchangeData: details.exchangeData,
        decrypted: {
          accessControlSecret: details.accessControlSecret,
          exchangeKey: details.exchangeKey,
          sharedSignatureKey: details.sharedSignatureKey,
          verified: details.verified,
        },
        hashes,
      }
      this.addToCache(data)
    }
  }
}
