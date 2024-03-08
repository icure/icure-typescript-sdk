import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { Article } from './Article'

export class PaginatedListArticle {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListArticle, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Article>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
