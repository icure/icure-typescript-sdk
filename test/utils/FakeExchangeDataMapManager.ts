import { ExchangeDataMapManager } from '../../icc-x-api/crypto/ExchangeDataMapManager'
import { IccExchangeDataMapApi } from '../../icc-api/api/IccExchangeDataMapApi'
import { ExchangeDataMap } from '../../icc-api/model/internal/ExchangeDataMap'
import { FakeGenericApi } from './FakeGenericApi'

export class FakeExchangeDataMapManager extends ExchangeDataMapManager {
  private fakeApi = new FakeGenericApi<ExchangeDataMap>()

  constructor() {
    super(new IccExchangeDataMapApi('', {}))
  }

  async createExchangeDataMaps(batch: { [accessControlKeyHash: string]: { [fp: string]: string } }): Promise<void> {
    Object.entries(batch).forEach(([hash, encryptedIds]) => {
      this.fakeApi.createObject(new ExchangeDataMap({ id: hash, encryptedExchangeDataIds: encryptedIds }))
    })
  }

  async getExchangeDataMap(accessControlKeyHash: string): Promise<ExchangeDataMap> {
    return this.fakeApi.getById(accessControlKeyHash)!
  }

  async getExchangeDataMapBatch(accessControlKeyHashes: string[]): Promise<ExchangeDataMap[]> {
    return accessControlKeyHashes.reduce((prev, curr) => {
      return [...prev, this.fakeApi.getById(curr)!]
    }, [] as ExchangeDataMap[])
  }
}
