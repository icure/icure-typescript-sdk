import { ExchangeData } from './ExchangeData'
import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'

export class PaginatedListExchangeData {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListExchangeData, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<ExchangeData>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
