import {AbstractFilterCalendarItem} from "../../icc-api/model/AbstractFilterCalendarItem"

export class CalendarItemByPeriodAndAgendaIdFilter extends AbstractFilterCalendarItem {
  $type: string = 'CalendarItemByPeriodAndAgendaIdFilter'
  constructor(json: JSON | any) {
    super(json)

    Object.assign(this as CalendarItemByPeriodAndAgendaIdFilter, json)
  }

  agendaId?: String
  startTime?: number
  endTime?: number
  descending?: boolean
}
