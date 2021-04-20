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
import { HealthElement } from './HealthElement'
import { HealthcareParty } from './HealthcareParty'
import { Service } from './Service'

export class SumehrExportInfo {
  constructor(json: JSON | any) {
    Object.assign(this as SumehrExportInfo, json)
  }

  secretForeignKeys?: Array<string>
  excludedIds?: Array<string>
  recipient?: HealthcareParty
  softwareName?: string
  softwareVersion?: string
  comment?: string
  includeIrrelevantInformation?: boolean
  services?: Array<Service>
  healthElements?: Array<HealthElement>
}
