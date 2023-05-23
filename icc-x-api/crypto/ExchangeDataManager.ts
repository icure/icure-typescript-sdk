import { ExchangeData } from '../../icc-api/model/ExchangeData'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { BaseExchangeDataManager } from './BaseExchangeDataManager'
import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { UserSignatureKeysManager } from './UserSignatureKeysManager'
import { AccessControlSecretUtils } from './AccessControlSecretUtils'
import { CryptoStrategies } from './CryptoStrategies'
import { fingerprintV1, getShaVersionForKey, hexPublicKeysWithSha1Of, hexPublicKeysWithSha256Of } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { hex2ua, ua2b64 } from '../utils'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { EntityWithDelegationTypeName } from '../utils/EntityWithDelegationTypeName'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'

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
  const currentOwner = CryptoActorStubWithType.fromDataOwner(await dataOwnerApi.getCurrentDataOwner())
  if (cryptoStrategies.dataOwnerRequiresAnonymousDelegation(currentOwner)) {
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
   * available, then caches it. The {@link entityType} and {@link entitySecretForeignKeys} will be used for the secure-delegation-hash-based cache
   * of the exchange data and not for actually creating the exchange data.
   * @param delegateId the id of the delegate.
   * @param entityType type of the entity for which you want to create new metadata.
   * @param entitySecretForeignKeys the secret foreign keys of the entity which you want to create new metadata.
   * @return the access control secret and key of the data to use for encryption.
   */
  getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }>

  /**
   * Retrieve the cached decrypted exchange data key associated with any of the provided hashes/entry keys of secure delegations. Depending on the
   * implementation the {@link entityType} and {@link entitySecretForeignKeys} may be used to improve the secure-delegation-hash-based cache of
   * exchange data from the other available exchange data caches.
   * @param hashes hashes of access control secrets for a specific entity, as they appear in the key of secure delegation entries
   * @param entityType type of the entity containing the metadata for which you are retrieving the encryption key.
   * @param entitySecretForeignKeys the secret foreign keys of the entity containing the metadata for which you are retrieving the encryption key.
   * @return the exchange data and decrypted key associated to that hash if cached
   */
  getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } }>

  /**
   * Retrieves the exchange data with the provided id (from the cache if available or from the server otherwise if allowed by
   * {@link retrieveIfNotCached}) and attempts to decrypt it, then caches the result. The {@link entityType} and {@link entitySecretForeignKeys} will
   * be used for the secure-delegation-hash-based cache of the exchange data.
   * @param id id of the exchange data
   * @param entityType type of the entity containing the metadata for which you are retrieving the encryption key.
   * @param entitySecretForeignKeys the secret foreign keys of the entity containing the metadata for which you are retrieving the encryption key.
   * @param retrieveIfNotCached if false and there is no cached exchange data with the provided id the method returns undefined, else the method will
   * attempt to load the exchange data from the server.
   * @return undefined if the exchange data is not cached and {@link retrieveIfNotCached} is false. Else an object containing:
   * - exchangeData: the exchange data with the provided id
   * - exchangeKey: the exchange key corresponding to the provided exchange data if it could be decrypted, else undefined
   * @throws if no exchange data with the given id is cached and {@link retrieveIfNotCached} is true and the data could not be found in the server
   * either.
   */
  getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined,
    retrieveIfNotCached: boolean
  ): Promise<{ exchangeKey: CryptoKey | undefined; exchangeData: ExchangeData } | undefined>

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
}

