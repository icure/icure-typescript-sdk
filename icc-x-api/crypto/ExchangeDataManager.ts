import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { BaseExchangeDataManager } from './BaseExchangeDataManager'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { UserSignatureKeysManager } from './UserSignatureKeysManager'
import { AccessControlSecretUtils } from './AccessControlSecretUtils'
import { CryptoStrategies } from './CryptoStrategies'
import { hexPublicKeysOf } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua } from '../utils'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'

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
  signatureKeys: UserSignatureKeysManager,
  accessControlSecret: AccessControlSecretUtils,
  cryptoStrategies: CryptoStrategies,
  dataOwnerApi: IccDataOwnerXApi,
  primitives: CryptoPrimitives,
  optionalParameters: ExchangeDataManagerOptionalParameters = {}
): Promise<ExchangeDataManager> {
  const currentOwner = await dataOwnerApi.getCurrentDataOwner()
  if (cryptoStrategies.dataOwnerCanRequestAllHisExchangeData(currentOwner)) {
    const res = new FullyCachedExchangeDataManager(
      base,
      encryptionKeys,
      signatureKeys,
      accessControlSecret,
      cryptoStrategies,
      dataOwnerApi,
      primitives
    )
    await res.clearOrRepopulateCache()
    return res
  } else {
    return new LimitedLruCacheExchangeDataManager(
      base,
      encryptionKeys,
      signatureKeys,
      accessControlSecret,
      cryptoStrategies,
      dataOwnerApi,
      primitives,
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
  }
}

/**
 * @internal this class is intended for internal use only and may be changed without notice.
 * Exchange data manager which automatically handles decryption and cache
 */
export interface ExchangeDataManager {
  /**
   * Gets any existing and verified exchange data from the current data owner to the provided delegate or creates new data if no verified data is
   * available, then caches it. The {@link entityType} and {@link entitySecretForeignKeys} will be used for the secure-delegation-hash-based cache
   * of the exchange data and not for actually creating the exchange data.
   * @param delegateId the id of the delegate.
   * @param entityType type of the entity for which you want to create new metadata.
   * @param entitySecretForeignKeys the secret foreign keys of the entity which you want to create new metadata.
   * @return the access control secret and key of the data to use for encryption.
   */
  getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }>

  /**
   * Retrieve the cached decrypted exchange data key associated with any of the provided hashes/entry keys of secure delegations. Depending on the
   * implementation the {@link entityType} and {@link entitySecretForeignKeys} may be used to improve the secure-delegation-hash-based cache of
   * exchange data from the other available exchange data caches.
   * @param hashes hashes of access control secrets for a specific entity, as they appear in the key of secure delegation entries
   * @param entityType type of the entity containing the metadata for which you are retrieving the encryption key.
   * @param entitySecretForeignKeys the secret foreign keys of the entity containing the metadata for which you are retrieving the encryption key.
   * @return the exchange key associated to that hash if cached
   */
  getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [hash: string]: CryptoKey }>

  /**
   * Retrieves the exchange data with the provided id (from the cache if available or from the server otherwise if allowed by
   * {@link retrieveIfNotCached}) and attempts to decrypt it, then caches the result. The {@link entityType} and {@link entitySecretForeignKeys} will
   * be used for the secure-delegation-hash-based cache of the exchange data.
   * @param id id of the exchange data
   * @param entityType type of the entity containing the metadata for which you are retrieving the encryption key.
   * @param entitySecretForeignKeys the secret foreign keys of the entity containing the metadata for which you are retrieving the encryption key.
   * @param retrieveIfNotCached
   * @return the exchange key associated to the exchange data with the provided id, or undefined if the exchange data could not be decrypted.
   * @throws if no exchange data with the given id could be found.
   */
  getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[],
    retrieveIfNotCached: boolean
  ): Promise<{ decryptedKey: CryptoKey | undefined } | undefined>

  /**
   * Clears the cache or fully repopulates the cache if the current data owner can retrieve all of his exchange data according to the crypto
   * strategies.
   */
  clearOrRepopulateCache(): Promise<void>

  /**
   * If the current data owner is allowed to retrieve all of his exchange data according to the crypto strategies retrieves all available access
   * control secrets for the data owner.
   * @return all access control secrets for the data owner if allowed by the crypto strategies or undefined otherwise.
   */
  getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined>
}

