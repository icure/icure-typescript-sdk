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
import { AmpComponentDto } from "./AmpComponentDto"
import { AmppDto } from "./AmppDto"
import { CompanyDto } from "./CompanyDto"
import { SamTextDto } from "./SamTextDto"
import { VmpStubDto } from "./VmpStubDto"

import { decodeBase64 } from "./ModelHelper"

export class AmpDto {
  constructor(json: JSON | any) {
    Object.assign(this as AmpDto, json)
  }

  id?: string
  rev?: string
  /**
   * hard delete (unix epoch in ms) timestamp of the object. Filled automatically when deletePatient is called.
   */
  deletionDate?: number
  from?: number
  to?: number
  code?: string
  vmp?: VmpStubDto
  officialName?: string
  status?: AmpDto.StatusEnum
  name?: SamTextDto
  blackTriangle?: boolean
  medicineType?: AmpDto.MedicineTypeEnum
  company?: CompanyDto
  abbreviatedName?: SamTextDto
  proprietarySuffix?: SamTextDto
  prescriptionName?: SamTextDto
  ampps?: Array<AmppDto>
  components?: Array<AmpComponentDto>
}
export namespace AmpDto {
  export type StatusEnum = "AUTHORIZED" | "SUSPENDED" | "REVOKED"
  export const StatusEnum = {
    AUTHORIZED: "AUTHORIZED" as StatusEnum,
    SUSPENDED: "SUSPENDED" as StatusEnum,
    REVOKED: "REVOKED" as StatusEnum
  }
  export type MedicineTypeEnum = "ALLOPATHIC" | "HOMEOPATHIC"
  export const MedicineTypeEnum = {
    ALLOPATHIC: "ALLOPATHIC" as MedicineTypeEnum,
    HOMEOPATHIC: "HOMEOPATHIC" as MedicineTypeEnum
  }
}
