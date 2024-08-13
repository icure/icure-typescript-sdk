import {AbstractFilterCalendarItem} from "../../icc-api/model/AbstractFilterCalendarItem"

export class CalendarItemByRecurrenceIdFilter extends AbstractFilterCalendarItem {
  $type: string = 'CalendarItemByRecurrenceIdFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as CalendarItemByRecurrenceIdFilter, json)
  }

  recurrenceId?: String
}
