import { UserEncryptionKeysManager } from './UserEncryptionKeysManager'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { DataOwnerWithType, IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { loadPublicKeys } from './utils'
import { CryptoPrimitives } from './CryptoPrimitives'
import { CryptoStrategies } from './CryptoStrategies'
import { IcureStorageFacade } from '../storage/IcureStorageFacade'

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * More powerful version of {@link BaseExchangeKeysManager} with a simplified interface. Has the following functionalities:
 * - Caches results
 * - Automatically creates new exchange keys if none is available
 * - Automatically choose the public keys to use during the creation of new exchange keys
 * - Automatically retrieves the private keys to use during decryption.
 */
export class ExchangeKeysManager {
  private readonly keyManager: UserEncryptionKeysManager
  private readonly baseExchangeKeysManager: BaseExchangeKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  private readonly cryptoStrategies: CryptoStrategies
  private readonly primitives: CryptoPrimitives
  private readonly icureStorage: IcureStorageFacade
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
    cryptoStrategies: CryptoStrategies,
    primitives: CryptoPrimitives,
    keyManager: UserEncryptionKeysManager,
    baseExchangeKeysManager: BaseExchangeKeysManager,
    dataOwnerApi: IccDataOwnerXApi,
    icureStorage: IcureStorageFacade
  ) {
    this.primitives = primitives
    this.cryptoStrategies = cryptoStrategies
    this.keyManager = keyManager
    this.baseExchangeKeysManager = baseExchangeKeysManager
    this.dataOwnerApi = dataOwnerApi
    this.delegatedExchangeKeysCache = new LruTemporisedAsyncCache(delegatedKeysCacheSize, (keys) =>
      keys.length > 0 ? delegatedKeysCacheLifetimeMsBase : delegatedKeysCacheLifetimeMsNoKeys
    )
    this.delegatorExchangeKeysCache = new LruTemporisedAsyncCache(delegatorKeysCacheSize, () => -1)
    this.icureStorage = icureStorage
  }

  /**
   * Get exchange keys from the current data owner to the provided delegate which are safe for encryption according to the locally verified keys.
   * If currently there is no exchange key towards the provided delegate which is safe for encryption a new one will be automatically created.
   * @param delegateId a delegate
   * @return an object with the following fields:
   *  - keys: all available exchange keys which are safe for encryption.
   *  - updatedDelegator (optional): if a new key creation job was started when the function was invoked the updated delegator, else undefined.
   */
  async getOrCreateEncryptionExchangeKeysTo(delegateId: string): Promise<{ updatedDelegator?: DataOwnerWithType; keys: CryptoKey[] }> {
    const currentKeys = await this.getSelfExchangeKeysTo(delegateId)
    if (currentKeys.length > 0) {
      return { keys: currentKeys }
    } else {
      while (true) {
        let updatedDelegatorJob: Promise<DataOwnerWithType> | undefined = undefined
        const keysWithNew = await this.delegatorExchangeKeysCache.get(
          delegateId,
          async (previous) => {
            const fullJob = this.forceCreateVerifiedExchangeKeyTo(delegateId)
            updatedDelegatorJob = fullJob.then(({ updatedDelegator }) => updatedDelegator)
            let existingKeys = previous ? previous : await this.forceGetSelfExchangeKeysTo(delegateId)
            return fullJob.then(({ key }) => [...existingKeys, key])
          },
          (v) => !v.length
        )
        if (keysWithNew.length > 0) {
          const updatedDelegator = updatedDelegatorJob ? await updatedDelegatorJob : undefined
          return updatedDelegator ? { keys: keysWithNew, updatedDelegator } : { keys: keysWithNew }
        }
      }
      /*NOTE:
       * in case of two concurrent calls to `getOrCreateEncryptionExchangeKeysTo` only one of the calls will receive the updated delegator. This could
       * be a problem if one of the callers would want to update the delegator for other reasons as well, as the request would result in a database
       * conflict. This situation however should be very rare and will be fully resolved in the near future when delegations will be moved out of the
       * data owner objects and into a specific database.
       */
    }
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
      return await this.delegatedExchangeKeysCache.get(key, () => this.forceGetExchangeKeysFor(delegatorId, delegateId))
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
    return await this.delegatorExchangeKeysCache.get(delegateId, () => this.forceGetSelfExchangeKeysTo(delegateId))
  }

  private async forceGetSelfExchangeKeysTo(delegateId: string): Promise<CryptoKey[]> {
    // Retrieve then try to decrypt with own and parent key pairs
    const encKeys = await this.baseExchangeKeysManager.getEncryptedExchangeKeysFor(await this.dataOwnerApi.getCurrentDataOwnerId(), delegateId)
    const { successfulDecryptions } = await this.baseExchangeKeysManager.tryDecryptExchangeKeys(encKeys, this.keyManager.getDecryptionKeys())
    return successfulDecryptions
  }

  private async forceCreateVerifiedExchangeKeyTo(delegateId: string): Promise<{ updatedDelegator: DataOwnerWithType; key: CryptoKey }> {
    const [mainKey, ...otherSelfKeys] = this.keyManager.getSelfVerifiedKeys()
    let otherPublicKeys = Object.fromEntries(otherSelfKeys.map((x) => [x.fingerprint, x.pair.publicKey]))
    if (delegateId !== (await this.dataOwnerApi.getCurrentDataOwnerId())) {
      const delegate = (await this.dataOwnerApi.getDataOwner(delegateId)).dataOwner
      const delegatePublicKeys = Array.from(this.dataOwnerApi.getHexPublicKeysOf(delegate))
      let verifiedDelegatePublicKeys: string[]
      if ((await this.dataOwnerApi.getCurrentDataOwnerHierarchyIds()).includes(delegateId)) {
        verifiedDelegatePublicKeys = await this.keyManager.getVerifiedPublicKeysFor(delegate)
      } else {
        verifiedDelegatePublicKeys = await this.cryptoStrategies.verifyDelegatePublicKeys(delegate, delegatePublicKeys, this.primitives)
      }
      if (!verifiedDelegatePublicKeys || verifiedDelegatePublicKeys.length == 0)
        throw new Error(`No verified public keys for delegate ${delegateId}: impossible to create new exchange key.`)
      otherPublicKeys = {
        ...otherPublicKeys,
        ...(await loadPublicKeys(this.primitives.RSA, verifiedDelegatePublicKeys)),
      }
    }
    return await this.baseExchangeKeysManager.createOrUpdateEncryptedExchangeKeyTo(delegateId, mainKey.pair, otherPublicKeys)
  }
}
