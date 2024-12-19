export class Range {
  constructor(json: JSON | any) {
    this.low = json?.low
    this.high = json?.high
  }

  low?: number
  high?: number
}