abstract class AbstractExchangeDataManager implements ExchangeDataManager {
  constructor(
    protected readonly base: BaseExchangeDataManager,
    protected readonly encryptionKeys: UserEncryptionKeysManager,
    protected readonly signatureKeys: UserSignatureKeysManager,
    protected readonly accessControlSecret: AccessControlSecretUtils,
    protected readonly cryptoStrategies: CryptoStrategies,
    protected readonly dataOwnerApi: IccDataOwnerXApi,
    protected readonly primitives: CryptoPrimitives
  ) {}

  protected async decryptData(data: ExchangeData): Promise<
    | {
        accessControlSecret: string
        exchangeKey: CryptoKey
        verified: boolean
      }
    | undefined
  > {
    const decryptionKeys = this.encryptionKeys.getDecryptionKeys()
    const decryptedKey = (await this.base.tryDecryptExchangeKeys([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedKey) return undefined
    const decryptedAccessControlSecret = (await this.base.tryDecryptAccessControlSecret([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedAccessControlSecret) throw new Error(`Decryption key could be decrypted but access control secret could not for data ${data}`)
    return {
      accessControlSecret: decryptedAccessControlSecret,
      exchangeKey: decryptedKey,
      verified: await this.base.verifyExchangeData(data, (fp) => this.signatureKeys.getSignatureVerificationKey(fp)),
    }
  }

  protected async createNewExchangeData(
    delegateId: string,
    newDataId?: string
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    const delegate = await this.dataOwnerApi.getDataOwner(delegateId)
    const verifiedDelegateKeys = await this.cryptoStrategies.verifyDelegatePublicKeys(
      delegate.dataOwner,
      Array.from(hexPublicKeysOf(delegate.dataOwner)),
      this.primitives
    )
    if (!verifiedDelegateKeys.length)
      throw new Error(`Could not create exchange data to ${delegateId} as no public key for the delegate could be verified.`)
    const encryptionKeys: { [fp: string]: CryptoKey } = {}
    this.encryptionKeys.getSelfVerifiedKeys().forEach(({ fingerprint, pair }) => {
      encryptionKeys[fingerprint] = pair.publicKey
    })
    for (const delegateKey of verifiedDelegateKeys) {
      encryptionKeys[delegateKey.slice(-32)] = await this.primitives.RSA.importKey('spki', hex2ua(delegateKey), ['encrypt'])
    }
    const signatureKey = await this.signatureKeys.getOrCreateSignatureKeyPair()
    const newData = await this.base.createExchangeData(
      delegateId,
      { [signatureKey.fingerprint]: signatureKey.keyPair.privateKey },
      encryptionKeys,
      newDataId ? { id: newDataId } : {}
    )
    return {
      exchangeData: newData.exchangeData,
      accessControlSecret: newData.accessControlSecret,
      exchangeKey: newData.exchangeKey,
    }
  }

  clearOrRepopulateCache(): Promise<void> {
    throw new Error('Implemented by concrete class')
  }

  getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    throw new Error('Implemented by concrete class')
  }

  getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [p: string]: CryptoKey }> {
    throw new Error('Implemented by concrete class')
  }

  getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[],
    retrieveIfNotCached: boolean
  ): Promise<{ decryptedKey: CryptoKey | undefined } | undefined> {
    throw new Error('Implemented by concrete class')
  }

  getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined> {
    throw new Error('Implemented by concrete class')
  }
}

class FullyCachedExchangeDataManager extends AbstractExchangeDataManager {
  private caches: Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: Map<string, string>
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
  }> = Promise.resolve({ dataById: {}, hashToId: new Map(), delegateToVerifiedEncryptionDataId: {} })

