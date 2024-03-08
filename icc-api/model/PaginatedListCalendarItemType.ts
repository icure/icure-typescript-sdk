import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { CalendarItemType } from './CalendarItemType'

export class PaginatedListCalendarItemType {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListCalendarItemType, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<CalendarItemType>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
