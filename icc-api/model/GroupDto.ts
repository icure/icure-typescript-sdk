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
import { PropertyStubDto } from "./PropertyStubDto"

/**
 * This entity represents a group
 */
import { decodeBase64 } from "./ModelHelper"

export class GroupDto {
  constructor(json: JSON | any) {
    Object.assign(this as GroupDto, json)
  }

  /**
   * The id of the group. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * The revision of the group in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  /**
   * Username for the group
   */
  name?: string
  /**
   * Password for the group access
   */
  password?: string
  /**
   * List of servers accessible to the group
   */
  servers?: Array<string>
  /**
   * Whether the group has a super admin permission, originally set to no access.
   */
  superAdmin?: boolean
  /**
   * Extra properties for the user. Those properties are typed (see class Property)
   */
  properties?: Array<PropertyStubDto>
  superGroup?: string
}
