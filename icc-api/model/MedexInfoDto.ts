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
import { HealthcarePartyDto } from "./HealthcarePartyDto"
import { PatientDto } from "./PatientDto"

export class MedexInfoDto {
  constructor(json: JSON | any) {
    Object.assign(this as MedexInfoDto, json)
  }

  beginDate?: number
  endDate?: number
  author?: HealthcarePartyDto
  patient?: PatientDto
  patientLanguage?: string
  incapacityType?: string
  incapacityReason?: string
  outOfHomeAllowed?: boolean
  certificateDate?: number
  contentDate?: number
  diagnosisICPC?: string
  diagnosisICD?: string
  diagnosisDescr?: string
}
