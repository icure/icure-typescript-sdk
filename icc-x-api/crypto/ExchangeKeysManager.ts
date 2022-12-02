import { KeyManager } from './KeyManager'
import { BaseExchangeKeysManager } from './BaseExchangeKeysManager'
import { IccDataOwnerXApi } from '../icc-data-owner-x-api'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'

/**
 * @internal This class is meant only for internal use and may be changed without notice.
 * More powerful version of {@link BaseExchangeKeysManager} with a simplified interface. Has the following functionalities:
 * - Caches results
 * - Automatically creates new exchange keys if none is available
 * - Automatically choose the public keys to use during the creation of new exchange keys
 * - Automatically retrieves the private keys to use during decryption.
 */
export class ExchangeKeysManager {
  /*TODO
   * - cache:
   *  - What? Data owner, exchange keys, private keys (for transfer)?
   *  - Lifespan: when to evict? Never, if not used within the last x minutes [or older than y minutes]
   *  - Public empty caches method
   * - Encrypted metadata: do I prefer parent or self key for delegations, cfk, and exchange keys? What is it in confidential vs standard?
   */
  private readonly selfDataOwnerId: string
  private readonly keyManager: KeyManager
  private readonly baseExchangeKeysManager: BaseExchangeKeysManager
  private readonly dataOwnerApi: IccDataOwnerXApi
  /*
   * Exchange keys cache where the current user is the delegator. There should be only few keys where the delegator is the current user, and they
   * should never change without an action from the delegator (unless he does this action from another device), so it should be safe to store them
   * in an unlimited cache and without expiration.
   */
  private delegatorExchangeKeys: Map<string, Promise<{ key: CryptoKey; isVerified: boolean }[]>> = new Map()
  /*
   * Exchange keys cache where the current user is the delegate and not the delegator. There may be many keys where the current user is the delegate,
   * and they may change over time without any action from the current data owner, since the delegator is someone else. For this reason the cache must
   * be limited in size and it should not use data that is too old, as it may be outdated.
   */
  private delegatedExchangeKeysCache: LruTemporisedAsyncCache<string, CryptoKey[]>

  constructor(
    delegatedKeysCacheSize: number,
    delegatedKeysCacheLifetimeMs: number,
    selfDataOwnerId: string,
    keyManager: KeyManager,
    baseExchangeKeysManager: BaseExchangeKeysManager,
    dataOwnerApi: IccDataOwnerXApi
  ) {
    this.selfDataOwnerId = selfDataOwnerId
    this.keyManager = keyManager
    this.baseExchangeKeysManager = baseExchangeKeysManager
    this.dataOwnerApi = dataOwnerApi
    this.delegatedExchangeKeysCache = new LruTemporisedAsyncCache(delegatedKeysCacheSize, delegatedKeysCacheLifetimeMs)
  }

  async getOrCreateEncryptionExchangeKeyTo(delegateId: string): Promise<CryptoKey[]> {
    // const key = `${delegatorId}->${delegateId}`
    // return await this.exchangeKeysCache.get(key, () => this.forceGetOrCreateExchangeKeysFor(delegatorId, delegateId))
  }

  async getExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    // const key = `${delegatorId}->${delegateId}`
    // return await this.exchangeKeysCache.get(key, () => this.forceGetOrCreateExchangeKeysFor(delegatorId, delegateId))
  }

  private async forceGetOrCreateExchangeKeysFor(delegatorId: string, delegateId: string): Promise<CryptoKey[]> {
    // const delegate = await this.dataOwnerApi.getDataOwner(delegateId)
    // const delegatePublicKeys = this.dataOwnerApi.getHexPublicKeysOf(delegate)
  }
}
