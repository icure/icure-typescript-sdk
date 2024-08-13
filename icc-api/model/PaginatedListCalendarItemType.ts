import { PaginatedDocumentKeyIdPairObject } from './PaginatedDocumentKeyIdPairObject'
import { CalendarItemType } from './CalendarItemType'

export class PaginatedListCalendarItemType {
  constructor(json: JSON | any) {
    Object.assign(this as PaginatedListCalendarItemType, {...json, rows: json.rows?.map((r: any) => new CalendarItemType(r))})
  }

  pageSize?: number
  totalSize?: number
  rows?: Array<CalendarItemType>
  nextKeyPair?: PaginatedDocumentKeyIdPairObject
}
