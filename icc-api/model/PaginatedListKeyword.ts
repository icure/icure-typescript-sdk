import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { Keyword } from './Keyword'

export class PaginatedListKeyword {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListKeyword, {...json, rows: json.rows?.map((r: any) => new Keyword(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Keyword>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
