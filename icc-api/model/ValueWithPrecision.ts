export class ValueWithPrecision {
  constructor(json: JSON | any) {
    Object.assign(this as ValueWithPrecision, json)
  }

  value?: number
  precision?: number
}
