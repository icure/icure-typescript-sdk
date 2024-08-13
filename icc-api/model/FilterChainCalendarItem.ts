import { Predicate } from './Predicate'
import { AbstractFilterCalendarItem } from './AbstractFilterCalendarItem'

export class FilterChainCalendarItem {
  $type: string = 'FilterChain'

  constructor(json: JSON | any) {
    Object.assign(this as FilterChainCalendarItem, json)
  }

  filter?: AbstractFilterCalendarItem
  predicate?: Predicate
}