abstract class AbstractExchangeDataManager implements ExchangeDataManager {
  constructor(
    readonly base: BaseExchangeDataManager,
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
    const delegate = await this.dataOwnerApi.getCryptoActorStub(delegateId)
    const sha256KeysOfDelegate = hexPublicKeysWithSha256Of(delegate.stub)
    const sha1KeysOfDelegate = hexPublicKeysWithSha1Of(delegate.stub)
    const allVerifiedDelegateKeys = await this.cryptoStrategies.verifyDelegatePublicKeys(
      delegate,
      [...Array.from(sha256KeysOfDelegate), ...Array.from(sha1KeysOfDelegate)],
      this.primitives
    )
    if (!allVerifiedDelegateKeys.length)
      throw new Error(`Could not create exchange data to ${delegateId} as no public key for the delegate could be verified.`)
    const encryptionKeys: { [fp: string]: CryptoKey } = {}
    this.encryptionKeys.getSelfVerifiedKeys().forEach(({ fingerprint, pair }) => {
      encryptionKeys[fingerprint] = pair.publicKey
    })
    for (const delegateKey of allVerifiedDelegateKeys) {
      if (sha1KeysOfDelegate.has(delegateKey)) {
        encryptionKeys[fingerprintV1(delegateKey)] = await this.primitives.RSA.importKey('spki', hex2ua(delegateKey), ['encrypt'], 'sha-1')
      } else if (sha256KeysOfDelegate.has(delegateKey)) {
        encryptionKeys[fingerprintV1(delegateKey)] = await this.primitives.RSA.importKey('spki', hex2ua(delegateKey), ['encrypt'], 'sha-256')
      } else throw new Error('Illegal state: verified keys should contain only keys for OAPE-SHA1 or OAPE-SHA256.')
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

  async giveAccessBackTo(otherDataOwner: string, newDataOwnerPublicKey: string) {
    const self = await this.dataOwnerApi.getCurrentDataOwnerId()
    const newKeyFp = fingerprintV1(newDataOwnerPublicKey)
    const other = await this.dataOwnerApi.getCryptoActorStub(otherDataOwner)
    const newKeyHashVersion = getShaVersionForKey(other.stub, newDataOwnerPublicKey)
    if (!newKeyHashVersion) throw new Error(`Public key not found for data owner ${otherDataOwner}`)
    const importedNewKey = await this.primitives.RSA.importKey('spki', hex2ua(newDataOwnerPublicKey), ['encrypt'], newKeyHashVersion)
    const signatureKey = await this.signatureKeys.getOrCreateSignatureKeyPair()
    const decryptionKeys = this.encryptionKeys.getDecryptionKeys()
    const allExchangeDataToUpdate = [
      ...(await this.base.getExchangeDataByDelegatorDelegatePair(self, otherDataOwner)),
      ...(await this.base.getExchangeDataByDelegatorDelegatePair(otherDataOwner, self)),
    ]
    for (const dataToUpdate of allExchangeDataToUpdate) {
      if (!Object.keys(dataToUpdate.exchangeKey).find((fp) => fp == newKeyFp)) {
        const updated = await this.base.tryUpdateExchangeData(
          dataToUpdate,
          decryptionKeys,
          { [newKeyFp]: importedNewKey },
          { [signatureKey.fingerprint]: signatureKey.keyPair.privateKey },
          (verificationFp) => this.signatureKeys.getSignatureVerificationKey(verificationFp)
        )
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
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    throw new Error('Implemented by concrete class')
  }

  getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } }> {
    throw new Error('Implemented by concrete class')
  }

  getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined,
    retrieveIfNotCached: boolean
  ): Promise<{ exchangeData: ExchangeData; exchangeKey: CryptoKey | undefined } | undefined> {
    throw new Error('Implemented by concrete class')
  }

  getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined> {
    throw new Error('Implemented by concrete class')
  }

  getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined> {
    throw new Error('Implemented by concrete class')
  }
}

class FullyCachedExchangeDataManager extends AbstractExchangeDataManager {
  private caches: Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: Map<string, string>
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
    entityTypeToAccessControlKeysValue: { [entityType in EntityWithDelegationTypeName]?: string }
  }> = Promise.resolve({ dataById: {}, hashToId: new Map(), delegateToVerifiedEncryptionDataId: {}, entityTypeToAccessControlKeysValue: {} })

  async clearOrRepopulateCache(): Promise<void> {
    this.caches = this.doRepopulateCache()
    await this.caches
  }

