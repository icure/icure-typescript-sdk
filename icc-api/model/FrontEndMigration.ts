/**
 * iCure Cloud API Documentation
 * Spring shop sample application
 *
 * OpenAPI spec version: v0.0.1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */

export class FrontEndMigration {
  constructor(json: JSON | any) {
    Object.assign(this as FrontEndMigration, json)
  }

  id?: string
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  name?: string
  startDate?: number
  endDate?: number
  status?: FrontEndMigration.StatusEnum
  logs?: string
  userId?: string
  startKey?: string
  startKeyDocId?: string
  processCount?: number
}
export namespace FrontEndMigration {
  export type StatusEnum = "STARTED" | "ERROR" | "SUCCESS"
  export const StatusEnum = {
    STARTED: "STARTED" as StatusEnum,
    ERROR: "ERROR" as StatusEnum,
    SUCCESS: "SUCCESS" as StatusEnum
  }
}
