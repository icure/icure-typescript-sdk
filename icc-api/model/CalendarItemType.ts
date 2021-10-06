/**
 * iCure Data Stack API Documentation
 * The iCure Data Stack Application API is the native interface to iCure. This version is obsolete, please use v2.
 *
 * OpenAPI spec version: v1
 *
 *
 * NOTE: This class is auto generated by the swagger code generator program.
 * https://github.com/swagger-api/swagger-codegen.git
 * Do not edit the class manually.
 */

export class CalendarItemType {
  constructor(json: JSON | any) {
    Object.assign(this as CalendarItemType, json)
  }

  id?: string
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  name?: string
  color?: string
  duration?: number
  externalRef?: string
  mikronoId?: string
  docIds?: Array<string>
  otherInfos?: { [key: string]: string }
  subjectByLanguage?: { [key: string]: string }
}
