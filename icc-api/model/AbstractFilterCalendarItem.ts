export class AbstractFilterCalendarItem {
  constructor(json: JSON | any) {
    Object.assign(this as AbstractFilterCalendarItem, json)
  }

  desc?: string
}
