import { RoleSourceEnum } from './RoleSourceEnum'

export class RoleConfiguration {
  constructor(json: JSON | any) {
    Object.assign(this as RoleConfiguration, json)
  }

  source?: RoleSourceEnum
  roles?: Array<string>
}
