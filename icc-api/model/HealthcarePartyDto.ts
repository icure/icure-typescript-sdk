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
import { AddressDto } from "./AddressDto"
import { CodeDto } from "./CodeDto"
import { FinancialInstitutionInformationDto } from "./FinancialInstitutionInformationDto"
import { FlatRateTarificationDto } from "./FlatRateTarificationDto"

export class HealthcarePartyDto {
  constructor(json: JSON | any) {
    Object.assign(this as HealthcarePartyDto, json)
  }

  id?: string
  rev?: string
  deletionDate?: number
  name?: string
  lastName?: string
  firstName?: string
  gender?: HealthcarePartyDto.GenderEnum
  civility?: string
  speciality?: string
  companyName?: string
  bankAccount?: string
  bic?: string
  proxyBankAccount?: string
  proxyBic?: string
  invoiceHeader?: string
  userName?: string
  publicKey?: string
  nihii?: string
  ssin?: string
  picture?: Array<string>
  cbe?: string
  ehp?: string
  convention?: number
  userId?: string
  parentId?: string
  supervisorId?: string
  notes?: string
  sendFormats?: { [key: string]: string }
  addresses?: Array<AddressDto>
  languages?: Array<string>
  statuses?: Array<HealthcarePartyDto.StatusesEnum>
  specialityCodes?: Array<CodeDto>
  hcPartyKeys?: { [key: string]: Array<string> }
  privateKeyShamirPartitions?: { [key: string]: string }
  financialInstitutionInformation?: Array<FinancialInstitutionInformationDto>
  options?: { [key: string]: string }
  billingType?: string
  type?: string
  contactPerson?: string
  contactPersonHcpId?: string
  flatRateTarifications?: Array<FlatRateTarificationDto>
  importedData?: { [key: string]: string }
}
export namespace HealthcarePartyDto {
  export type GenderEnum =
    | "male"
    | "female"
    | "unknown"
    | "indeterminate"
    | "changed"
    | "changedToMale"
    | "changedToFemale"
  export const GenderEnum = {
    Male: "male" as GenderEnum,
    Female: "female" as GenderEnum,
    Unknown: "unknown" as GenderEnum,
    Indeterminate: "indeterminate" as GenderEnum,
    Changed: "changed" as GenderEnum,
    ChangedToMale: "changedToMale" as GenderEnum,
    ChangedToFemale: "changedToFemale" as GenderEnum
  }
  export type StatusesEnum = "trainee" | "withconvention" | "accreditated"
  export const StatusesEnum = {
    Trainee: "trainee" as StatusesEnum,
    Withconvention: "withconvention" as StatusesEnum,
    Accreditated: "accreditated" as StatusesEnum
  }
}
