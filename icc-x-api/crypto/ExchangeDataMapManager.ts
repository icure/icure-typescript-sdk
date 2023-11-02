import { IccExchangeDataMapApi } from '../../icc-api/api/internal/IccExchangeDataMapApi'
import { LruTemporisedAsyncCache } from '../utils/lru-temporised-async-cache'
import { ExchangeDataMap } from '../../icc-api/model/internal/ExchangeDataMap'
import { ExchangeDataMapCreationBatch } from '../../icc-api/model/ExchangeDataMapCreationBatch'

/**
 * @internal this class is intended for internal use only and may be modified without notice
 * This class manages the Exchange Data Map entities, caching with an LRU cache on retrieval.
 */
export class ExchangeDataMapManager {
  constructor(private readonly api: IccExchangeDataMapApi) {}

  private exchangeDataMapCache: LruTemporisedAsyncCache<string, null> = new LruTemporisedAsyncCache(1000, () => -1)

  /**
   * This function creates a batch of Exchange Data Map, ignoring the one that already exist and are already present in the cache.
   * The ones that are not are created and their ids are cached.
   * @param batch a map where each key is the hex-encoded access control key to another map that associates the encoded id of an
   * Exchange Data entity to the fingerprint of the key used to encrypt it.
   */
  async createExchangeDataMaps(batch: { [accessControlKey: string]: { [fp: string]: string } }): Promise<void> {
    const entriesToCreate: { [accessControlKey: string]: { [fp: string]: string } } = {}
    for (const [k, v] of Object.entries(batch)) {
      if (!(await this.exchangeDataMapCache.getIfCachedJob(k))) {
        entriesToCreate[k] = v
      }
    }
    await this.api.createExchangeDataMapBatch(new ExchangeDataMapCreationBatch({ batch: entriesToCreate }))
    await Promise.all(
      Object.keys(entriesToCreate).map(async (entry) => {
        await this.exchangeDataMapCache.get(entry, () => Promise.resolve({ item: null }))
      })
    )
  }

  /**
   * Retrieves an Exchange Data Map.
   * @param accessControlKeyHash the hex-encoded hash of the Exchange Data Map to retrieve.
   */
  async getExchangeDataMap(accessControlKeyHash: string): Promise<ExchangeDataMap> {
    const exchangeDataMap = await this.api.getExchangeDataMapById(accessControlKeyHash)
    await this.exchangeDataMapCache.get(exchangeDataMap.id, () => Promise.resolve({ item: null }))
    return exchangeDataMap
  }

  /**
   * Retrieves a batch of Exchange Data Maps.
   * @param accessControlKeyHashes the hex-encoded hashes of the Exchange Data Maps to retrieve.
   */
  async getExchangeDataMapBatch(accessControlKeyHashes: string[]): Promise<ExchangeDataMap[]> {
    const exchangeDataMaps = await this.api.getExchangeDataMapByBatch(accessControlKeyHashes)
    await Promise.all(
      exchangeDataMaps.map(async (entry) => {
        await this.exchangeDataMapCache.get(entry.id, () => Promise.resolve({ item: null }))
      })
    )
    return exchangeDataMaps
  }
}