  async getCachedDecryptionDataKeyByAccessControlHash(
    hashes: string[],
    entityType: EntityWithDelegationTypeName,
    entitySecretForeignKeys: string[]
  ): Promise<{ [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } }> {
    function retrieveByHashesFromCaches(caches: {
      dataById: { [id: string]: CachedExchangeData }
      hashToId: Map<string, string>
      delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
    }): { [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } } {
      return hashes.reduce((res, hash) => {
        const id = caches.hashToId.get(hash)
        if (id) {
          const cached = caches.dataById[id]
          if (cached?.decrypted?.exchangeKey) {
            res[hash] = { exchangeData: cached.exchangeData, exchangeKey: cached.decrypted.exchangeKey }
          }
        }
        return res
      }, {} as { [hash: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } })
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
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined
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
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined,
    retrieveIfNotCached: boolean
  ): Promise<{ exchangeData: ExchangeData; exchangeKey: CryptoKey | undefined } | undefined> {
    const caches = await this.caches
    const cachedData = caches.dataById[id]
    if (cachedData) {
      return { exchangeData: cachedData.exchangeData, exchangeKey: cachedData.decrypted?.exchangeKey }
    } else if (retrieveIfNotCached) {
      const data = await this.base.getExchangeDataById(id)
      if (!data) throw new Error(`Could not find exchange data with id ${id}`)
      const decrypted = await this.decryptData(data)
      this.cacheData(data, decrypted, entityType, entitySecretForeignKeys)
      return { exchangeData: data, exchangeKey: decrypted?.exchangeKey }
    } else return undefined
  }

  private cacheData(
    exchangeData: ExchangeData,
    decrypted: { accessControlSecret: string; exchangeKey: CryptoKey; verified: boolean } | undefined,
    entityType?: EntityWithDelegationTypeName,
    entitySecretForeignKeys?: string[]
  ): void {
    this.caches = this.caches.then(async (caches) => {
      caches.dataById[exchangeData.id!] = { exchangeData, decrypted }
      if (decrypted) {
        // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
        // `secureDelegationKeysFor` is currently ignoring the sfks
        if (entityType && entitySecretForeignKeys) {
          const hashes = await this.accessControlSecret.secureDelegationKeysFor(decrypted.accessControlSecret, entityType, entitySecretForeignKeys)
          hashes.forEach((hash) => {
            caches.hashToId.set(hash, exchangeData.id!)
          })
        }
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
    entityTypeToAccessControlKeysValue: { [entityType in EntityWithDelegationTypeName]?: string }
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
    const entityTypeToAccessControlKeysValue: { [entityType in EntityWithDelegationTypeName]?: string } = {}
    return { dataById, hashToId, delegateToVerifiedEncryptionDataId, entityTypeToAccessControlKeysValue }
  }

  async getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined> {
    const caches = await this.caches
    const cached = caches.entityTypeToAccessControlKeysValue[entityType]
    if (cached) return cached
    const accessControlSecrets = Object.values(caches.dataById).flatMap((x) => (x.decrypted ? [x.decrypted.accessControlSecret] : []))
    const fullBuffer = new Uint8Array(accessControlSecrets.length * this.accessControlSecret.accessControlKeyLengthBytes)
    for (let i = 0; i < accessControlSecrets.length; i++) {
      const accessControlSecret = accessControlSecrets[i]
      const key = await this.accessControlSecret.accessControlKeyFor(accessControlSecret, entityType, undefined)
      fullBuffer.set(new Uint8Array(key), i * this.accessControlSecret.accessControlKeyLengthBytes)
    }
    const fullData = ua2b64(fullBuffer)
    caches.entityTypeToAccessControlKeysValue[entityType] = fullData
    return fullData
  }

  async getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined> {
    const caches = await this.caches
    const accessControlSecrets = Object.values(caches.dataById).flatMap((x) => (x.decrypted ? [x.decrypted.accessControlSecret] : []))
    const res: string[] = []
    for (const accessControlSecret of accessControlSecrets) {
      // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
      res.push(await this.accessControlSecret.secureDelegationKeyFor(accessControlSecret, entityType, undefined))
    }
    return res
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
  ): Promise<{ [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } }> {
    const res: { [p: string]: { exchangeData: ExchangeData; exchangeKey: CryptoKey } } = {}
    for (const hash of hashes) {
      const dataId = this.hashToId.get(hash)
      if (dataId) {
        const retrieved = await this.idToDataCache.get(dataId, () => {
          throw new Error(`Data with id ${dataId} should have been already cached.`)
        })
        if (retrieved?.decrypted?.exchangeKey) {
          res[hash] = { exchangeData: retrieved.exchangeData, exchangeKey: retrieved.decrypted.exchangeKey }
        }
      }
    }
    return res
  }

  async getDecryptionDataKeyById(
    id: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined,
    retrieveIfNotCached: boolean
  ): Promise<{ exchangeData: ExchangeData; exchangeKey: CryptoKey | undefined } | undefined> {
    const cached = await this.idToDataCache.getIfCachedJob(id)
    if (cached) {
      const updated = await this.idToDataCache.get(
        id,
        async (prevData) => {
          const toUpdate = prevData ?? cached.item
          if (toUpdate.decrypted) {
            // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
            // `secureDelegationKeysFor` is currently ignoring the sfks
            if (entityType && entitySecretForeignKeys) {
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
          }
          return { item: toUpdate, onEviction: (b) => this.doOnEvictionJob(b, toUpdate) }
        },
        () => true
      )
      return { exchangeData: updated.exchangeData, exchangeKey: updated.decrypted?.exchangeKey }
    } else if (retrieveIfNotCached) {
      return await this.idToDataCache
        .get(id, async () =>
          this.cacheJob(async () => {
            const data = await this.base.getExchangeDataById(id)
            if (!data) throw new Error(`Could not find exchange data with id ${id}`)
            const decrypted = await this.decryptData(data)
            if (decrypted) {
              // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
              // `secureDelegationKeysFor` is currently ignoring the sfks
              if (entityType && entitySecretForeignKeys) {
                const hashes = await this.accessControlSecret.secureDelegationKeysFor(
                  decrypted.accessControlSecret,
                  entityType,
                  entitySecretForeignKeys
                )
                return { exchangeData: data, hashes, decrypted, verified: decrypted.verified }
              } else {
                return { exchangeData: data, hashes: [], decrypted, verified: decrypted.verified }
              }
            } else {
              return { exchangeData: data, hashes: [], verified: false }
            }
          })
        )
        .then((x) => ({ exchangeData: x.exchangeData, exchangeKey: x.decrypted?.exchangeKey }))
    } else return undefined
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    let existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
    if (!existingId) {
      // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
      // `secureDelegationKeysFor` is currently ignoring the sfks
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
            // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
            // `secureDelegationKeysFor` is currently ignoring the sfks
            hashes:
              entityType && entitySecretForeignKeys
                ? await this.accessControlSecret.secureDelegationKeysFor(created.accessControlSecret, entityType, entitySecretForeignKeys)
                : [],
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

  private async populateCacheToDelegate(
    delegateId: string,
    entityType: EntityWithDelegationTypeName | undefined,
    entitySecretForeignKeys: string[] | undefined
  ): Promise<void> {
    const dataToDelegate = await this.base.getExchangeDataByDelegatorDelegatePair(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    await Promise.all(
      dataToDelegate.map(async (data) => {
        await this.idToDataCache.get(data.id!, () =>
          this.cacheJob(async () => {
            const decrypted = await this.decryptData(data)
            if (decrypted) {
              if (entityType && entitySecretForeignKeys) {
                // Usage of sfks in secure delegation key should be configurable: it is not necessary for all users and it has some performance impact
                // `secureDelegationKeysFor` is currently ignoring the sfks
                const hashes = await this.accessControlSecret.secureDelegationKeysFor(
                  decrypted.accessControlSecret,
                  entityType,
                  entitySecretForeignKeys
                )
                return { exchangeData: data, hashes, decrypted }
              } else {
                return { exchangeData: data, hashes: [], decrypted }
              }
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

  getAccessControlKeysValue(entityType: EntityWithDelegationTypeName): Promise<string | undefined> {
    return Promise.resolve(undefined)
  }

  getAllDelegationKeys(entityType: EntityWithDelegationTypeName): Promise<string[] | undefined> {
    return Promise.resolve(undefined)
  }
}
