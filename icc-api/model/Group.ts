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
import { CodeStub } from './CodeStub'
import { OperationToken } from './OperationToken'
import { PropertyStub } from './PropertyStub'
import { UserTypeEnum } from './UserTypeEnum'

/**
 * This entity represents a group
 */
export class Group {
  constructor(json: JSON | any) {
    Object.assign(this as Group, json)
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
   * A tag is an item from a codification system that qualifies an entity as being member of a certain class, whatever the value it might have taken. If the tag qualifies the content of a field, it means that whatever the content of the field, the tag will always apply. For example, the label of a field is qualified using a tag. LOINC is a codification system typically used for tags.
   */
  tags?: Array<CodeStub>
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
  properties?: Array<PropertyStub>
  /**
   * Single-used token to perform specific operations
   */
  operationTokens?: { [key: string]: OperationToken }
  /**
   * List of entities that have to be collected from a shared database. Only Code and tarification can be set at this point.
   */
  sharedEntities?: { [key: string]: string }
  superGroup?: string
  defaultUserRoles?: { [key in UserTypeEnum]: Array<string> }
}
