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

/**
 * Financial information (Bank, bank account) used to reimburse the patient.
 */
import { decodeBase64 } from "./ModelHelper"

export class FinancialInstitutionInformationDto {
  constructor(json: JSON | any) {
    Object.assign(this as FinancialInstitutionInformationDto, json)
  }

  name?: string
  key?: string
  bankAccount?: string
  bic?: string
  proxyBankAccount?: string
  proxyBic?: string
  preferredFiiForPartners?: Array<string>
  /**
   * The base64 encoded data of this object, formatted as JSON and encrypted in AES using the random master key from encryptionKeys.
   */
  encryptedSelf?: string
}