  async clearOrRepopulateCache(): Promise<void> {
    this.caches = this.doRepopulateCache()
    await this.caches
  }

  async getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [hash: string]: CryptoKey }> {
    function retrieveByHashesFromCaches(caches: {
      dataById: { [id: string]: CachedExchangeData }
      hashToId: Map<string, string>
      delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
    }) {
      return hashes.reduce((res, hash) => {
        const id = caches.hashToId.get(hash)
        if (id) {
          const decrypted = caches.dataById[id].decrypted
          if (decrypted) {
            res[hash] = decrypted.exchangeKey
          }
        }
        return res
      }, {} as { [hash: string]: CryptoKey })
    }

    const retrievedFromHashesCache = retrieveByHashesFromCaches(await this.caches)
    if (Object.keys(retrievedFromHashesCache).length) {
      return retrievedFromHashesCache
    } else {
      this.caches = this.caches.then(async (caches) => {
        for (const currData of Object.values(caches.dataById)) {
          if (currData.decrypted) {
            const currDataHashes = await this.accessControlSecret.secureDelegationKeysFor(
              currData.decrypted.accessControlSecret,
              entityType,
              entitySecretForeignKeys
            )
            currDataHashes.forEach((hash) => caches.hashToId.set(hash, currData.exchangeData.id!))
          }
        }
        return caches
      })
      return retrieveByHashesFromCaches(await this.caches)
    }
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    const caches = await this.caches
    const dataId = caches.delegateToVerifiedEncryptionDataId[delegateId]
    const cached = dataId ? caches.dataById[dataId] : undefined
    if (cached && cached?.decrypted) {
      return {
        exchangeData: cached.exchangeData,
        accessControlSecret: cached.decrypted.accessControlSecret,
        exchangeKey: cached.decrypted.exchangeKey,
      }
    }
    const created = await this.createNewExchangeData(delegateId)
    this.cacheData(
      created.exchangeData,
      { accessControlSecret: created.accessControlSecret, exchangeKey: created.exchangeKey, verified: true },
      entityType,
      entitySecretForeignKeys
    )
    return created
  }

  async getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[],
    retrieveIfNotCached: boolean
  ): Promise<{ decryptedKey: CryptoKey | undefined } | undefined> {
    const caches = await this.caches
    const cachedData = caches.dataById[id]
    if (cachedData) {
      return { decryptedKey: cachedData.decrypted?.exchangeKey }
    } else if (retrieveIfNotCached) {
      const data = await this.base.getExchangeDataById(id)
      if (!data) throw new Error(`Could not find exchange data with id ${id}`)
      const decrypted = await this.decryptData(data)
      this.cacheData(data, decrypted, entityType, entitySecretForeignKeys)
      return { decryptedKey: decrypted?.exchangeKey }
    } else return undefined
  }

  private cacheData(
    exchangeData: ExchangeData,
    decrypted: { accessControlSecret: string; exchangeKey: CryptoKey; verified: boolean } | undefined,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): void {
    this.caches = this.caches.then(async (caches) => {
      caches.dataById[exchangeData.id!] = { exchangeData, decrypted }
      if (decrypted) {
        const hashes = await this.accessControlSecret.secureDelegationKeysFor(decrypted.accessControlSecret, entityType, entitySecretForeignKeys)
        hashes.forEach((hash) => {
          caches.hashToId.set(hash, exchangeData.id!)
        })
        if (decrypted.verified) {
          caches.delegateToVerifiedEncryptionDataId[exchangeData.delegate] = exchangeData.id!
        }
      }
      return caches
    })
  }

  private async doRepopulateCache(): Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: Map<string, string>
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
  }> {
    const allData = await this.base.getAllExchangeDataForCurrentDataOwnerIfAllowed()
    if (!allData) throw new Error('Impossible to use fully cached exchange data manager for current data owner.')
    const dataById: { [id: string]: CachedExchangeData } = {}
    const hashToId = new Map<string, string>()
    const delegateToVerifiedEncryptionDataId: { [delegate: string]: string } = {}
    for (const currData of allData) {
      const currDecrypted = await this.decryptData(currData)
      dataById[currData.id!] = { exchangeData: currData, decrypted: currDecrypted }
      if (currDecrypted?.verified) {
        delegateToVerifiedEncryptionDataId[currData.delegate] = currData.id!
      }
    }
    return { dataById, hashToId, delegateToVerifiedEncryptionDataId }
  }

  async getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined> {
    const caches = await this.caches
    return Object.values(caches.dataById).flatMap((x) => (x.decrypted ? [x.decrypted.accessControlSecret] : []))
  }
}

