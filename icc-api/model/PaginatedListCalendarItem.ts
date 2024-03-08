import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { CalendarItem } from './CalendarItem'

export class PaginatedListCalendarItem {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListCalendarItem, json)
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<CalendarItem>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
