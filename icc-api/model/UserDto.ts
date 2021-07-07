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
import { PermissionDto } from "./PermissionDto"
import { PropertyStubDto } from "./PropertyStubDto"

/**
 * This entity is a root level object. It represents an user that can log in to the iCure platform. It is serialized in JSON and saved in the underlying icure-base CouchDB database.
 */
import { decodeBase64 } from "./ModelHelper"

export class UserDto {
  constructor(json: JSON | any) {
    Object.assign(this as UserDto, json)
  }

  /**
   * the Id of the user. We encourage using either a v4 UUID or a HL7 Id.
   */
  id?: string
  /**
   * the revision of the user in the database, used for conflict management / optimistic locking.
   */
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  created?: number
  /**
   * Last name of the user. This is the official last name that should be used for official administrative purposes.
   */
  name?: string
  /**
   * Extra properties for the user. Those properties are typed (see class Property)
   */
  properties?: Array<PropertyStubDto>
  /**
   * If permission to modify patient data is granted or revoked
   */
  permissions?: Array<PermissionDto>
  /**
   * Roles specified for the user
   */
  roles?: Array<string>
  /**
   * Authorization source for user. 'Database', 'ldap' or 'token'
   */
  type?: UserDto.TypeEnum
  /**
   * State of user's activeness: 'Active', 'Disabled' or 'Registering'
   */
  status?: UserDto.StatusEnum
  /**
   * Username for this user. We encourage using an email address
   */
  login?: string
  /**
   * Hashed version of the password (BCrypt is used for hashing)
   */
  passwordHash?: string
  /**
   * Secret token used to verify 2fa
   */
  secret?: string
  /**
   * Whether the user has activated two factors authentication
   */
  use2fa?: boolean
  /**
   * id of the group (practice/hospital) the user is member of
   */
  groupId?: string
  /**
   * Id of the healthcare party if the user is a healthcare party.
   */
  healthcarePartyId?: string
  /**
   * Id of the patient if the user is a patient
   */
  patientId?: string
  /**
   * Delegations that are automatically generated client side when a new database object is created by this user
   */
  autoDelegations?: { [key: string]: Array<string> }
  /**
   * the timestamp (unix epoch in ms) of creation of the user, will be filled automatically if missing. Not enforced by the application server.
   */
  createdDate?: number
  /**
   * the timestamp (unix epoch in ms) of the latest validation of the terms of use of the application
   */
  termsOfUseDate?: number
  /**
   * email address of the user.
   */
  email?: string
  /**
   * Long lived authentication tokens used for inter-applications authentication.
   */
  applicationTokens?: { [key: string]: string }
}
export namespace UserDto {
  export type TypeEnum = "database" | "ldap" | "token"
  export const TypeEnum = {
    Database: "database" as TypeEnum,
    Ldap: "ldap" as TypeEnum,
    Token: "token" as TypeEnum,
  }
  export type StatusEnum = "ACTIVE" | "DISABLED" | "REGISTERING"
  export const StatusEnum = {
    ACTIVE: "ACTIVE" as StatusEnum,
    DISABLED: "DISABLED" as StatusEnum,
    REGISTERING: "REGISTERING" as StatusEnum,
  }
}
