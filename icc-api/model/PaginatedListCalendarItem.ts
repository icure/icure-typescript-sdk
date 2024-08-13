import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { CalendarItem } from './CalendarItem'

export class PaginatedListCalendarItem {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListCalendarItem, {...json, rows: json.rows?.map((r: any) => new CalendarItem(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<CalendarItem>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
