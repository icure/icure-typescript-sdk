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
import { Attachment } from "./Attachment"
import { RevisionInfo } from "./RevisionInfo"

export class PropertyType {
  constructor(json: JSON | any) {
    Object.assign(this as PropertyType, json)
  }

  identifier?: string
  type?: PropertyType.TypeEnum
  scope?: PropertyType.ScopeEnum
  unique?: boolean
  editor?: string
  localized?: boolean
  attachments?: { [key: string]: Attachment }
  deleted?: number
  id?: string
  rev?: string
  revsInfo?: Array<RevisionInfo>
  conflicts?: Array<string>
  javaType?: string
  revHistory?: { [key: string]: string }
}
export namespace PropertyType {
  export type TypeEnum =
    | "BOOLEAN"
    | "INTEGER"
    | "DOUBLE"
    | "STRING"
    | "DATE"
    | "CLOB"
    | "JSON"
    | "PropertyType#desambiguationToken"
  export const TypeEnum = {
    BOOLEAN: "BOOLEAN" as TypeEnum,
    INTEGER: "INTEGER" as TypeEnum,
    DOUBLE: "DOUBLE" as TypeEnum,
    STRING: "STRING" as TypeEnum,
    DATE: "DATE" as TypeEnum,
    CLOB: "CLOB" as TypeEnum,
    JSON: "JSON" as TypeEnum
  }
  export type ScopeEnum =
    | "SYSTEM"
    | "NODE"
    | "ROLE"
    | "USER"
    | "EVENT"
    | "PropertyType#desambiguationToken"
  export const ScopeEnum = {
    SYSTEM: "SYSTEM" as ScopeEnum,
    NODE: "NODE" as ScopeEnum,
    ROLE: "ROLE" as ScopeEnum,
    USER: "USER" as ScopeEnum,
    EVENT: "EVENT" as ScopeEnum
  }
}
