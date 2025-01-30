export class SamV2Update {
  constructor(json: JSON | any) {
    Object.assign(this as SamV2Update, json)
  }

  id?: string
  rev?: string
  samVersion?: string
  version?: string
  date?: number
  type?: string
  updates?: { [key: string]: string }
  deletions?: { [key: string]: string }
}
