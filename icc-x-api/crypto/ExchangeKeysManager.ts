import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { getShaVersionForKey, loadPublicKeys } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { CryptoStrategies } from './CryptoStrategies'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'
import { DataOwnerWithType } from '../../icc-api/model/DataOwnerWithType'
import { CryptoActorStubWithType } from '../../icc-api/model/CryptoActorStub'

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * More powerful version of {@link BaseExchangeKeysManager} with a simplified interface. Has the following functionalities:
 * - Caches results
 * - Automatically creates new exchange keys if none is available
 * - Automatically choose the public keys to use during the creation of new exchange keys
 * - Automatically retrieves the private keys to use during decryption.
 */
export class ExchangeKeysManager {
  /*
   * Exchange keys cache where the current user is the delegator. The keys where the delegator is the current user should never change without
   * an action from the delegator (unless he does this action from another device), so it should be safe to store them without expiration. However,
   * the delegator may still have a lot of exchange keys (e.g. doctor -> all patients), so it is not safe to have a cache with unlimited size.
   */
  private delegatorExchangeKeysCache: LruTemporisedAsyncCache<string, CryptoKey[]>
  /*
   * Exchange keys cache where the current user is not the delegator. There may be many keys where the current user is the delegate,
   * and they may change over time without any action from the current data owner, since the delegator is someone else. For this reason the cache must
   * be limited in size and it should not use data that is too old, as it may be outdated.
   */
  private delegatedExchangeKeysCache: LruTemporisedAsyncCache<string, CryptoKey[]>

  get base(): BaseExchangeKeysManager {
    return this.baseExchangeKeysManager
  }

  constructor(
    delegatorKeysCacheSize: number,
    delegatedKeysCacheSize: number,
    delegatedKeysCacheLifetimeMsBase: number,
    delegatedKeysCacheLifetimeMsNoKeys: number,
    private readonly cryptoStrategies: CryptoStrategies,
    private readonly primitives: CryptoPrimitives,
    private readonly keyManager: UserEncryptionKeysManager,
    private readonly baseExchangeKeysManager: BaseExchangeKeysManager,
    private readonly dataOwnerApi: IccDataOwnerXApi,
    private readonly useParentKeys: boolean,
    private readonly icureStorage: IcureStorageFacade
  ) {
    this.delegatedExchangeKeysCache = new LruTemporisedAsyncCache(delegatedKeysCacheSize, (keys) =>
      keys.length > 0 ? delegatedKeysCacheLifetimeMsBase : delegatedKeysCacheLifetimeMsNoKeys
    )
    this.delegatorExchangeKeysCache = new LruTemporisedAsyncCache(delegatorKeysCacheSize, () => -1)
  }

  /**
   * Get all keys currently available for a delegator-delegate pair. At least one of the two data owners must be part of the hierarchy for the current
   * data owner.
   * @param delegatorId id of a delegator
   * @param delegateId id of a delegate
   * @throws if neither the delegator nor the delegate is part of the hierarchy of the current data owner.
   * @return all available exchange keys from the delegator-delegate pair.
   */
  async getDecryptionExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    if (delegatorId === (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      return await this.getSelfExchangeKeysTo(delegateId)
    } else {
      const key = `${delegatorId}->${delegateId}`
      const hierarchyIds = await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()
      if (!hierarchyIds.some((x) => x === delegateId || x === delegatorId))
        throw new Error(`Trying to retrieve exchange key ${key} but current data owner hierarchy is ${hierarchyIds}`)
      return await this.delegatedExchangeKeysCache.get(key, () => this.forceGetExchangeKeysFor(delegatorId, delegateId).then((x) => ({ item: x })))
    }
  }

  /**
   * Empties the exchange keys cache.
   * @param includeKeysFromCurrentDataOwner if true also clears the
   */
  clearCache(includeKeysFromCurrentDataOwner: boolean) {
    if (includeKeysFromCurrentDataOwner) this.delegatorExchangeKeysCache.clear()
    this.delegatedExchangeKeysCache.clear()
  }

  private async forceGetExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    const encKeys = await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(delegatorId, delegateId)
    return (await this.baseExchangeKeysManager.tryDecryptExchangeKeys(encKeys, this.keyManager.getDecryptionKeys())).successfulDecryptions
  }

  private async getSelfExchangeKeysTo(delegateId: string): Promise<CryptoKey[]> {
    return await this.delegatorExchangeKeysCache.get(delegateId, () => this.forceGetSelfExchangeKeysTo(delegateId).then((x) => ({ item: x })))
  }

  private async forceGetSelfExchangeKeysTo(delegateId: string): Promise<CryptoKey[]> {
    // Retrieve then try to decrypt with own and parent key pairs
    const encKeys = await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    const { successfulDecryptions } = await this.baseExchangeKeysManager.tryDecryptExchangeKeys(encKeys, this.keyManager.getDecryptionKeys())
    return successfulDecryptions
  }
}
