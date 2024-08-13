import { ExchangeData } from './internal/ExchangeData'
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'

export class PaginatedListExchangeData {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListExchangeData, {...json, rows: json.rows?.map((r: any) => new ExchangeData(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<ExchangeData>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
