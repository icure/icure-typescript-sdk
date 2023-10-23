import { IccExchangeDataApi } from '../../icc-api/api/IccExchangeDataApi'
import { ExchangeData } from '../../icc-api/model/internal/ExchangeData'
import { PaginatedListExchangeData } from '../../icc-api/model/PaginatedListExchangeData'
import { FakeGenericApi } from './FakeGenericApi'
import { PaginatedDocumentKeyIdPairObject } from '../../icc-api/model/PaginatedDocumentKeyIdPairObject'
import * as _ from 'lodash'
import { expect } from 'chai'
import base = Mocha.reporters.base

export type CallCount = {
  getExchangeDataById: number
  createExchangeData: number
  modifyExchangeData: number
  getExchangeDataByParticipant: number
  getExchangeDataByDelegatorDelegate: number
}

export type ExpectedCallCount = {
  getExchangeDataById?: number
  createExchangeData?: number
  modifyExchangeData?: number
  getExchangeDataByParticipant?: number
  getExchangeDataByDelegatorDelegate?: number
}

export class FakeExchangeDataApi extends IccExchangeDataApi {
  private readonly data = new FakeGenericApi<ExchangeData>()
  private _callCount: CallCount = {
    createExchangeData: 0,
    modifyExchangeData: 0,
    getExchangeDataById: 0,
    getExchangeDataByDelegatorDelegate: 0,
    getExchangeDataByParticipant: 0,
  }

  public get callCount(): CallCount {
    return _.cloneDeep(this._callCount)
  }

  compareCallCountFromBaseline(baseline: CallCount, expected: ExpectedCallCount) {
    for (const [key, v] of Object.entries(expected)) {
      const curr = (this._callCount as any)[key] as number
      const currBaseline = (baseline as any)[key] as number
      expect(curr).to.equal(
        currBaseline + v,
        `Actual call count for ${key} does not match expected
        Current: ${JSON.stringify(this._callCount)}
        Baseline: ${JSON.stringify(baseline)}
        ExpectedDifference: ${JSON.stringify(expected)}
        `
      )
    }
  }

  constructor() {
    super('fake', {}, null as any, null as any)
  }

  createExchangeData(body: ExchangeData): Promise<ExchangeData> {
    this._callCount.createExchangeData += 1
    return Promise.resolve(new ExchangeData(this.data.createObject(body)))
  }

  modifyExchangeData(body: ExchangeData): Promise<ExchangeData> {
    this._callCount.modifyExchangeData += 1
    return Promise.resolve(new ExchangeData(this.data.modifyObject(body)))
  }

  getExchangeDataById(exchangeDataId: string): Promise<ExchangeData> {
    this._callCount.getExchangeDataById += 1
    const retrieved = this.data.getById(exchangeDataId)
    if (!retrieved) throw new Error(`Exchange data with id ${exchangeDataId} does not exist`)
    return Promise.resolve(new ExchangeData(retrieved))
  }

  getExchangeDataByDelegatorDelegate(delegatorId: string, delegateId: string): Promise<ExchangeData[]> {
    this._callCount.getExchangeDataByDelegatorDelegate += 1
    return Promise.resolve(
      this.data
        .getAll()
        .filter((x) => x.delegate === delegateId && x.delegator === delegatorId)
        .map((x) => new ExchangeData(x))
    )
  }

  getExchangeDataByParticipant(dataOwnerId: string, startDocumentId?: string, limit?: number): Promise<PaginatedListExchangeData> {
    this._callCount.getExchangeDataByParticipant += 1
    const retrieved = this.data.getPaged(startDocumentId, limit ?? 1000)
    return Promise.resolve(
      new PaginatedListExchangeData({
        pageSize: retrieved.rows.length,
        totalSize: retrieved.rows.length,
        rows: retrieved.rows.filter((x) => x.delegator === dataOwnerId || x.delegate === dataOwnerId).map((x) => new ExchangeData(x)),
        nextKeyPair: new PaginatedDocumentKeyIdPairObject({ startKeyDocId: retrieved.nextId }),
      })
    )
  }

  getAll(): ExchangeData[] {
    return this.data.getAll().map((x) => new ExchangeData(x))
  }
}
