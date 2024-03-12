import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { Place } from './Place'

export class PaginatedListPlace {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListPlace, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Place>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
