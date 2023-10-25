export class Role {
  constructor(json: JSON | any) {
    Object.assign(this as Role, json)
  }

  id?: string
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  name?: string
  permissions?: Array<string>
}
