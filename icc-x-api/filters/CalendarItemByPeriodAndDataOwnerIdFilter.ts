import {AbstractFilterCalendarItem} from "../../icc-api/model/AbstractFilterCalendarItem"

export class CalendarItemByPeriodAndDataOwnerIdFilter extends AbstractFilterCalendarItem {
  $type: string = 'CalendarItemByPeriodAndDataOwnerIdFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as CalendarItemByPeriodAndDataOwnerIdFilter, json)
  }

  dataOwnerId?: String
  startTime?: number
  endTime?: number
}
