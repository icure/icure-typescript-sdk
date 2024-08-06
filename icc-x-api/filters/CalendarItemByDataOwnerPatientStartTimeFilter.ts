import {AbstractFilterCalendarItem} from "../../icc-api/model/AbstractFilterCalendarItem"

export class CalendarItemByDataOwnerPatientStartTimeFilter extends AbstractFilterCalendarItem {
  $type: string = 'CalendarItemByDataOwnerPatientStartTimeFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as CalendarItemByDataOwnerPatientStartTimeFilter, json)
  }

  dataOwnerId?: String
  startDate?: number
  endDate?: number
  secretPatientIds?: String[]
  descending?: boolean
}
