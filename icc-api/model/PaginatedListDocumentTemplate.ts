import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { DocumentTemplate } from './DocumentTemplate'

export class PaginatedListDocumentTemplate {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListDocumentTemplate, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<DocumentTemplate>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
