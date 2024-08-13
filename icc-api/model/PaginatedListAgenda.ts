import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { Agenda } from './Agenda'

export class PaginatedListAgenda {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListAgenda, {...json, rows: json.rows?.map((r: any) => new Agenda(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<Agenda>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
