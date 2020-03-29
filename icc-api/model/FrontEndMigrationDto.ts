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

export class FrontEndMigrationDto {
  constructor(json: JSON | any) {
    Object.assign(this as FrontEndMigrationDto, json)
  }

  id?: string
  rev?: string
  deletionDate?: number
  name?: string
  userId?: string
  startDate?: number
  endDate?: number
  status?: FrontEndMigrationDto.StatusEnum
  logs?: string
  startKey?: string
  startKeyDocId?: string
  processCount?: number
}
export namespace FrontEndMigrationDto {
  export type StatusEnum = "STARTED" | "ERROR" | "SUCCESS"
  export const StatusEnum = {
    STARTED: "STARTED" as StatusEnum,
    ERROR: "ERROR" as StatusEnum,
    SUCCESS: "SUCCESS" as StatusEnum
  }
}
