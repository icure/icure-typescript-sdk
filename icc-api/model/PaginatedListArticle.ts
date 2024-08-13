import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { Article } from './Article'

export class PaginatedListArticle {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListArticle, {...json, rows: json.rows?.map((r: any) => new Article(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Article>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
