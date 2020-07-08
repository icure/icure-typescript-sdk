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
import { CodeStubDto } from "./CodeStubDto"
import { DelegationDto } from "./DelegationDto"

export class AccessLogDto {
  constructor(json: JSON | any) {
    Object.assign(this as AccessLogDto, json)
  }

  id?: string
  rev?: string
  created?: number
  modified?: number
  author?: string
  responsible?: string
  medicalLocationId?: string
  tags?: Array<CodeStubDto>
  codes?: Array<CodeStubDto>
  endOfLife?: number
  deletionDate?: number
  objectId?: string
  accessType?: string
  user?: string
  detail?: string
  date?: number
  patientId?: string
  secretForeignKeys?: Array<string>
  cryptedForeignKeys?: { [key: string]: Array<DelegationDto> }
  delegations?: { [key: string]: Array<DelegationDto> }
  encryptionKeys?: { [key: string]: Array<DelegationDto> }
  encryptedSelf?: string
}
