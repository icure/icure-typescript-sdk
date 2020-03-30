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

export class PermissionCriterion {
  constructor(json: JSON | any) {
    Object.assign(this as PermissionCriterion, json)
  }

  negative?: boolean
  currentUser?: PermissionCriterion.CurrentUserEnum
  dataType?: PermissionCriterion.DataTypeEnum
  patientStatus?: string
  useless?: boolean
  type?: PermissionCriterion.TypeEnum
}
export namespace PermissionCriterion {
  export type CurrentUserEnum =
    | "DATA_CREATION_USER"
    | "DATA_MODIFICATION_USER"
    | "PATIENT_CREATION_USER"
    | "PATIENT_MODIFICATION_USER"
    | "PATIENT_REFERENCE_HC_USER"
    | "PATIENT_HC_TEAM_USER"
  export const CurrentUserEnum = {
    DATACREATIONUSER: "DATA_CREATION_USER" as CurrentUserEnum,
    DATAMODIFICATIONUSER: "DATA_MODIFICATION_USER" as CurrentUserEnum,
    PATIENTCREATIONUSER: "PATIENT_CREATION_USER" as CurrentUserEnum,
    PATIENTMODIFICATIONUSER: "PATIENT_MODIFICATION_USER" as CurrentUserEnum,
    PATIENTREFERENCEHCUSER: "PATIENT_REFERENCE_HC_USER" as CurrentUserEnum,
    PATIENTHCTEAMUSER: "PATIENT_HC_TEAM_USER" as CurrentUserEnum
  }
  export type DataTypeEnum = "ADMINISTRATIVE" | "HEALTH" | "SENSITIVE" | "CONFIDENTIAL"
  export const DataTypeEnum = {
    ADMINISTRATIVE: "ADMINISTRATIVE" as DataTypeEnum,
    HEALTH: "HEALTH" as DataTypeEnum,
    SENSITIVE: "SENSITIVE" as DataTypeEnum,
    CONFIDENTIAL: "CONFIDENTIAL" as DataTypeEnum
  }
  export type TypeEnum = "VIRTUALHOST" | "CURRENT_USER" | "DATA_TYPE" | "PATIENT_STATUS"
  export const TypeEnum = {
    VIRTUALHOST: "VIRTUALHOST" as TypeEnum,
    CURRENTUSER: "CURRENT_USER" as TypeEnum,
    DATATYPE: "DATA_TYPE" as TypeEnum,
    PATIENTSTATUS: "PATIENT_STATUS" as TypeEnum
  }
}
