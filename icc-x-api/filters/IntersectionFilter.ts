import { AbstractFilter } from './filters'

export class IntersectionFilter<T> {
  constructor(filters: AbstractFilter<T>[]) {
    this.filters = filters
  }

  desc?: string
  filters: AbstractFilter<T>[]
  $type = 'IntersectionFilter'
}
