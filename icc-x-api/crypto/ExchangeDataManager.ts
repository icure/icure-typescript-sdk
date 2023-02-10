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

/**
 * Initialises and returns the exchange data manager which is most appropriate for the current data owner.
 */
async function initialiseForCurrentDataOwner(
  base: BaseExchangeDataManager,
  encryptionKeys: UserEncryptionKeysManager,
  signatureKeys: UserSignatureKeysManager,
  accessControlSecret: AccessControlSecretUtils,
  cryptoStrategies: CryptoStrategies,
  dataOwnerApi: IccDataOwnerXApi,
  primitives: CryptoPrimitives
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
      primitives
    )
  }
}

type CachedExchangeData = { exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }

/**
 * @internal this class is intended for internal use only and may be changed without notice.
 * Exchange data manager which automatically handles decryption and cache
 */
export interface ExchangeDataManager {
  /**
   * Gets any existing and verified exchange data from the current data owner to the provided delegate or creates new data if no verified data is
   * available.
   * @param delegateId the id of the delegate.
   * @return the access control secret and key of the data to use for encryption.
   */
  getOrCreateEncryptionDataTo(delegateId: string): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }>

  /**
   * Retrieve the cached decrypted exchange data key associated with any of the provided hashes/entry keys of a secure delegation.
   * @param hashes hashes of access control secrets for a specific entity, as they appear in the key of secure delegation entries
   * @return the exchange key associated to that hash if cached
   */
  getCachedDecryptionDataKeyByAccessControlHash(hashes: string[]): Promise<{ [hash: string]: CryptoKey }>

  /**
   * Retrieves the decrypted data exchange key given the id of the exchange data and attempts to decrypt it.
   * @param id id of the exchange data
   * @return the exchange key associated to the exchange data with the provided id, or undefined if the exchange data could not be decrypted.
   * @throws if no exchange data with the given id could be found.
   */
  getDecryptionDataKeyById(id: string): Promise<CryptoKey | undefined>

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
        exchangeData: ExchangeData
        accessControlSecret: string
        exchangeKey: CryptoKey
        verified: boolean
        hashes: string[]
      }
    | undefined
  > {
    const decryptionKeys = this.encryptionKeys.getDecryptionKeys()
    const decryptedKey = (await this.base.tryDecryptExchangeKeys([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedKey) return undefined
    const decryptedAccessControlSecret = (await this.base.tryDecryptAccessControlSecret([data], decryptionKeys)).successfulDecryptions[0]
    if (!decryptedAccessControlSecret) throw new Error(`Decryption key could be decrypted but access control secret could not for data ${data}`)
    return {
      exchangeData: data,
      accessControlSecret: decryptedAccessControlSecret,
      exchangeKey: decryptedKey,
      verified: await this.base.verifyExchangeData(data, (fp) => this.signatureKeys.getSignatureVerificationKey(fp)),
      hashes: await this.accessControlSecret.allHashesForSecret(decryptedAccessControlSecret),
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

  getCachedDecryptionDataKeyByAccessControlHash(hashes: string[]): Promise<{ [p: string]: CryptoKey }> {
    throw new Error('Implemented by concrete class')
  }

  getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined> {
    throw new Error('Implemented by concrete class')
  }

  getOrCreateEncryptionDataTo(delegateId: string): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    throw new Error('Implemented by concrete class')
  }

  getDecryptionDataKeyById(id: string): Promise<CryptoKey | undefined> {
    throw new Error('Implemented by concrete class')
  }
}

class FullyCachedExchangeDataManager extends AbstractExchangeDataManager {
  private caches: Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: { [hash: string]: string }
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
  }> = Promise.resolve({ dataById: {}, hashToId: {}, delegateToVerifiedEncryptionDataId: {} })

  async clearOrRepopulateCache(): Promise<void> {
    this.caches = this.doRepopulateCache()
    await this.caches
  }

  async getCachedDecryptionDataKeyByAccessControlHash(hashes: string[]): Promise<{ [hash: string]: CryptoKey }> {
    const caches = await this.caches
    return hashes.reduce((res, hash) => {
      const id = caches.hashToId[hash]
      if (id) {
        res[hash] = caches.dataById[id].exchangeKey
      }
      return res
    }, {} as { [hash: string]: CryptoKey })
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    const caches = await this.caches
    const dataId = caches.delegateToVerifiedEncryptionDataId[delegateId]
    if (dataId) {
      const cached = caches.dataById[dataId]
      return {
        exchangeData: cached.exchangeData,
        accessControlSecret: cached.accessControlSecret,
        exchangeKey: cached.exchangeKey,
      }
    }
    const created = await this.createNewExchangeData(delegateId)
    this.cacheData(
      created.exchangeData,
      created.accessControlSecret,
      created.exchangeKey,
      true,
      await this.accessControlSecret.allHashesForSecret(created.accessControlSecret)
    )
    return created
  }

  async getDecryptionDataKeyById(id: string): Promise<CryptoKey | undefined> {
    const data = await this.base.getExchangeDataById(id)
    if (!data) throw new Error(`Could not find exchange data with id ${id}`)
    const decrypted = await this.decryptData(data)
    if (!decrypted) return undefined
    this.cacheData(decrypted.exchangeData, decrypted.accessControlSecret, decrypted.exchangeKey, decrypted.verified, decrypted.hashes)
    return decrypted.exchangeKey
  }

  private cacheData(exchangeData: ExchangeData, accessControlSecret: string, exchangeKey: CryptoKey, verified: boolean, hashes: string[]): void {
    this.caches = this.caches.then((caches) => {
      caches.dataById[exchangeData.id!] = {
        exchangeData,
        accessControlSecret,
        exchangeKey,
      }
      hashes.forEach((hash) => {
        caches.hashToId[hash] = exchangeData.id!
      })
      if (verified) {
        caches.delegateToVerifiedEncryptionDataId[exchangeData.delegate] = exchangeData.id!
      }
      return caches
    })
  }

  private async doRepopulateCache(): Promise<{
    dataById: { [id: string]: CachedExchangeData }
    hashToId: { [hash: string]: string }
    delegateToVerifiedEncryptionDataId: { [delegate: string]: string }
  }> {
    const allData = await this.base.getAllExchangeDataForCurrentDataOwnerIfAllowed()
    if (!allData) throw new Error('Impossible to use fully cached exchange data manager for current data owner.')
    const dataById: { [id: string]: CachedExchangeData } = {}
    const hashToId: { [hash: string]: string } = {}
    const delegateToVerifiedEncryptionDataId: { [delegate: string]: string } = {}
    for (const data of allData) {
      const currDecrypted = await this.decryptData(data)
      if (currDecrypted) {
        dataById[data.id!] = { exchangeData: data, exchangeKey: currDecrypted.exchangeKey, accessControlSecret: currDecrypted.accessControlSecret }
        ;(await this.accessControlSecret.allHashesForSecret(currDecrypted.accessControlSecret)).forEach((hash) => {
          hashToId[hash] = data.id!
        })
        if (currDecrypted.verified) {
          delegateToVerifiedEncryptionDataId[data.delegate] = data.id!
        }
      }
    }
    return { dataById, hashToId, delegateToVerifiedEncryptionDataId }
  }

  async getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined> {
    const caches = await this.caches
    return Object.values(caches.dataById).map((x) => x.accessControlSecret)
  }
}

class LimitedLruCacheExchangeDataManager extends AbstractExchangeDataManager {
  private readonly idToDataCache: LruTemporisedAsyncCache<string, CachedExchangeData | undefined> = new LruTemporisedAsyncCache(2000, () => -1)
  private readonly hashToId: Map<string, string> = new Map()
  private readonly delegateToVerifiedEncryptionDataId: Map<string, string> = new Map()

  async clearOrRepopulateCache(): Promise<void> {
    this.idToDataCache.clear(false)
    this.hashToId.clear()
    this.delegateToVerifiedEncryptionDataId.clear()
  }

  async getCachedDecryptionDataKeyByAccessControlHash(hashes: string[]): Promise<{ [p: string]: CryptoKey }> {
    const res: { [p: string]: CryptoKey } = {}
    for (const hash of hashes) {
      const dataId = this.hashToId.get(hash)
      if (dataId) {
        const retrieved = (
          await this.idToDataCache.get(dataId, () => {
            throw new Error(`Data with id ${dataId} should have been already cached.`)
          })
        )?.exchangeKey
        if (retrieved) {
          res[hash] = retrieved
        }
      }
    }
    return res
  }

  async getDecryptionDataKeyById(id: string): Promise<CryptoKey | undefined> {
    return (
      await this.idToDataCache.get(id, () =>
        this.cacheJob(async () => {
          const data = await this.base.getExchangeDataById(id)
          if (!data) throw new Error(`Could not find exchange data with id ${id}`)
          return await this.decryptData(data)
        })
      )
    )?.exchangeKey
  }

  async getOrCreateEncryptionDataTo(
    delegateId: string
  ): Promise<{ exchangeData: ExchangeData; accessControlSecret: string; exchangeKey: CryptoKey }> {
    let existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
    if (!existingId) {
      await this.populateCacheToDelegate(delegateId)
      existingId = this.delegateToVerifiedEncryptionDataId.get(delegateId)
    }
    if (existingId) {
      const cached = await this.idToDataCache.get(existingId, () => {
        throw new Error(`Data with id ${existingId} should have been already cached.`)
      })
      return {
        exchangeData: cached!.exchangeData,
        exchangeKey: cached!.exchangeKey,
        accessControlSecret: cached!.accessControlSecret,
      }
    } else {
      const newDataId = this.primitives.randomUuid()
      this.delegateToVerifiedEncryptionDataId.set(delegateId, newDataId)
      const createdAndCachedData = await this.idToDataCache.get(newDataId, () =>
        this.cacheJob(async () => {
          const created = await this.createNewExchangeData(delegateId, newDataId)
          return {
            ...created,
            verified: true,
            hashes: await this.accessControlSecret.allHashesForSecret(created.accessControlSecret),
          }
        })
      )
      if (!createdAndCachedData) throw new Error('Data should have been successfully created')
      return {
        exchangeData: createdAndCachedData.exchangeData,
        exchangeKey: createdAndCachedData.exchangeKey,
        accessControlSecret: createdAndCachedData.accessControlSecret,
      }
    }
  }

  async getAllAccessControlSecretsIfAllowed(): Promise<string[] | undefined> {
    return undefined
  }

  private async populateCacheToDelegate(delegateId: string): Promise<void> {
    const dataToDelegate = await this.base.getExchangeDataByDelegatorDelegatePair(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    await Promise.all(
      dataToDelegate.map((data) => {
        this.idToDataCache.get(data.id!, () => this.cacheJob(() => this.decryptData(data)))
      })
    )
  }

  private async cacheJob(
    retrieveDecryptedDataInfo: () => Promise<(CachedExchangeData & { hashes: string[]; verified: boolean }) | undefined>
  ): Promise<{ item: CachedExchangeData | undefined; onEviction: () => void }> {
    const info = await retrieveDecryptedDataInfo()
    if (!info) return { item: undefined, onEviction: () => {} }
    info.hashes.forEach((hash) => this.hashToId.set(hash, info?.exchangeData.id!))
    if (info.verified) this.delegateToVerifiedEncryptionDataId.set(info.exchangeData.delegate, info.exchangeData.id!)
    return {
      item: {
        exchangeData: info.exchangeData,
        accessControlSecret: info.accessControlSecret,
        exchangeKey: info.exchangeKey,
      },
      onEviction: () => {
        info.hashes.forEach((hash) => this.hashToId.delete(hash))
        if (this.delegateToVerifiedEncryptionDataId.get(info.exchangeData.delegate) === info.exchangeData.id) {
          this.delegateToVerifiedEncryptionDataId.delete(info.exchangeData.delegate)
        }
      },
    }
  }
}