class LimitedLruCacheExchangeDataManager extends AbstractExchangeDataManager {
  private readonly idToDataCache: LruTemporisedAsyncCache<string, CachedExchangeData & { hashes: string[] }>
  private readonly hashToId: Map<string, string> = new Map()
  private readonly delegateToVerifiedEncryptionDataId: Map<string, string> = new Map()

  constructor(
    base: BaseExchangeDataManager,
    encryptionKeys: UserEncryptionKeysManager,
    signatureKeys: UserSignatureKeysManager,
    accessControlSecret: AccessControlSecretUtils,
    cryptoStrategies: CryptoStrategies,
    dataOwnerApi: IccDataOwnerXApi,
    primitives: CryptoPrimitives,
    optionalParameters: {
      lruCacheSize?: number
    }
  ) {
    super(base, encryptionKeys, signatureKeys, accessControlSecret, cryptoStrategies, dataOwnerApi, primitives)
    this.idToDataCache = new LruTemporisedAsyncCache(optionalParameters.lruCacheSize ?? 2000, () => -1)
  }

  async clearOrRepopulateCache(): Promise<void> {
    this.idToDataCache.clear(false)
    this.hashToId.clear()
    this.delegateToVerifiedEncryptionDataId.clear()
  }

  async getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [p: string]: CryptoKey }> {
    const res: { [p: string]: CryptoKey } = {}
    for (const hash of hashes) {
      const dataId = this.hashToId.get(hash)
      if (dataId) {
        const retrieved = (
          await this.idToDataCache.get(dataId, () => {
            throw new Error(`Data with id ${dataId} should have been already cached.`)
          })
        ).decrypted?.exchangeKey
        if (retrieved) {
          res[hash] = retrieved
        }
      }
    }
    return res
  }

  async getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[],
    retrieveIfNotCached: boolean
  ): Promise<{ decryptedKey: CryptoKey | undefined } | undefined> {
    const cached = await this.idToDataCache.getIfCachedJob(id)
    if (cached) {
      const updated = await this.idToDataCache.get(
        id,
        async (prevData) => {
          const toUpdate = prevData ?? cached.item
          if (toUpdate.decrypted) {
            const hashes = await this.accessControlSecret.secureDelegationKeysFor(
              toUpdate.decrypted.accessControlSecret,
              entityType,
              entitySecretForeignKeys
            )
            hashes.forEach((hash) => {
              this.hashToId.set(hash, toUpdate.exchangeData.id!)
            })
            toUpdate.hashes.push(...hashes)
          }
          return { item: toUpdate, onEviction: (b) => this.doOnEvictionJob(b, toUpdate) }
        },
        () => true
      )
      return { decryptedKey: updated.decrypted?.exchangeKey }
    } else if (retrieveIfNotCached) {
      return await this.idToDataCache
        .get(id, async () =>
          this.cacheJob(async () => {
            const data = await this.base.getExchangeDataById(id)
            if (!data) throw new Error(`Could not find exchange data with id ${id}`)
            const decrypted = await this.decryptData(data)
            if (decrypted) {
              const hashes = await this.accessControlSecret.secureDelegationKeysFor(
                decrypted.accessControlSecret,
                entityType,
                entitySecretForeignKeys
              )
              return { exchangeData: data, hashes, decrypted, verified: decrypted.verified }
            } else {
              return { exchangeData: data, hashes: [], verified: false }
            }
          })
        )
        .then((x) => ({ decryptedKey: x.decrypted?.exchangeKey }))
    } else return undefined
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    let existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
    if (!existingId) {
      await this.populateCacheToDelegate(delegateId, entityType, entitySecretForeignKeys)
      existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
    }
    if (existingId) {
      const cached = await this.idToDataCache.getIfCachedJob(existingId)
      if (!cached) throw new Error(`Illegal state: data with id ${existingId} should have been in cache`)
      if (cached.item.decrypted) {
        return {
          exchangeData: cached.item.exchangeData,
          exchangeKey: cached.item.decrypted.exchangeKey,
          accessControlSecret: cached.item.decrypted.accessControlSecret,
        }
      } else throw new Error(`Illegal state: cached verified data should be decrypted.`)
    } else {
      const newDataId = this.primitives.randomUuid()
      this.delegateToVerifiedEncryptionDataId.set(delegateId, newDataId)
      const createdAndCachedData = await this.idToDataCache.get(newDataId, () =>
        this.cacheJob(async () => {
          const created = await this.createNewExchangeData(delegateId, newDataId)
          return {
            exchangeData: created.exchangeData,
            decrypted: {
              accessControlSecret: created.accessControlSecret,
              exchangeKey: created.exchangeKey,
              verified: true,
            },
            hashes: await this.accessControlSecret.secureDelegationKeysFor(created.accessControlSecret, entityType, entitySecretForeignKeys),
          }
        })
      )
      if (!createdAndCachedData) throw new Error('Data should have been successfully created')
      return {
        exchangeData: createdAndCachedData.exchangeData,
        exchangeKey: createdAndCachedData.decrypted!.exchangeKey,
        accessControlSecret: createdAndCachedData.decrypted!.accessControlSecret,
      }
    }
  }

  async getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined> {
    return undefined
  }

  private async populateCacheToDelegate(
    delegateId: string,
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<void> {
    const dataToDelegate = await this.base.getExchangeDataByDelegatorDelegatePair(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    await Promise.all(
      dataToDelegate.map(async (data) => {
        await this.idToDataCache.get(data.id!, () =>
          this.cacheJob(async () => {
            const decrypted = await this.decryptData(data)
            if (decrypted) {
              const hashes = await this.accessControlSecret.secureDelegationKeysFor(
                decrypted.accessControlSecret,
                entityType,
                entitySecretForeignKeys
              )
              return { exchangeData: data, hashes, decrypted }
            } else {
              return { exchangeData: data, hashes: [] }
            }
          })
        )
      })
    )
  }

  private async cacheJob(
    retrieveDecryptedDataInfo: () => Promise<CachedExchangeData & { hashes: string[] }>
  ): Promise<{ item: CachedExchangeData & { hashes: string[] }; onEviction: (isReplacement: boolean) => void }> {
    const info = await retrieveDecryptedDataInfo()
    info.hashes.forEach((hash) => this.hashToId.set(hash, info?.exchangeData.id!))
    if (info.decrypted?.verified) this.delegateToVerifiedEncryptionDataId.set(info.exchangeData.delegate, info.exchangeData.id!)
    const item = {
      exchangeData: info.exchangeData,
      hashes: info.hashes,
      decrypted: info.decrypted,
    }
    return {
      item,
      onEviction: (b) => this.doOnEvictionJob(b, item),
    }
  }

  private async doOnEvictionJob(isReplacement: boolean, item: CachedExchangeData & { hashes: string[] }) {
    if (!isReplacement) {
      item.hashes.forEach((hash) => this.hashToId.delete(hash))
      if (this.delegateToVerifiedEncryptionDataId.get(item.exchangeData.delegate) === item.exchangeData.id) {
        this.delegateToVerifiedEncryptionDataId.delete(item.exchangeData.delegate)
      }
    }
  }
}
