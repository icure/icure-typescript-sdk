export class SamV2UpdateTaskLogItem {
  constructor(json: JSON | any) {
    Object.assign(this as SamV2UpdateTaskLogItem, json)
  }

  status?: 'Started' | 'Running' | 'Error' | 'Completed' | 'Missing'
  time?: number
  msg?: string
}
